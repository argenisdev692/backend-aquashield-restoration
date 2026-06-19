import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  REFRESH_TOKEN_TTL_DAYS_ADMIN,
  REFRESH_TOKEN_TTL_DAYS_USER,
} from '../../domain/entities/auth-session.entity';

/**
 * Names of the roles that get the shorter session lifetime. Kept as
 * lowercase literals because the seed/spec uses these exact slugs.
 */
const ELEVATED_ROLES = new Set(['super-admin', 'admin']);

/**
 * Resolve the refresh-token TTL for a user. Matches the spec:
 *   - admin / super-admin → REFRESH_TOKEN_TTL_DAYS_ADMIN (tighter)
 *   - everyone else       → REFRESH_TOKEN_TTL_DAYS_USER
 *
 * Reads roles via Prisma directly (no extra port for one read query).
 * Soft-deleted / expired role assignments are ignored.
 */
export async function resolveRefreshTtlDays(
  prisma: PrismaService,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      role: { deletedAt: null },
    },
    select: { role: { select: { name: true } } },
  });
  const isElevated = rows.some((r) => ELEVATED_ROLES.has(r.role.name));
  return isElevated
    ? REFRESH_TOKEN_TTL_DAYS_ADMIN
    : REFRESH_TOKEN_TTL_DAYS_USER;
}
