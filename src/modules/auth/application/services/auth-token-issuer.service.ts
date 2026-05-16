import { Inject, Injectable } from '@nestjs/common';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type { ITokenServicePort } from '../../domain/ports/outbound/token-service.port';
import { TOKEN_SERVICE_PORT } from '../../domain/ports/outbound/token-service.port';
import { AuthSession } from '../../domain/entities/auth-session.aggregate';
import { RefreshToken } from '../../domain/value-objects/refresh-token.vo';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Collaborator (not a UseCase) that mints an access token + persists a fresh
 * refresh-token session. Audit / events / logging stay with the calling
 * UseCase so each one keeps a single `execute()` entry point.
 */
@Injectable()
export class AuthTokenIssuer {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenServicePort,
  ) {}

  async issue(user: {
    id: string;
    email: string;
    roleIds: string[];
  }): Promise<IssuedTokens> {
    const { token, expiresInSeconds } = await this.tokenService.signAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleIds: user.roleIds,
      },
    );

    const refreshTokenVo = RefreshToken.generate();
    const session = AuthSession.create({
      id: '', // DB-generated UUID v7
      userId: user.id,
      refreshToken: refreshTokenVo,
      expiresAt: new Date(Date.now() + this.tokenService.refreshTtlMs()),
    });
    await this.sessionRepo.save(session);

    // The raw token leaves the boundary exactly once, here. Persistence
    // stored only `refreshTokenVo.hash` via the mapper.
    return {
      accessToken: token,
      refreshToken: refreshTokenVo.raw,
      expiresIn: expiresInSeconds,
    };
  }
}
