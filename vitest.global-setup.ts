import { execSync } from "node:child_process";

// Applies all migrations to the separate test database before any test runs.
export default function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env is optional (CI can provide real environment variables)
  }
  const url = process.env.DATABASE_URL_TEST;
  if (!url?.includes("lisva_test")) {
    throw new Error("DATABASE_URL_TEST must be set and point to the lisva_test database (see .env.example).");
  }
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    const out = error instanceof Error && "stdout" in error ? String((error as { stdout: unknown }).stdout) : "";
    throw new Error(`Could not migrate the test database. Is it running? Try: npm run db:up\n${out}`);
  }
}
