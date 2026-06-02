import { z } from "zod";

/**
 * Zod-validated environment for LC Connect.
 *
 * Variable names follow LC's existing `.env` (PUBLIC_URL, LC_JWT_SECRET, …)
 * rather than VendoConnect's, so previously issued tokens and deploy configs
 * keep working unchanged. The shape mirrors VC's config.ts validation pattern.
 */
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
    .min(16, "LC_JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  AUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Data layer
  DATABASE_URL: z.string().min(1),

  // External services (optional in the skeleton; tools that need them are
  // ported in chunk 2 and validate presence at call time).
  PERPLEXITY_API_KEY: z.string().optional().default(""),
  WHATSAPP_URL: z.string().url().optional().default("http://localhost:8092"),
  WHATSAPP_RECIPIENT: z.string().optional().default(""),
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

/**
 * Exposed config. `PUBLIC_BASE_URL` and `JWT_ISSUER` are provided as aliases of
 * PUBLIC_URL so the OAuth/discovery code reads naturally and a future rename is
 * a one-line change here.
 */
export const config = {
  ...parsed,
  PUBLIC_BASE_URL: parsed.PUBLIC_URL,
  JWT_ISSUER: parsed.PUBLIC_URL,
  JWT_SECRET: parsed.LC_JWT_SECRET,
};

export type Config = typeof config;
