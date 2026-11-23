import { runQuery } from "@/db";

const timeoutMs = 1_000;
let pendingCheck: Promise<boolean> | undefined;

function checkDatabase() {
  // Share a probe during a slow connection attempt to avoid queuing queries.
  pendingCheck ??= runQuery("SELECT 1 FROM pongo_check_results LIMIT 1")
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      pendingCheck = undefined;
    });

  return pendingCheck;
}

export async function GET() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => resolve(false), timeoutMs);
  });
  const ready = await Promise.race([checkDatabase(), deadline]);
  clearTimeout(timeout);

  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
