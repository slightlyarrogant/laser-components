/**
 * add-user.ts — create (or update) an LC Connect account from the shell.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/add-user.ts \
 *     <email> <password> <ADMIN|RESEARCHER|SALES> [displayName] [regionCodes]
 *
 * regionCodes is a comma-separated list of region CODES (e.g. "EU,NA") or
 * region names. Omit it — or pass "" — to give the user GLOBAL competency
 * (they may claim unowned leads anywhere).
 *
 * Examples:
 *   npx tsx --env-file=.env scripts/add-user.ts anna@lc.de S3cretPass1 SALES "Anna Weber" EU
 *   npx tsx --env-file=.env scripts/add-user.ts rd@lc.de S3cretPass1 RESEARCHER "R&D"
 *
 * Re-running for an existing email updates role / displayName / regions and
 * leaves the password untouched (use set-password.ts for that).
 */

import "dotenv/config";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const ROLES = ["ADMIN", "RESEARCHER", "SALES"] as const;
type Role = (typeof ROLES)[number];

function usage(msg: string): never {
  console.error(`error: ${msg}`);
  console.error(
    "usage: tsx --env-file=.env scripts/add-user.ts <email> <password> <ADMIN|RESEARCHER|SALES> [displayName] [regionCodes,comma]"
  );
  process.exit(1);
}

async function main() {
  const [email, password, roleArg, displayNameArg, regionArg] = process.argv.slice(2);

  if (!email || !email.includes("@")) usage("a valid <email> is required");
  if (!password || password.length < 10) {
    usage("<password> is required and must be at least 10 characters");
  }
  if (!roleArg || !ROLES.includes(roleArg.toUpperCase() as Role)) {
    usage(`<role> must be one of ${ROLES.join(", ")}`);
  }
  const role = roleArg.toUpperCase() as Role;
  const displayName = displayNameArg?.trim() ? displayNameArg.trim() : null;

  // Resolve region codes/names -> ids. Empty list = global competency.
  const wanted = (regionArg ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let regionIds: number[] = [];
  if (wanted.length > 0) {
    const regions = await prisma.region.findMany({
      select: { id: true, name: true, code: true },
    });
    regionIds = wanted.map((w) => {
      const hit = regions.find(
        (r) =>
          r.code?.toUpperCase() === w.toUpperCase() ||
          r.name.toLowerCase() === w.toLowerCase()
      );
      if (!hit) {
        usage(
          `unknown region "${w}". Known: ${regions
            .map((r) => `${r.code ?? "?"} (${r.name})`)
            .join(", ")}`
        );
      }
      return hit!.id;
    });
    regionIds = [...new Set(regionIds)];
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const userId = existing
    ? (
        await prisma.user.update({
          where: { id: existing.id },
          data: { role, displayName, isActive: true },
          select: { id: true },
        })
      ).id
    : (
        await prisma.user.create({
          data: {
            email,
            passwordHash: await bcrypt.hash(password, 12),
            role,
            displayName,
            isActive: true,
          },
          select: { id: true },
        })
      ).id;

  await prisma.userRegion.deleteMany({ where: { userId } });
  if (regionIds.length > 0) {
    await prisma.userRegion.createMany({
      data: regionIds.map((regionId) => ({ userId, regionId })),
    });
  }

  const final = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      regions: { select: { region: { select: { code: true, name: true } } } },
    },
  });

  console.log(existing ? "User updated (password unchanged):" : "User created:");
  console.log("  ID:        ", final!.id);
  console.log("  Email:     ", final!.email);
  console.log("  Name:      ", final!.displayName ?? "(none)");
  console.log("  Role:      ", final!.role);
  console.log(
    "  Regions:   ",
    final!.regions.length
      ? final!.regions.map((r) => r.region.code ?? r.region.name).join(", ")
      : "(none = GLOBAL competency)"
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
