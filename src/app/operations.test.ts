import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import release from "../../release.json";
import { GET as health } from "./health/route";
import { GET as version } from "./version/route";

test("liveness and release metadata are available without a database", async () => {
  expect(health().status).toBe(200);
  expect(await health().json()).toEqual({ status: "ok" });
  expect(version().headers.get("cache-control")).toBe("no-store");
  expect(await version().json()).toMatchObject({ version: release.version });
});

test("readiness recovers once the database schema is available", () => {
  const directory = mkdtempSync(join(tmpdir(), "pongo-ready-"));
  const url = pathToFileURL(join(directory, "ready.db")).href;

  try {
    // Isolate the DB driver and connection cache from other tests.
    const result = Bun.spawnSync(
      [
        process.execPath,
        "--eval",
        `
          import { createClient } from "@libsql/client";
          import { GET } from "./src/app/ready/route";
          const first = await GET();
          const client = createClient({ url: process.env.DATABASE_URL });
          const migrations = await Bun.file("drizzle/sqlite/meta/_journal.json").json();
          for (const { tag } of migrations.entries) {
            const sql = await Bun.file("drizzle/sqlite/" + tag + ".sql").text();
            await client.executeMultiple(sql);
          }
          client.close();
          const second = await GET();
          console.log(JSON.stringify([first.status, await first.json(), second.status, await second.json()]));
        `,
      ],
      { env: { ...process.env, DATABASE_URL: url, DB_DRIVER: "sqlite" } },
    );

    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual([
      503,
      { status: "unavailable" },
      200,
      { status: "ready" },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
