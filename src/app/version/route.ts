import release from "../../../release.json";

export function GET() {
  return Response.json(
    {
      version: release.version,
      commit: process.env.PONGO_BUILD_COMMIT || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
