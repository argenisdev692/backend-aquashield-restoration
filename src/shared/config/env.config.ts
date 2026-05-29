import { z } from 'zod';

/**
 * Environment contract — validated ONCE at bootstrap.
 *
 * Wire as `ConfigModule.forRoot({ validate })` in AppModule. A missing or
 * malformed variable fails fast with an aggregated, human-readable error
 * (OWASP #5 — validate environment at bootstrap; never trust defaults blindly).
 */
const booleanFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');
// Default applies to the *output* (boolean) when the var is unset.

export const EnvSchema = z.object({
  // ── Runtime ────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  GLOBAL_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .describe('Comma-separated allowlist, or "*" for development only'),

  // ── Database (PostgreSQL / Supabase) ───────────────────────
  // DATABASE_URL is consumed by prisma.config.ts AND PrismaService adapter.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // ── Redis (cache + BullMQ) ─────────────────────────────────
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // ── Auth / Crypto ──────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  // Password lifetime in days. 0 disables expiry. Coerced because env
  // values are strings — the use cases compare it numerically.
  PASSWORD_EXPIRES_DAYS: z.coerce.number().int().min(0).max(3650).default(90),
  // Google OAuth — optional; Google sign-in is disabled when CLIENT_ID is
  // unset. If CLIENT_ID is set, CLIENT_SECRET and REDIRECT_URL are required
  // at bootstrap to avoid runtime 500s on the callback endpoint.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URL: z.string().url().optional(),
  // At-rest encryption key for TOTP seeds (OWASP Cryptographic Failures).
  // Any long random string; normalized to 32 bytes via SHA-256.
  TOTP_ENCRYPTION_KEY: z.string().min(32),
  // Breached-password screening (HIBP). Disable for offline/tests.
  HIBP_ENABLED: booleanFromString.default(true),
  HIBP_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1000),
  // Outbound allowlist (OWASP #15) — override only to point at a mock.
  HIBP_RANGE_URL: z
    .string()
    .url()
    .default('https://api.pwnedpasswords.com/range/'),

  // ── Observability ──────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),

  // ── Rate limiting (OWASP #14) ──────────────────────────────
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // ── API docs ───────────────────────────────────────────────
  SWAGGER_ENABLED: booleanFromString.default(true),

  // ── Email (shared mailer) ──────────────────────────────────
  // `resend` (default) uses Resend; `console` logs instead of sending.
  EMAIL_PROVIDER: z.enum(['resend', 'console']).default('resend'),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  // Contact-support notifications go to every active super-admin user
  // (resolved from the DB at runtime) — no static admin address needed.

  // ── Application ─────────────────────────────────────────────
  APP_URL: z.string().url().default('http://localhost:3000'),

  // ── Cloudflare R2 (object storage) ─────────────────────────
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_DEFAULT_REGION: z.string().default('auto'),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_USE_PATH_STYLE_ENDPOINT: booleanFromString.default(false),

  // ── Database backups (BackupModule) ────────────────────────
  // pg_dump binary — bare command resolved from PATH by default.
  BACKUP_PG_DUMP_BIN: z.string().min(1).default('pg_dump'),
  // Local temp dir for the dump file before it's uploaded. Must be on a
  // disk with enough free space for a full database snapshot.
  BACKUP_TMP_DIR: z.string().optional(),
  // Number of newest COMPLETED backups to keep — older ones are pruned
  // by BackupRetentionListener after each successful run.
  BACKUP_RETENTION_COUNT: z.coerce.number().int().min(1).max(365).default(30),
  // Override the R2 bucket for backups. Falls back to R2_BUCKET_NAME.
  BACKUP_R2_BUCKET_NAME: z.string().min(1).optional(),
  // Key prefix under the bucket.
  BACKUP_R2_PREFIX: z.string().default('backups'),

  // ── AI providers ───────────────────────────────────────────────
  AI_PROVIDER: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_IMAGE_MODEL: z
    .string()
    .default('gemini-2.0-flash-exp-image-generation'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_URL: z.string().url().default('https://api.anthropic.com/v1/messages'),
  ANTHROPIC_VERSION: z.string().default('2023-06-01'),
  OPENAI_API_KEY: z.string().min(1).optional(),

  // ── Research (Tavily) ───────────────────────────────────────────
  TAVILY_API_KEY: z.string().min(1),
  TAVILY_SEARCH_URL: z.string().url().default('https://api.tavily.com/search'),
  TAVILY_SEARCH_DEPTH: z.enum(['basic', 'advanced']).default('advanced'),
  TAVILY_MAX_RESULTS: z.coerce.number().int().min(1).max(20).default(8),

  // ── ElevenLabs (optional — module-level feature flag via presence of key)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('Rachel'),
});

export type EnvVars = z.infer<typeof EnvSchema>;

/**
 * `validate` hook for `@nestjs/config`. Throws an aggregated error listing
 * every invalid/missing variable so the failure is actionable at first boot.
 */
export function validateEnv(config: Record<string, unknown>): EnvVars {
  const parsed = EnvSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}
