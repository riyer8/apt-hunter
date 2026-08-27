import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(root, "../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Copy server/.env.example to server/.env.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function migrate() {
  const sql = readFileSync(join(root, "schema.sql"), "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}
