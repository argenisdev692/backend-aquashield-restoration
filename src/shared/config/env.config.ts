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

  // ── Observability ──────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),

  // ── Rate limiting (OWASP #14) ──────────────────────────────
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // ── API docs ───────────────────────────────────────────────
  SWAGGER_ENABLED: booleanFromString.default(true),
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
