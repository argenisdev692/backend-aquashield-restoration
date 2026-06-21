import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RolesService } from '../roles.service';
import type { Role, Permission } from '../roles.entity';

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

const ACTOR_ID = '018f0000-0000-7000-8000-000000000002';

const PERMISSION_ID = '018f0000-0000-7000-8000-0000000000aa';

const basePermission: Permission = {
  id: PERMISSION_ID,
  name: 'roles:read',
  description: 'View roles',
  module: 'roles',
  subject: 'ROLE',
  action: 'read',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const baseRole: Role = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'Editor',
  description: 'Editor role',
  isSystem: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  permissions: [{ ...basePermission, conditions: null, fields: [] }],
};

const systemRole: Role = {
  id: '018f0000-0000-7000-8000-000000000009',
  name: 'super-admin',
  description: 'Super admin',
  isSystem: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  permissions: [],
};

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findAll: jest.fn().mockResolvedValue([baseRole]),
  findById: jest.fn().mockResolvedValue(baseRole),
  findByName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(baseRole),
  update: jest.fn().mockResolvedValue(baseRole),
  delete: jest.fn().mockResolvedValue(undefined),
  restore: jest.fn().mockResolvedValue(baseRole),
  countSystemInIds: jest.fn().mockResolvedValue(0),
  bulkDelete: jest.fn().mockResolvedValue({ count: 1 }),
  bulkRestore: jest.fn().mockResolvedValue({ count: 1 }),
  findAllPermissions: jest.fn().mockResolvedValue([basePermission]),
  attachPermission: jest.fn().mockResolvedValue(baseRole),
  detachPermission: jest.fn().mockResolvedValue(true),
  permissionExists: jest.fn().mockResolvedValue(true),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;

const makeService = (
  repo: Repo,
  audit: Audit = makeAudit(),
  tx: Tx = makeTx(),
): RolesService =>
  new RolesService(
    repo as never,
    cache as never,
    logger as never,
    cls as never,
    audit,
    tx as never,
    { getFallbackName: () => 'Company' } as never,
  );

describe('RolesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns the array of roles', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.findAll(20, 0, 'test', 'exclude');
      expect(result).toEqual([baseRole]);
      expect(repo.findAll).toHaveBeenCalledWith(20, 0, 'test', 'exclude');
    });
  });

  describe('findById', () => {
    it('returns the role if found', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.findById(baseRole.id);
      expect(result).toEqual(baseRole);
      expect(repo.findById).toHaveBeenCalledWith(baseRole.id, false);
    });

    it('throws NotFoundException if not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates role with permission assignments, audits, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const service = makeService(repo, audit);
      const dto = {
        name: 'Editor',
        description: 'Desc',
        permissions: [
          {
            permissionId: PERMISSION_ID,
            conditions: { ownerId: '${user.id}' },
            fields: ['title'],
          },
        ],
      };

      const result = await service.create(dto, ACTOR_ID);
      expect(result).toEqual(baseRole);
      expect(repo.findByName).toHaveBeenCalledWith('Editor');
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.created',
          actorId: ACTOR_ID,
          resourceType: 'ROLE',
        }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/roles*');
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/permissions*');
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/users*');
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/auth/me*');
      expect(cache.delByPattern).toHaveBeenCalledWith('casl:ability:*');
    });

    it('throws ConflictException if role name already exists', async () => {
      const repo = makeRepo({
        findByName: jest.fn().mockResolvedValue(baseRole),
      });
      const service = makeService(repo);
      const dto = { name: 'Editor', permissions: [] };

      await expect(service.create(dto, ACTOR_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('attachPermission', () => {
    it('attaches permission inside tx, audits with strict, invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);
      const dto = {
        permissionId: PERMISSION_ID,
        conditions: { ownerId: '${user.id}' },
        fields: ['title'],
      };

      const result = await service.attachPermission(baseRole.id, dto, ACTOR_ID);
      expect(result).toEqual(baseRole);
      expect(repo.permissionExists).toHaveBeenCalledWith(PERMISSION_ID);
      expect(repo.attachPermission).toHaveBeenCalledWith(baseRole.id, {
        permissionId: PERMISSION_ID,
        conditions: dto.conditions,
        fields: dto.fields,
      });
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.permission_attached',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
          metadata: {
            permissionId: PERMISSION_ID,
            hasConditions: true,
            fieldCount: 1,
          },
        }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('casl:ability:*');
    });

    it('throws NotFoundException if permission does not exist', async () => {
      const repo = makeRepo({
        permissionExists: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.attachPermission(
          baseRole.id,
          { permissionId: PERMISSION_ID },
          ACTOR_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repo.attachPermission).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if role is system', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(systemRole),
      });
      const service = makeService(repo);
      await expect(
        service.attachPermission(
          systemRole.id,
          { permissionId: PERMISSION_ID },
          ACTOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('detachPermission', () => {
    it('detaches permission inside tx, audits with strict, invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);

      await service.detachPermission(baseRole.id, PERMISSION_ID, ACTOR_ID);
      expect(repo.detachPermission).toHaveBeenCalledWith(
        baseRole.id,
        PERMISSION_ID,
      );
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.permission_detached',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
          metadata: { permissionId: PERMISSION_ID },
        }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('casl:ability:*');
    });

    it('throws NotFoundException if pivot row not present', async () => {
      const repo = makeRepo({
        detachPermission: jest.fn().mockResolvedValue(false),
      });
      const service = makeService(repo);
      await expect(
        service.detachPermission(baseRole.id, PERMISSION_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if role is system', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(systemRole),
      });
      const service = makeService(repo);
      await expect(
        service.detachPermission(systemRole.id, PERMISSION_ID, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates role, audits, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const service = makeService(repo, audit);
      const dto = { name: 'New Name' };

      const result = await service.update(baseRole.id, dto, ACTOR_ID);
      expect(result).toEqual(baseRole);
      expect(repo.findById).toHaveBeenCalledWith(baseRole.id, true);
      expect(repo.update).toHaveBeenCalledWith(baseRole.id, dto);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.updated',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
        }),
        { strict: true },
      );
    });

    it('throws BadRequestException if role is system role', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(systemRole),
      });
      const service = makeService(repo);
      await expect(
        service.update(systemRole.id, { name: 'New' }, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('deletes role, audits, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const service = makeService(repo, audit);

      await service.delete(baseRole.id, ACTOR_ID);
      expect(repo.delete).toHaveBeenCalledWith(baseRole.id);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.deleted',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
        }),
        { strict: true },
      );
    });

    it('throws BadRequestException if deleting system role', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(systemRole),
      });
      const service = makeService(repo);
      await expect(service.delete(systemRole.id, ACTOR_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('restore', () => {
    it('restores role, audits, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const service = makeService(repo, audit);

      const result = await service.restore(baseRole.id, ACTOR_ID);
      expect(result).toEqual(baseRole);
      expect(repo.restore).toHaveBeenCalledWith(baseRole.id);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.restored',
          actorId: ACTOR_ID,
        }),
        { strict: true },
      );
    });
  });

  describe('bulkDelete', () => {
    it('performs bulk delete, audits inside tx, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);

      const result = await service.bulkDelete([baseRole.id], ACTOR_ID);
      expect(result).toEqual({ count: 1 });
      expect(repo.countSystemInIds).toHaveBeenCalledWith([baseRole.id]);
      expect(repo.bulkDelete).toHaveBeenCalledWith([baseRole.id]);
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.bulk_deleted',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
          metadata: { ids: [baseRole.id], count: 1 },
        }),
        { strict: true },
      );
    });

    it('throws BadRequestException if bulk delete contains system roles', async () => {
      const repo = makeRepo({
        countSystemInIds: jest.fn().mockResolvedValue(1),
      });
      const service = makeService(repo);
      await expect(
        service.bulkDelete([systemRole.id], ACTOR_ID),
      ).rejects.toThrow(BadRequestException);
      expect(repo.bulkDelete).not.toHaveBeenCalled();
    });
  });

  describe('bulkRestore', () => {
    it('performs bulk restore, audits inside tx, and invalidates cache', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const tx = makeTx();
      const service = makeService(repo, audit, tx);

      const result = await service.bulkRestore([baseRole.id], ACTOR_ID);
      expect(result).toEqual({ count: 1 });
      expect(repo.bulkRestore).toHaveBeenCalledWith([baseRole.id]);
      expect(tx.runInTx).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'roles.bulk_restored',
          actorId: ACTOR_ID,
          resourceId: baseRole.id,
          metadata: { ids: [baseRole.id], count: 1 },
        }),
        { strict: true },
      );
    });
  });

  describe('findAllPermissions', () => {
    it('returns all static permissions', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.findAllPermissions();
      expect(result).toEqual([basePermission]);
      expect(repo.findAllPermissions).toHaveBeenCalled();
    });
  });

  describe('exportRoles', () => {
    it('exports as CSV', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.exportRoles({}, 'csv', ACTOR_ID);
      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('exports as XLSX', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.exportRoles({}, 'xlsx', ACTOR_ID);
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('exports as PDF', async () => {
      const repo = makeRepo();
      const service = makeService(repo);
      const result = await service.exportRoles({}, 'pdf', ACTOR_ID);
      expect(result.contentType).toBe('application/pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });
});
