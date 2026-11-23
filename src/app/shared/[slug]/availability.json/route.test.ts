import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("reports measured availability for public monitors within 24 hours", () => {
  const directory = mkdtempSync(join(tmpdir(), "pongo-availability-"));
  const databaseUrl = pathToFileURL(join(directory, "checks.db")).href;

  try {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "--eval",
        `
          import { createClient } from "@libsql/client";
          import { GET } from "./src/app/shared/[slug]/availability.json/route";
          const client = createClient({ url: process.env.DATABASE_URL });
          const journal = await Bun.file("drizzle/sqlite/meta/_journal.json").json();
          for (const { tag } of journal.entries) {
            await client.executeMultiple(await Bun.file("drizzle/sqlite/" + tag + ".sql").text());
          }
          const observedAt = Date.now() - 60_000;
          const rows = [
            ["vercel", "up", observedAt],
            ["vercel", "degraded", observedAt],
            ["vercel", "down", observedAt],
            ["vercel", "pending", observedAt],
            ["vercel", "up", observedAt - 25 * 3_600_000],
            ["not-public", "up", observedAt],
          ];
          for (const [index, row] of rows.entries()) {
            await client.execute({
              sql: "INSERT INTO pongo_check_results (id, monitor_id, status, checked_at, response_time_ms, created_at) VALUES (?, ?, ?, ?, 42, ?)",
              args: [String(index), ...row, row[2]],
            });
          }
          client.close();
          const request = new Request("http://localhost/shared/status/availability.json");
          const summary = await GET(request, { params: Promise.resolve({ slug: "status" }) });
          const missing = await GET(request, { params: Promise.resolve({ slug: "missing" }) });
          console.log(JSON.stringify({ status: summary.status, body: await summary.json(), missing: missing.status }));
        `,
      ],
      {
        env: { ...process.env, DATABASE_URL: databaseUrl, DB_DRIVER: "sqlite" },
      },
    );

    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    const { status, body, missing } = JSON.parse(result.stdout.toString());
    expect(status).toBe(200);
    expect(missing).toBe(404);
    expect(Date.parse(body.window.to) - Date.parse(body.window.from)).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(body.monitors).toEqual([
      expect.objectContaining({
        id: "vercel",
        observedChecks: 3,
        availabilityPercent: 50,
      }),
      expect.objectContaining({
        id: "hackernews",
        observedChecks: 0,
        availabilityPercent: null,
      }),
      expect.objectContaining({
        id: "wikipedia",
        observedChecks: 0,
        availabilityPercent: null,
      }),
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
