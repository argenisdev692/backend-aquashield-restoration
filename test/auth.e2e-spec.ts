import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/infrastructure/api/controllers/auth.controller';
import { LoginUseCase } from '../src/modules/auth/application/use-cases/login.use-case';
import { VerifyOtpUseCase } from '../src/modules/auth/application/use-cases/verify-otp.use-case';
import { VerifyTotpUseCase } from '../src/modules/auth/application/use-cases/verify-totp.use-case';
import { Enable2faUseCase } from '../src/modules/auth/application/use-cases/enable-2fa.use-case';
import { Confirm2faUseCase } from '../src/modules/auth/application/use-cases/confirm-2fa.use-case';
import { Disable2faUseCase } from '../src/modules/auth/application/use-cases/disable-2fa.use-case';
import { RefreshTokenUseCase } from '../src/modules/auth/application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../src/modules/auth/application/use-cases/logout.use-case';
import { LogoutAllSessionsUseCase } from '../src/modules/auth/application/use-cases/logout-all-sessions.use-case';
import { AuthTokenIssuer } from '../src/modules/auth/application/services/auth-token-issuer.service';
import { LoggerService } from '../src/logger/logger.service';
import { USER_AUTH_REPOSITORY } from '../src/modules/auth/domain/repositories/user-auth.repository.interface';
import { OTP_REPOSITORY } from '../src/modules/auth/domain/repositories/otp.repository.interface';
import { EMAIL_PORT } from '../src/modules/auth/domain/ports/outbound/email.port';
import { PASSWORD_HASHER_PORT } from '../src/modules/auth/domain/ports/outbound/password-hasher.port';
import { AUDIT_PORT } from '../src/shared/activity-log/audit.port';

/**
 * E2E for the login → email-OTP → token flow.
 *
 * Boots the real controller + ZodValidationPipe + use cases over HTTP. The
 * external edges (DB repos, email, hasher, audit, token issuer) are in-memory
 * fakes so the test runs with no Postgres/Redis while still exercising the
 * full request → pipe → UseCase → response path.
 */
describe('Auth (e2e) — login → OTP → token', () => {
  let app: INestApplication;
  let sentOtp = '';

  const stub = { execute: () => Promise.resolve() } as never;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        VerifyOtpUseCase,
        { provide: VerifyTotpUseCase, useValue: stub },
        { provide: Enable2faUseCase, useValue: stub },
        { provide: Confirm2faUseCase, useValue: stub },
        { provide: Disable2faUseCase, useValue: stub },
        { provide: RefreshTokenUseCase, useValue: stub },
        { provide: LogoutUseCase, useValue: stub },
        { provide: LogoutAllSessionsUseCase, useValue: stub },
        {
          provide: AuthTokenIssuer,
          useValue: {
            issue: () =>
              Promise.resolve({
                accessToken: 'access.jwt',
                refreshToken: 'r'.repeat(128),
                expiresIn: 900,
              }),
          },
        },
        {
          provide: USER_AUTH_REPOSITORY,
          useValue: {
            findByEmail: () =>
              Promise.resolve({
                id: 'u1',
                email: 'user@vidula.test',
                password: 'hashed',
                totpSecret: null,
                totpEnabled: false,
                roleIds: ['r1'],
              }),
            findById: () => Promise.resolve(null),
            updateTotpSecret: () => Promise.resolve(),
            enableTotp: () => Promise.resolve(),
            disableTotp: () => Promise.resolve(),
          },
        },
        {
          provide: OTP_REPOSITORY,
          useValue: {
            save: (p: { code: { code: string } }) => {
              sentOtp = p.code.code;
              return Promise.resolve();
            },
            findValid: () =>
              Promise.resolve({
                id: 'otp-1',
                code: sentOtp,
                expiresAt: new Date(Date.now() + 60_000),
              }),
            markUsed: () => Promise.resolve(),
            deleteExpired: () => Promise.resolve(0),
          },
        },
        { provide: EMAIL_PORT, useValue: { sendOtp: () => Promise.resolve() } },
        {
          provide: PASSWORD_HASHER_PORT,
          useValue: {
            compare: () => Promise.resolve(true),
            hash: () => Promise.resolve('h'),
          },
        },
        { provide: AUDIT_PORT, useValue: { log: () => Promise.resolve() } },
        { provide: EventEmitter2, useValue: { emit: () => true } },
        { provide: ClsService, useValue: { get: () => 'trace-1' } },
        {
          provide: LoggerService,
          useValue: {
            setContext: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid login payload with 400 (Zod)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });

  it('issues an OTP on valid credentials, then exchanges it for tokens', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@vidula.test', password: 'correct-horse' })
      .expect(201);

    expect(login.body).toEqual({ requiresOtp: true, requiresTotp: false });
    expect(sentOtp).toMatch(/^\d{4}$/);

    const verify = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ email: 'user@vidula.test', code: sentOtp, type: 'login' })
      .expect(200);

    expect(verify.body).toMatchObject({
      requiresTotp: false,
      accessToken: 'access.jwt',
      expiresIn: 900,
    });
  });
});
