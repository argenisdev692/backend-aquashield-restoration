import { NotFoundException } from '@nestjs/common';
import { UserPermissionsService } from '../user-permissions.service';
import type { UserPermission } from '../user-permission.entity';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const cls = { get: jest.fn().mockReturnValue('trace-test') };

const cache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

const makeAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) });
type Audit = ReturnType<typeof makeAudit>;

const makeTx = () => ({
  runInTx: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
});
type Tx = ReturnType<typeof makeTx>;

const USER_ID = '018f0000-0000-7000-8000-000000000001';
const PERMISSION_ID = '018f0000-0000-7000-8000-0000000000aa';
const ACTOR_ID = '018f0000-0000-7000-8000-000000000002';

const baseOverride: UserPermission = {
  userId: USER_ID,
  permissionId: PERMISSION_ID,
  isGranted: true,
  conditions: null,
  fields: [],
  assignedAt: new Date(),
  assignedBy: ACTOR_ID,
  permission: {
    id: PERMISSION_ID,
    name: 'users:create',
    description: 'Create users',
    module: 'users',
    subject: 'USER',
    action: 'create',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
};

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findByUser: jest.fn().mockResolvedValue([baseOverride]),
  upsert: jest.fn().mockResolvedValue(baseOverride),
  remove: jest.fn().mockResolvedValue(true),
  userExists: jest.fn().mockResolvedValue(true),
  permissionExists: jest.fn().mockResolvedValue(true),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;

const makeService = (
  repo: Repo,
  audit: Audit = makeAudit(),
  tx: Tx = makeTx(),
): UserPermissionsService =>
  new UserPermissionsService(
    repo as never,
    cache as never,
    logger as never,
    cls as never,
    audit,
    tx as never,
  );

describe('UserPermissionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listForUser', () => {
    it('returns the user overrides', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.listForUser(USER_ID);
      expect(result).toEqual([baseOverride]);
      expect(repo.findByUser).toHaveBeenCalledWith(USER_ID);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const repo = makeRepo({
        userExists: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(service.listForUser(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsert (grant)', () => {
    it('persists isGranted=true inside tx, audits with strict, and invalidates caches', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);
      const dto = {
        permissionId: PERMISSION_ID,
        isGranted: true,
        conditions: { ownerId: '${user.id}' },
        fields: ['email'],
      };

      const result = await service.upsert(USER_ID, dto, ACTOR_ID);
      expect(result).toEqual(baseOverride);
      expect(repo.permissionExists).toHaveBeenCalledWith(PERMISSION_ID);
      expect(repo.upsert).toHaveBeenCalledWith(USER_ID, PERMISSION_ID, {
        isGranted: true,
        conditions: dto.conditions,
        fields: dto.fields,
        assignedBy: ACTOR_ID,
      });
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.permission_granted',
          actorId: ACTOR_ID,
          resourceType: 'USER',
          resourceId: USER_ID,
          metadata: {
            permissionId: PERMISSION_ID,
            isGranted: true,
            hasConditions: true,
            fieldCount: 1,
          },
        }),
        { strict: true },
      );
      expect(cache.del).toHaveBeenCalledWith(`casl:ability:${USER_ID}`);
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/auth/me*');
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/users*');
    });
  });

  describe('upsert (deny)', () => {
    it('persists isGranted=false and audits with the denied action', async () => {
      const repo = makeRepo({
        upsert: jest
          .fn()
          .mockResolvedValue({ ...baseOverride, isGranted: false }),
      });
      const audit = makeAudit();
      const service = makeService(repo, audit);
      const dto = { permissionId: PERMISSION_ID, isGranted: false };

      const result = await service.upsert(USER_ID, dto, ACTOR_ID);
      expect(result.isGranted).toBe(false);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.permission_denied',
          metadata: expect.objectContaining({
            isGranted: false,
            hasConditions: false,
            fieldCount: 0,
          }),
        }),
        { strict: true },
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const repo = makeRepo({
        userExists: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.upsert(
          USER_ID,
          { permissionId: PERMISSION_ID, isGranted: false },
          ACTOR_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the permission does not exist', async () => {
      const repo = makeRepo({
        permissionExists: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.upsert(
          USER_ID,
          { permissionId: PERMISSION_ID, isGranted: true },
          ACTOR_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the override inside tx, audits, and invalidates caches', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);

      await service.remove(USER_ID, PERMISSION_ID, ACTOR_ID);
      expect(repo.remove).toHaveBeenCalledWith(USER_ID, PERMISSION_ID);
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.permission_override_removed',
          actorId: ACTOR_ID,
          resourceType: 'USER',
          resourceId: USER_ID,
          metadata: { permissionId: PERMISSION_ID },
        }),
        { strict: true },
      );
      expect(cache.del).toHaveBeenCalledWith(`casl:ability:${USER_ID}`);
    });

    it('throws NotFoundException if the override is not attached', async () => {
      const repo = makeRepo({
        remove: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.remove(USER_ID, PERMISSION_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const repo = makeRepo({
        userExists: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.remove(USER_ID, PERMISSION_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
