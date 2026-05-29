import { CommandBus } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { RunBackupCommand } from '../../application/commands/run-backup.command';
import { BackupTrigger } from '../../domain/value-objects/backup-status.vo';
import { BackupScheduler } from '../../infrastructure/jobs/backup.scheduler';

function mockLogger(): LoggerService {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;
}

function mockCls(): ClsService {
  // run() must invoke its callback so we exercise the block under test.
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<void>) => fn()),
    set: jest.fn((k: string, v: unknown) => {
      store[k] = v;
    }),
    get: jest.fn((k: string) => store[k]),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

describe('BackupScheduler', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let logger: LoggerService;
  let cls: ClsService;
  let scheduler: BackupScheduler;

  beforeEach(() => {
    commandBus = {
      execute: jest.fn().mockResolvedValue('new-backup-id'),
    } as unknown as jest.Mocked<CommandBus>;
    logger = mockLogger();
    cls = mockCls();
    scheduler = new BackupScheduler(commandBus, logger, cls);
  });

  it('dispatches RunBackupCommand with SCHEDULER trigger and null actor', async () => {
    await scheduler.runDailyBackup();

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(RunBackupCommand),
    );
    const cmd = commandBus.execute.mock.calls[0][0] as RunBackupCommand;
    expect(cmd.triggeredBy).toBe(BackupTrigger.Scheduler);
    expect(cmd.actorId).toBeNull();
  });

  it('runs inside cls.run() and sets a traceId for the tick', async () => {
    await scheduler.runDailyBackup();

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(
      'traceId',
      expect.stringMatching(/^cron-/),
    );
  });

  it('catches and logs handler errors so the scheduler process survives', async () => {
    commandBus.execute.mockRejectedValueOnce(new Error('pg_dump failed'));

    await expect(scheduler.runDailyBackup()).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      'BackupScheduler.runDailyBackup failed',
      expect.objectContaining({ error: 'pg_dump failed' }),
    );
  });
});
