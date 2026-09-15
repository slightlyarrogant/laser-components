import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Zod-validated environment for LC Connect.
 *
 * Variable names follow LC's existing `.env` (PUBLIC_URL, LC_JWT_SECRET, …)
 * rather than VendoConnect's, so previously issued tokens and deploy configs
 * keep working unchanged. The shape mirrors VC's config.ts validation pattern.
 */

// Secrets that ship in documentation/examples. A server started with one of
// these is effectively unauthenticated (anyone can forge an access token), so
// boot fails loudly rather than serving with a known key.
const PLACEHOLDER_JWT_SECRETS = new Set([
  "lc-connect-secret-key-change-in-production",
  "change-me",
  "changeme",
]);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Public base URL — used for OAuth discovery documents and redirect/issuer
  // construction. LC's .env calls this PUBLIC_URL (VC calls it PUBLIC_BASE_URL);
  // we keep LC's name and expose it as the canonical base URL everywhere.
  PUBLIC_URL: z.string().url(),

  // JWT / OAuth — identity-preserving secret. Reusing the same LC_JWT_SECRET as
  // the old server means tokens it issued still verify after this swap.
  LC_JWT_SECRET: z
    .string()
    .min(16, "LC_JWT_SECRET must be at least 16 characters")
    .refine(
      (s) => !PLACEHOLDER_JWT_SECRETS.has(s.trim().toLowerCase()),
      "LC_JWT_SECRET is a known placeholder value — generate a real secret (openssl rand -hex 32) before starting the server"
    ),
  // 4 hours. Short enough that a leaked token expires the same working day,
  // long enough that a connector session is not interrupted mid-conversation
  // (the refresh-token grant renews it transparently).
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(14400),
  AUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Runtime state directory — OAuth client registry + refresh tokens live here.
  // MUST be an absolute path outside the repo checkout in production: resolving
  // relative to process.cwd() is what lost the client registry on a re-clone.
  STATE_DIR: z.string().min(1).optional(),

  // Data layer
  DATABASE_URL: z.string().min(1),

  // External services (optional in the skeleton; tools that need them are
  // ported in chunk 2 and validate presence at call time).
  PERPLEXITY_API_KEY: z.string().optional().default(""),
  WHATSAPP_URL: z.string().url().optional().default("http://localhost:3092"),
  WHATSAPP_RECIPIENT: z.string().optional().default("256422885490913@lid"),
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Configuration error — invalid environment variables:\n${issues}`
    );
  }
  return result.data;
}

const parsed = parseEnv();

const STATE_DIR = path.resolve(
  parsed.STATE_DIR ?? path.join(process.cwd(), "state")
);

// Created once at boot so every consumer (OAuth registry, refresh tokens) can
// write without its own mkdir dance. 0700: the files inside are credentials.
try {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
} catch (err) {
  throw new Error(
    `Configuration error — cannot create STATE_DIR ${STATE_DIR}: ${
      err instanceof Error ? err.message : String(err)
    }`
  );
}

/**
 * Exposed config. `PUBLIC_BASE_URL` and `JWT_ISSUER` are provided as aliases of
 * PUBLIC_URL so the OAuth/discovery code reads naturally and a future rename is
 * a one-line change here.
 */
export const config = {
  ...parsed,
  STATE_DIR,
  PUBLIC_BASE_URL: parsed.PUBLIC_URL,
  JWT_ISSUER: parsed.PUBLIC_URL,
  // Fixed audience for this resource server. Tokens minted for another
  // audience (or with none) are rejected by verifyAccessToken.
  JWT_AUDIENCE: "lc-connect",
  JWT_SECRET: parsed.LC_JWT_SECRET,
};

export type Config = typeof config;
