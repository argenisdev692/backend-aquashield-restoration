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
  // `null` = no duplicate, so create/update don't trip the ConflictException
  // guard (`if (await repo.findByName(...))`).
  findByName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(baseEntity),
  update: jest.fn().mockResolvedValue(baseEntity),
  softDelete: jest.fn().mockResolvedValue(undefined),
  restore: jest.fn().mockResolvedValue(baseEntity),
  bulkDelete: jest.fn().mockResolvedValue({ count: 0 }),
  bulkRestore: jest.fn().mockResolvedValue({ count: 0 }),
  ...overrides,
});

const makeStorage = (overrides: Record<string, jest.Mock> = {}) => ({
  upload: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  publicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  keyFromUrl: jest.fn((url: string) => {
    const prefix = 'https://cdn.example.com/';
    if (!url.startsWith(prefix)) {
      throw new Error(`URL does not belong to this storage bucket: ${url}`);
    }
    return url.slice(prefix.length);
  }),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;
type Storage = ReturnType<typeof makeStorage>;

const makeService = (
  repo: Repo,
  storage: Storage = makeStorage(),
  audit: Audit = makeAudit(),
  tx: Tx = makeTx(),
): BlogCategoryService =>
  new BlogCategoryService(
    repo as never,
    storage as never,
    cache as never,
    logger as never,
    cls as never,
    audit,
    tx as never,
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

  it('create forwards the authenticated userId, logs audit, and invalidates cache', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    await makeService(repo, makeStorage(), audit).create('user-9', {
      name: 'Tips',
    });
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Tips',
      userId: 'user-9',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'blogcategory.created',
        actorId: 'user-9',
        resourceType: 'BLOG_CATEGORY',
        resourceId: baseEntity.id,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/blog-categories*');
  });

  it('update delegates to repository.update, logs audit, and invalidates cache', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    await makeService(repo, makeStorage(), audit).update(baseEntity.id, {
      name: 'Renamed',
    });
    expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.update).toHaveBeenCalledWith(baseEntity.id, {
      name: 'Renamed',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'blogcategory.updated',
        resourceType: 'BLOG_CATEGORY',
        resourceId: baseEntity.id,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/blog-categories*');
  });

  it('delete soft-deletes, logs audit, and invalidates cache', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    await makeService(repo, makeStorage(), audit).delete(baseEntity.id);
    expect(repo.findById).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.softDelete).toHaveBeenCalledWith(baseEntity.id);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'blogcategory.deleted',
        resourceType: 'BLOG_CATEGORY',
        resourceId: baseEntity.id,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/blog-categories*');
  });

  it('restore looks up the row INCLUDING soft-deleted rows (regression)', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    await makeService(repo, makeStorage(), audit).restore(baseEntity.id);
    expect(repo.findByIdWithDeleted).toHaveBeenCalledWith(baseEntity.id);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.restore).toHaveBeenCalledWith(baseEntity.id);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'blogcategory.restored',
        resourceType: 'BLOG_CATEGORY',
        resourceId: baseEntity.id,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/blog-categories*');
  });

  it('does not log audit nor invalidate cache when a mutation fails the existence check', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const audit = makeAudit();
    await expect(
      makeService(repo, makeStorage(), audit).update(baseEntity.id, {
        name: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
  });

  it('restore throws NotFoundException when the row does not exist at all', async () => {
    const repo = makeRepo({
      findByIdWithDeleted: jest.fn().mockResolvedValue(null),
    });
    await expect(makeService(repo).restore('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.restore).not.toHaveBeenCalled();
  });

  describe('uploadImage', () => {
    it('uploads the file to R2 and stores its public URL', async () => {
      const repo = makeRepo();
      const storage = makeStorage();

      await makeService(repo, storage).uploadImage(baseEntity.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/png',
      });

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^blog-category-images\/.+\.png$/),
        expect.any(Buffer),
        'image/png',
      );
      expect(repo.update).toHaveBeenCalledWith(
        baseEntity.id,
        expect.objectContaining({
          image: expect.stringContaining('blog-category-images/'),
        }),
      );
    });

    it('removes the previous image before uploading the new one', async () => {
      const oldUrl = 'https://cdn.example.com/blog-category-images/old.png';
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ ...baseEntity, image: oldUrl }),
      });
      const storage = makeStorage();

      await makeService(repo, storage).uploadImage(baseEntity.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/webp',
      });

      expect(storage.delete).toHaveBeenCalledWith(
        'blog-category-images/old.png',
      );
      expect(storage.upload).toHaveBeenCalled();
    });

    it('does not throw when old-image cleanup fails (logs instead)', async () => {
      const oldUrl = 'https://cdn.example.com/blog-category-images/old.png';
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ ...baseEntity, image: oldUrl }),
      });
      const storage = makeStorage({
        delete: jest.fn().mockRejectedValue(new Error('R2 unavailable')),
      });

      await expect(
        makeService(repo, storage).uploadImage(baseEntity.id, {
          buffer: Buffer.from('img'),
          mimeType: 'image/png',
        }),
      ).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalled();
      expect(storage.upload).toHaveBeenCalled();
    });

    it('throws NotFoundException when the category does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const storage = makeStorage();

      await expect(
        makeService(repo, storage).uploadImage('missing', {
          buffer: Buffer.from('img'),
          mimeType: 'image/png',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    it('removes the R2 object and clears the image column', async () => {
      const url = 'https://cdn.example.com/blog-category-images/sig.png';
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ ...baseEntity, image: url }),
      });
      const storage = makeStorage();

      await makeService(repo, storage).deleteImage(baseEntity.id);

      expect(storage.delete).toHaveBeenCalledWith(
        'blog-category-images/sig.png',
      );
      expect(repo.update).toHaveBeenCalledWith(baseEntity.id, { image: null });
    });

    it('throws NotFoundException when the category does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const storage = makeStorage();

      await expect(
        makeService(repo, storage).deleteImage('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
