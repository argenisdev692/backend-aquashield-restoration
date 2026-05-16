import { UnauthorizedException } from '@nestjs/common';
import { VerifyTotpUseCase } from './verify-totp.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const user = {
  id: 'u1',
  email: 'a@b.com',
  password: 'h',
  totpSecret: 'SECRET',
  totpEnabled: true,
  roleIds: ['r1'],
};

function build(opts: { valid?: boolean; user?: typeof user | null }) {
  const userRepo = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(opts.user === undefined ? user : opts.user),
    findById: jest.fn(),
    updateTotpSecret: jest.fn(),
    enableTotp: jest.fn(),
    disableTotp: jest.fn(),
  };
  const totp = {
    generateSecret: jest.fn(),
    generateUri: jest.fn(),
    verify: jest.fn().mockResolvedValue(opts.valid ?? true),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    }),
  };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new VerifyTotpUseCase(
    userRepo,
    totp,
    audit,
    tokenIssuer as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, totp, audit, tokenIssuer };
}

describe('VerifyTotpUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('issues tokens and audits totp_verified + auth.login on a valid code', async () => {
    const { useCase, audit, tokenIssuer } = build({ valid: true });

    const result = await useCase.execute({ email: 'a@b.com', code: '123456' });

    expect(result.accessToken).toBe('at');
    expect(tokenIssuer.issue).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_verified' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login' }),
    );
  });

  it('audits totp_failed and throws on an invalid code (no token issued)', async () => {
    const { useCase, audit, tokenIssuer } = build({ valid: false });

    await expect(
      useCase.execute({ email: 'a@b.com', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_failed' }),
    );
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });
});
