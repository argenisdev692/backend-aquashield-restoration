import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../logger/logger.service';
import {
  MAX_URLS_IN_FIELD,
  SPAM_CHECKED_FIELDS,
  SPAM_KEYWORD_PATTERNS,
  URL_PATTERN,
} from '../constants/spam-keywords.constants';

const SPAM_MESSAGE = 'Message contains prohibited content.';

@Injectable()
export class SpamFilterGuard implements CanActivate {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req.body as Record<string, unknown>;
    const traceId = this.cls.get<string>('traceId');
    const ip = req.ip ?? 'unknown';

    for (const field of SPAM_CHECKED_FIELDS) {
      const raw = body[field];
      if (typeof raw !== 'string' || raw.length === 0) continue;

      for (const pattern of SPAM_KEYWORD_PATTERNS) {
        if (pattern.test(raw)) {
          this.logger.warn('SpamFilterGuard: keyword match', {
            traceId,
            ip,
            field,
            pattern: pattern.source,
          });
          throw new BadRequestException(SPAM_MESSAGE);
        }
      }

      const urlMatches = raw.match(URL_PATTERN) ?? [];
      if (urlMatches.length > MAX_URLS_IN_FIELD) {
        this.logger.warn('SpamFilterGuard: excessive URLs', {
          traceId,
          ip,
          field,
          urlCount: urlMatches.length,
        });
        throw new BadRequestException(SPAM_MESSAGE);
      }
    }

    return true;
  }
}
