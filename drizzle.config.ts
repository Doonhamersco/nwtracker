import { defineConfig } from "drizzle-kit";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "nwtracker.db");

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
  verbose: true,
  strict: true,
});
