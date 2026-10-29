import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Only DATABASE_URL is taken from .env, so unit tests never see real Supabase keys.
// A DATABASE_URL already set in the shell wins over .env.
const envFile = path.resolve(__dirname, ".env");
const DATABASE_URL =
  process.env.DATABASE_URL ??
  (existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")).DATABASE_URL : undefined);

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    env: DATABASE_URL ? { DATABASE_URL } : {},
    // RLS tests share one database; run files serially.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
