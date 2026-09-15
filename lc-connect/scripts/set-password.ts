/**
 * set-password.ts — reset an LC Connect account password from the shell.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/set-password.ts <email> <newPassword>
 *
 * Writes a bcrypt hash at cost 12 — the same format the OAuth login path
 * verifies — and clears any pending reset token. The plaintext is never
 * stored or echoed back beyond the confirmation line.
 */

import "dotenv/config";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

function usage(msg: string): never {
  console.error(`error: ${msg}`);
  console.error(
    "usage: tsx --env-file=.env scripts/set-password.ts <email> <newPassword>"
  );
  process.exit(1);
}

async function main() {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !email.includes("@")) usage("a valid <email> is required");
  if (!newPassword || newPassword.length < 10) {
    usage("<newPassword> is required and must be at least 10 characters");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });
  if (!user) usage(`no user with email ${email}`);

  await prisma.user.update({
    where: { id: user!.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });

  console.log(`Password updated for ${user!.email} (ID ${user!.id}).`);
  if (!user!.isActive) {
    console.log(
      "NOTE: this account is DEACTIVATED — sign-in stays refused until it is reactivated."
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
