import { NotFoundException } from '@nestjs/common';
import { BlogCategoryService } from '../blog-category.service';
import type { BlogCategory } from '../blog-category.entity';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const cls = { get: jest.fn().mockReturnValue('trace-test') };

const baseEntity: BlogCategory = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'News',
  description: null,
  image: null,
  userId: '018f0000-0000-7000-8000-000000000002',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findAll: jest.fn().mockResolvedValue([baseEntity]),
  findById: jest.fn().mockResolvedValue(baseEntity),
  findByIdWithDeleted: jest.fn().mockResolvedValue(baseEntity),
  create: jest.fn().mockResolvedValue(baseEntity),
  update: jest.fn().mockResolvedValue(baseEntity),
  softDelete: jest.fn().mockResolvedValue(undefined),
  restore: jest.fn().mockResolvedValue(baseEntity),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;

const makeService = (repo: Repo): BlogCategoryService =>
  new BlogCategoryService(
    repo as never,
    logger as never,
    cls as never,
  );

describe('BlogCategoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('findById returns the entity when it exists', async () => {
    const repo = makeRepo();
    await expect(makeService(repo).findById(baseEntity.id)).resolves.toEqual(
      baseEntity,
    );
  });

  it('findById throws NotFoundException when missing', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    await expect(makeService(repo).findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create forwards the authenticated userId to the repository', async () => {
    const repo = makeRepo();
    await makeService(repo).create('user-9', { name: 'Tips' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Tips', userId: 'user-9' });
  });

  it('update checks existence then delegates to repository.update', async () => {
    const repo = makeRepo();
    await makeService(repo).update(baseEntity.id, { name: 'Renamed' });
    expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.update).toHaveBeenCalledWith(baseEntity.id, { name: 'Renamed' });
  });

  it('delete performs a soft delete after the existence check', async () => {
    const repo = makeRepo();
    await makeService(repo).delete(baseEntity.id);
    expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.softDelete).toHaveBeenCalledWith(baseEntity.id);
  });

  it('restore looks up the row INCLUDING soft-deleted rows (regression)', async () => {
    const repo = makeRepo();
    await makeService(repo).restore(baseEntity.id);
    expect(repo.findByIdWithDeleted).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.restore).toHaveBeenCalledWith(baseEntity.id);
  });

  it('restore throws NotFoundException when the row does not exist at all', async () => {
    const repo = makeRepo({
      findByIdWithDeleted: jest.fn().mockResolvedValue(null),
    });
    await expect(
      makeService(repo).restore('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.restore).not.toHaveBeenCalled();
  });
});
