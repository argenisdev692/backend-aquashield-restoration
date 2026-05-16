import { Disable2faUseCase } from './disable-2fa.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

describe('Disable2faUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables TOTP, emits event and audits auth.2fa_disabled', async () => {
    const userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateTotpSecret: jest.fn(),
      enableTotp: jest.fn(),
      disableTotp: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const eventEmitter = { emit: jest.fn() };

    const useCase = new Disable2faUseCase(
      userRepo,
      audit,
      eventEmitter as never,
      logger as never,
      cls as never,
    );

    await useCase.execute('u1');

    expect(userRepo.disableTotp).toHaveBeenCalledWith('u1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.2fa_disabled',
      expect.any(Object),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.2fa_disabled' }),
    );
    expect(logger.info).toHaveBeenCalledWith('Disable 2FA', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(
      '2FA disabled',
      expect.any(Object),
    );
  });
});
