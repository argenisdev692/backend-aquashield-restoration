import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import { UserAccountNotFoundException } from '../../domain/exceptions/auth-domain.exception';
import type { UpdateProfileInput } from '../dto/update-profile.dto';

/**
 * Self-service profile update. Patches only the WHITELISTED non-auth
 * columns (name, lastName, phone, address, dateOfBirth, ...). Email,
 * password, totp*, googleId, mustChangePassword and lockedUntil are
 * NEVER touched here — they have their own dedicated flows.
 *
 * Username uniqueness is enforced by the DB index; we translate the
 * Prisma `P2002` into a 409 with the conflicting field surfaced.
 *
 * Audited as `auth.profile.updated` with the list of changed keys in
 * `metadata` (values intentionally NOT logged to keep PII out of the
 * audit trail).
 */
@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UpdateMyProfileUseCase.name);
  }

  @Transactional()
  async execute(userId: string, input: UpdateProfileInput): Promise<void> {
    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();

    const changedKeys = Object.keys(input);
    if (changedKeys.length === 0) return;

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.username !== undefined) data.username = input.username;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.dateOfBirth !== undefined) {
      data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    }
    if (input.address !== undefined) data.address = input.address;
    if (input.address2 !== undefined) data.address2 = input.address2;
    if (input.zipCode !== undefined) data.zipCode = input.zipCode;
    if (input.city !== undefined) data.city = input.city;
    if (input.state !== undefined) data.state = input.state;
    if (input.country !== undefined) data.country = input.country;
    if (input.gender !== undefined) data.gender = input.gender;

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        // Prisma P2002 unique constraint — surface the offending column.
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'AUTH_PROFILE_CONFLICT',
          message: 'Field already in use',
          target: (err as { meta?: { target?: string[] } }).meta?.target ?? [],
        });
      }
      throw err;
    }

    await this.audit.log(
      {
        action: 'auth.profile.updated',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: {
          changedFields: changedKeys,
          ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
        },
      },
      { strict: true },
    );

    this.logger.info('Profile updated', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
      changedFields: changedKeys,
    });
  }
}
