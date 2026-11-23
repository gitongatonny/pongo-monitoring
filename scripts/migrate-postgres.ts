import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/pg" });
  console.log("PostgreSQL migrations applied");
} finally {
  await client.end({ timeout: 5 });
}
