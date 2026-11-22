// Creates an administrator, or promotes an existing account.
//
//   npm run admin:create -- owner@example.com "Tên chủ shop"
//   ADMIN_PASSWORD='a-long-password' npm run admin:create -- owner@example.com
//   npm run admin:create -- owner@example.com --reset-password     (existing account gets a new password)
//
// Without ADMIN_PASSWORD a strong password is generated and printed once. Change it later in Account.
import { PrismaClient } from "@prisma/client";
import { createOrPromoteAdmin } from "../src/lib/admin/create-admin";

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional when DATABASE_URL is already set
}

async function main() {
  const args = process.argv.slice(2);
  const resetPassword = args.includes("--reset-password");
  const [email, name] = args.filter((a) => !a.startsWith("--"));

  if (!email) {
    console.error('Usage: npm run admin:create -- <email> ["Name"] [--reset-password]');
    process.exitCode = 1;
    return;
  }

  const db = new PrismaClient();
  try {
    const result = await createOrPromoteAdmin(db, { email, name, password: process.env.ADMIN_PASSWORD || undefined, resetPassword });
    console.log(result.created ? `Created administrator ${result.email}.` : `${result.email} is now an administrator.`);
    if (result.password && result.generatedPassword) {
      console.log(`\nPassword (shown once, save it now): ${result.password}\n`);
    } else if (result.password) {
      console.log("The password from ADMIN_PASSWORD was set.");
    } else {
      console.log("The existing password was kept (use --reset-password to set a new one).");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
