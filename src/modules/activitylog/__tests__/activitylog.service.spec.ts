import { NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../activitylog.service';
import type { ActivityLog } from '../activitylog.entity';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const cls = { get: jest.fn().mockReturnValue('trace-test') };

const baseEntity: ActivityLog = {
  id: '018f0000-0000-7000-8000-000000000001',
  action: 'users.created',
  actorId: '018f0000-0000-7000-8000-000000000002',
  resourceType: 'USER',
  resourceId: '018f0000-0000-7000-8000-000000000003',
  traceId: 'trace-test',
  correlationId: null,
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  metadata: { name: 'Test User' },
  createdAt: new Date().toISOString(),
};

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findById: jest.fn().mockResolvedValue(baseEntity),
  findAll: jest.fn().mockResolvedValue({ data: [baseEntity], total: 1 }),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;

const makeService = (repo: Repo): ActivityLogService =>
  new ActivityLogService(repo as never, logger as never, cls as never);

describe('ActivityLogService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('returns the entity when it exists', async () => {
      const repo = makeRepo();
      await expect(makeService(repo).findById(baseEntity.id)).resolves.toEqual(
        baseEntity,
      );
      expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
    });

    it('throws NotFoundException when missing', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(null),
      });
      await expect(
        makeService(repo).findById('missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results with filters', async () => {
      const repo = makeRepo();
      const filter = {
        page: 1,
        limit: 20,
        actorId: baseEntity.actorId,
        action: 'users.created',
      };
      const result = await makeService(repo).findAll(filter);

      expect(result.data).toEqual([baseEntity]);
      expect(result.total).toBe(1);
      expect(repo.findAll).toHaveBeenCalledWith(
        filter,
        expect.objectContaining({}),
      );
    });

    it('applies date range when provided', async () => {
      const repo = makeRepo();
      const filter = {
        page: 1,
        limit: 20,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
      };
      await makeService(repo).findAll(filter);

      expect(repo.findAll).toHaveBeenCalledWith(
        filter,
        expect.objectContaining({
          startDate: filter.start_date,
          endDate: filter.end_date,
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes the log when it exists', async () => {
      const repo = makeRepo();
      await makeService(repo).delete(baseEntity.id);
      expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
      expect(repo.delete).toHaveBeenCalledWith(baseEntity.id);
    });

    it('throws NotFoundException when the log does not exist', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(null),
      });
      await expect(
        makeService(repo).delete('missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
