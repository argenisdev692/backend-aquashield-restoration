import { NotFoundException } from '@nestjs/common';
import { CompanyDataService } from '../companydata.service';

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

const makeTx = () => ({
  runInTx: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
});

const baseRow = {
  id: '018f0000-0000-7000-8000-000000000001',
  companyName: 'Acme Corp',
  name: 'John Doe',
  signaturePath: null,
  email: 'john@acme.com',
  phone: null,
  address: null,
  address2: null,
  website: null,
  facebookLink: null,
  instagramLink: null,
  linkedinLink: null,
  twitterLink: null,
  userId: '018f0000-0000-7000-8000-000000000002',
  latitude: null,
  longitude: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findByUserId: jest.fn().mockResolvedValue(baseRow),
  findById: jest.fn().mockResolvedValue(baseRow),
  findFirst: jest.fn().mockResolvedValue(baseRow),
  update: jest.fn().mockResolvedValue(baseRow),
  ...overrides,
});

const makeStorage = (overrides: Record<string, jest.Mock> = {}) => ({
  upload: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  publicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  keyFromUrl: jest.fn((url: string) => {
    const prefix = 'https://cdn.example.com/';
    if (!url.startsWith(prefix))
      throw new Error(`URL does not belong to this storage bucket: ${url}`);
    return url.slice(prefix.length);
  }),
  ...overrides,
});

const makeService = (
  repo: ReturnType<typeof makeRepo>,
  storage: ReturnType<typeof makeStorage> = makeStorage(),
  audit: ReturnType<typeof makeAudit> = makeAudit(),
  tx: ReturnType<typeof makeTx> = makeTx(),
) =>
  ({
    svc: new CompanyDataService(
      repo as never,
      storage as never,
      cache as never,
      logger as never,
      cls as never,
      audit,
      tx as never,
    ),
    storage,
    audit,
    tx,
  }) as const;

describe('CompanyDataService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findByUserId', () => {
    it('returns the company data row for the user', async () => {
      const repo = makeRepo();
      const { svc, audit } = makeService(repo);

      const result = await svc.findByUserId(baseRow.userId);

      expect(repo.findByUserId).toHaveBeenCalledWith(baseRow.userId);
      expect(result).toEqual(baseRow);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('returns null when no record exists', async () => {
      const repo = makeRepo({
        findByUserId: jest.fn().mockResolvedValue(null),
      });
      const { svc } = makeService(repo);

      expect(await svc.findByUserId(baseRow.userId)).toBeNull();
    });
  });

  describe('findSingletonOrFail', () => {
    it('returns the singleton company row', async () => {
      const repo = makeRepo();
      const { svc } = makeService(repo);

      const result = await svc.findSingletonOrFail();

      expect(repo.findFirst).toHaveBeenCalled();
      expect(result).toEqual(baseRow);
    });

    it('throws NotFoundException when no company exists', async () => {
      const repo = makeRepo({ findFirst: jest.fn().mockResolvedValue(null) });
      const { svc } = makeService(repo);

      await expect(svc.findSingletonOrFail()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('returns the company data when found', async () => {
      const repo = makeRepo();
      const { svc } = makeService(repo);

      const result = await svc.findById(baseRow.id);
      expect(result).toEqual(baseRow);
    });

    it('throws NotFoundException when not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const { svc } = makeService(repo);

      await expect(svc.findById(baseRow.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('returns updated entity and logs audit + info at start and end', async () => {
      const updated = { ...baseRow, companyName: 'Updated Corp' };
      const repo = makeRepo({ update: jest.fn().mockResolvedValue(updated) });
      const { svc, audit } = makeService(repo);

      const result = await svc.update(baseRow.id, {
        companyName: 'Updated Corp',
      });

      expect(result.companyName).toBe('Updated Corp');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.updated',
          resourceId: baseRow.id,
        }),
        { strict: true },
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.update start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.update end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/company-data*');
    });

    it('throws NotFoundException when record is missing', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const { svc, audit } = makeService(repo);

      await expect(svc.update(baseRow.id, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('uploadSignature', () => {
    it('uploads, updates DB, then deletes the previous signature (replace order)', async () => {
      const oldUrl = 'https://cdn.example.com/company-signatures/old.png';
      const rowWithSig = { ...baseRow, signaturePath: oldUrl };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage();
      const order: string[] = [];
      storage.upload.mockImplementation(async () => {
        order.push('upload');
      });
      repo.update.mockImplementation(async () => {
        order.push('db-update');
        return baseRow;
      });
      storage.delete.mockImplementation(async () => {
        order.push('delete-old');
      });

      const { svc, audit } = makeService(repo, storage);

      await svc.uploadSignature(baseRow.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/png',
      });

      expect(order).toEqual(['upload', 'db-update', 'delete-old']);
      expect(storage.delete).toHaveBeenCalledWith('company-signatures/old.png');
      expect(repo.update).toHaveBeenCalledWith(
        baseRow.id,
        expect.objectContaining({
          signaturePath: expect.stringContaining('company-signatures/'),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.signature_uploaded',
          resourceId: baseRow.id,
        }),
        { strict: true },
      );
    });

    it('uses the right extension for image/jpeg (jpg, not jpeg)', async () => {
      const repo = makeRepo();
      const storage = makeStorage();
      const { svc } = makeService(repo, storage);

      await svc.uploadSignature(baseRow.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
      });

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^company-signatures\/.+\.jpg$/),
        expect.any(Buffer),
        'image/jpeg',
      );
    });

    it('rolls back the uploaded file when the DB update fails', async () => {
      const repo = makeRepo({
        update: jest.fn().mockRejectedValue(new Error('db down')),
      });
      const storage = makeStorage();
      const { svc } = makeService(repo, storage);

      await expect(
        svc.uploadSignature(baseRow.id, {
          buffer: Buffer.from('img'),
          mimeType: 'image/png',
        }),
      ).rejects.toThrow('db down');

      expect(storage.upload).toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledWith(
        expect.stringMatching(/^company-signatures\/.+\.png$/),
      );
    });

    it('logs an error (does not throw) when old-signature deletion fails', async () => {
      const oldUrl = 'https://cdn.example.com/company-signatures/old.png';
      const rowWithSig = { ...baseRow, signaturePath: oldUrl };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage({
        delete: jest.fn().mockRejectedValue(new Error('R2 unavailable')),
      });
      const { svc } = makeService(repo, storage);

      await expect(
        svc.uploadSignature(baseRow.id, {
          buffer: Buffer.from('img'),
          mimeType: 'image/png',
        }),
      ).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws NotFoundException when company data is not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const { svc, audit } = makeService(repo);

      await expect(
        svc.uploadSignature(baseRow.id, {
          buffer: Buffer.from('img'),
          mimeType: 'image/png',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('deleteSignature', () => {
    it('removes the file from storage, clears signaturePath, and logs audit', async () => {
      const rowWithSig = {
        ...baseRow,
        signaturePath: 'https://cdn.example.com/company-signatures/sig.png',
      };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage();
      const { svc, audit } = makeService(repo, storage);

      await svc.deleteSignature(baseRow.id);

      expect(storage.delete).toHaveBeenCalledWith('company-signatures/sig.png');
      expect(repo.update).toHaveBeenCalledWith(baseRow.id, {
        signaturePath: null,
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.signature_deleted',
          resourceId: baseRow.id,
        }),
        { strict: true },
      );
    });

    it('throws NotFoundException when company data is not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const { svc, audit } = makeService(repo);

      await expect(svc.deleteSignature(baseRow.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(audit.log).not.toHaveBeenCalled();
    });
  });
});
