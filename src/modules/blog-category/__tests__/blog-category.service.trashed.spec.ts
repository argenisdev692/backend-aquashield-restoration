import { NotFoundException } from '@nestjs/common';
import { BlogCategoryService } from '../blog-category.service';
import type { BlogCategory } from '../blog-category.entity';

/**
 * Isolated spec for the Laravel-style soft-delete contract.
 *
 * Stays separate from `blog-category.service.spec.ts` so the new tests
 * are easy to read and aren't tangled with the pre-existing fixture in
 * that file.
 */

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const cls = { get: jest.fn().mockReturnValue('trace-test') };

const cache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
};

const audit = { log: jest.fn() };
const tx = { runInTx: jest.fn(async <T>(fn: () => Promise<T>) => fn()) };

const USER_ID = '018f0000-0000-7000-8000-000000000002';

const activeEntity: BlogCategory = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'News',
  description: null,
  image: null,
  userId: USER_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const suspendedEntity: BlogCategory = {
  ...activeEntity,
  deletedAt: '2026-05-01T10:00:00.000Z',
};

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([activeEntity]),
  findById: jest.fn().mockResolvedValue(activeEntity),
  findByName: jest.fn(),
  findByIdWithDeleted: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  bulkDelete: jest.fn(),
  bulkRestore: jest.fn(),
});

const makeStorage = () => ({
  upload: jest.fn(),
  delete: jest.fn(),
  publicUrl: jest.fn(),
  keyFromUrl: jest.fn(),
});

const makeService = (repo: ReturnType<typeof makeRepo>) =>
  new BlogCategoryService(
    repo as never,
    makeStorage() as never,
    cache as never,
    logger as never,
    cls as never,
    audit,
    tx as never,
    { getFallbackName: () => 'Company' } as never,
  );

describe('BlogCategoryService — trashed semantics', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('forwards trashed=exclude when no flag is passed', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.findAll(USER_ID, 50, 0);

      expect(repo.findAll).toHaveBeenCalledWith(USER_ID, 50, 0, 'exclude');
    });

    it('forwards trashed=include for withTrashed()', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.findAll(USER_ID, 50, 0, 'include');

      expect(repo.findAll).toHaveBeenCalledWith(USER_ID, 50, 0, 'include');
    });

    it('forwards trashed=only for onlyTrashed()', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.findAll(USER_ID, 50, 0, 'only');

      expect(repo.findAll).toHaveBeenCalledWith(USER_ID, 50, 0, 'only');
    });
  });

  describe('findById', () => {
    it('passes withTrashed=false to the repo by default', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.findById(USER_ID, activeEntity.id);

      expect(repo.findById).toHaveBeenCalledWith(
        USER_ID,
        activeEntity.id,
        false,
      );
    });

    it('passes withTrashed=true so suspended rows resolve', async () => {
      const repo = makeRepo();
      repo.findById.mockResolvedValueOnce(suspendedEntity);
      const service = makeService(repo);

      const result = await service.findById(USER_ID, suspendedEntity.id, true);

      expect(repo.findById).toHaveBeenCalledWith(
        USER_ID,
        suspendedEntity.id,
        true,
      );
      expect(result.deletedAt).toBe('2026-05-01T10:00:00.000Z');
    });

    it('throws NotFoundException when the row is missing', async () => {
      const repo = makeRepo();
      repo.findById.mockResolvedValueOnce(null);
      const service = makeService(repo);

      await expect(
        service.findById(USER_ID, 'missing-id', true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
