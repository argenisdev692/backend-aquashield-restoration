import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';

import { TwoFactorRequiredGuard } from '../../guards/two-factor-required.guard';
import { FreshPasswordGuard } from '../../guards/fresh-password.guard';
import { GoogleOAuthCallbackUseCase } from '../../../application/use-cases/google-oauth-callback.use-case';
import { UnlinkGoogleAccountUseCase } from '../../../application/use-cases/unlink-google-account.use-case';
import {
  GOOGLE_OAUTH_PROVIDER,
  type IOAuthProvider,
} from '../../../domain/ports/oauth-provider.port';

const OAUTH_STATE_COOKIE = 'gstate';
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

/**
 * Google OAuth 2.0 authorization-code flow.
 *
 * CSRF defense: we generate a random `state`, store it in a short-lived
 * HttpOnly cookie, send it in the redirect URL, then require the callback
 * to echo the same value. Any mismatch → 400.
 */
@ApiTags('Auth: Social')
@Controller('auth/google')
export class SocialAuthController {
  constructor(
    @Inject(GOOGLE_OAUTH_PROVIDER)
    private readonly google: IOAuthProvider,
    private readonly callbackUc: GoogleOAuthCallbackUseCase,
    private readonly unlinkUc: UnlinkGoogleAccountUseCase,
  ) {}

  @Get('redirect')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Begin Google sign-in (sets the CSRF state cookie)',
  })
  redirect(@Res({ passthrough: false }) res: Response) {
    const state = randomBytes(32).toString('base64url');
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: OAUTH_STATE_TTL_MS,
      path: '/auth/google',
    });
    const url = this.google.buildAuthorizationUrl(state);
    return res.redirect(url);
  }

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Complete Google sign-in (verifies state + exchanges code)',
  })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing `code` or `state`');
    }
    // We do NOT rely on cookie-parser (not mounted globally) — parse the
    // `Cookie` header directly so the controller works regardless of the
    // bootstrap order.
    const cookieHeader = req.headers.cookie ?? '';
    const expected = parseCookie(cookieHeader, OAUTH_STATE_COOKIE);
    if (!expected || expected !== state) {
      throw new BadRequestException({
        code: 'AUTH_GOOGLE_STATE_MISMATCH',
        message: 'OAuth state mismatch — possible CSRF attempt',
      });
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/auth/google' });

    return this.callbackUc.execute({ code });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, TwoFactorRequiredGuard, FreshPasswordGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Unlink Google account (requires fresh password)' })
  async unlink(@CurrentUser() user: AuthenticatedUser) {
    await this.unlinkUc.execute(user.id);
  }
}

function parseCookie(header: string, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
