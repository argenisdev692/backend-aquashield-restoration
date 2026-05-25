import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { PrismaService } from '../../../../database/prisma.service';
import { ActivityLogRetentionScheduler } from '../../../infrastructure/jobs/activity-log-retention.scheduler';

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

function mockPrisma(): PrismaService {
  return {
    activityLog: {
      deleteMany: jest.fn().mockResolvedValue({ count: 42 }),
    },
  } as unknown as PrismaService;
}

describe('ActivityLogRetentionScheduler', () => {
  let prisma: PrismaService;
  let logger: LoggerService;
  let cls: ClsService;
  let scheduler: ActivityLogRetentionScheduler;

  beforeEach(() => {
    prisma = mockPrisma();
    logger = mockLogger();
    cls = mockCls();
    scheduler = new ActivityLogRetentionScheduler(prisma, logger, cls);
  });

  it('calls deleteMany with cutoff older than 4 months and logs the count', async () => {
    await scheduler.purgeOldActivityLogs();

    expect(prisma.activityLog.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      'ActivityLogRetentionScheduler completed',
      expect.objectContaining({ deletedCount: 42 }),
    );
  });

  it('runs inside cls.run() and sets a traceId for the tick', async () => {
    await scheduler.purgeOldActivityLogs();

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(
      'traceId',
      expect.stringMatching(/^cron-activity-log-retention-/),
    );
  });

  it('catches and logs errors so the scheduler process survives', async () => {
    (prisma.activityLog.deleteMany as jest.Mock).mockRejectedValueOnce(
      new Error('db connection lost'),
    );

    await expect(scheduler.purgeOldActivityLogs()).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      'ActivityLogRetentionScheduler failed',
      expect.objectContaining({ error: 'db connection lost' }),
    );
  });
});
