import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAdminRecipientsPort } from '../../domain/ports/admin-recipients.port';

/**
 * ACL adapter → users/RBAC context.
 *
 * Returns the e-mail of every active, non-expired super-admin user. The role
 * name (`super-admin`) is the canonical system role seeded in `prisma/seed.ts`.
 */
@Injectable()
export class UsersAdminRecipientsAdapter implements IAdminRecipientsPort {
  private static readonly RECIPIENT_ROLES = ['super-admin', 'admin'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(UsersAdminRecipientsAdapter.name);
  }

  async getAdminRecipientEmails(): Promise<string[]> {
    const traceId = this.cls.get<string>('traceId');

    const rows = await this.prisma.userRole.findMany({
      where: {
        role: {
          name: { in: UsersAdminRecipientsAdapter.RECIPIENT_ROLES },
          deletedAt: null,
        },
        user: { deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { user: { select: { email: true } } },
    });

    const emails = [...new Set(rows.map((r) => r.user.email))];
    if (emails.length === 0) {
      this.logger.warn('No active admin/super-admin recipients found', {
        traceId,
      });
    }
    return emails;
  }
}
