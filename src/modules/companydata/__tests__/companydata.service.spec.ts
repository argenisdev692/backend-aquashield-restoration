import { ConflictException, NotFoundException } from '@nestjs/common';
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
  existsAny: jest.fn().mockResolvedValue(false),
  findByUserId: jest.fn().mockResolvedValue(baseRow),
  findById: jest.fn().mockResolvedValue(baseRow),
  create: jest.fn().mockResolvedValue(baseRow),
  update: jest.fn().mockResolvedValue(baseRow),
  delete: jest.fn().mockResolvedValue(undefined),
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

describe('CompanyDataService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findByUserId', () => {
    it('returns the company data row for the user', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      const result = await svc.findByUserId(baseRow.userId);

      expect(repo.findByUserId).toHaveBeenCalledWith(baseRow.userId);
      expect(result).toEqual(baseRow);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('returns null when no record exists', async () => {
      const repo = makeRepo({
        findByUserId: jest.fn().mockResolvedValue(null),
      });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      const result = await svc.findByUserId(baseRow.userId);

      expect(result).toBeNull();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the company data when found', async () => {
      const repo = makeRepo();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      const result = await svc.findById(baseRow.id);

      expect(result).toEqual(baseRow);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await expect(svc.findById(baseRow.id)).rejects.toThrow(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a company when none exists and logs audit + info at start and end', async () => {
      const repo = makeRepo({ existsAny: jest.fn().mockResolvedValue(false) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );
      const dto = { companyName: 'New Corp' };

      await svc.create(baseRow.userId, dto);

      expect(repo.existsAny).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        userId: baseRow.userId,
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.created',
          actorId: baseRow.userId,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.create start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.create end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/company-data*');
    });

    it('throws ConflictException when a company already exists', async () => {
      const repo = makeRepo({ existsAny: jest.fn().mockResolvedValue(true) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await expect(
        svc.create(baseRow.userId, { companyName: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns updated entity and logs audit + info at start and end', async () => {
      const updated = { ...baseRow, companyName: 'Updated Corp' };
      const repo = makeRepo({ update: jest.fn().mockResolvedValue(updated) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      const result = await svc.update(baseRow.id, {
        companyName: 'Updated Corp',
      });

      expect(result.companyName).toBe('Updated Corp');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.updated',
          resourceId: baseRow.id,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.update start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.update end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
    });

    it('throws NotFoundException when record is missing', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await expect(svc.update(baseRow.id, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a record without signature and logs audit + info at start and end', async () => {
      const repo = makeRepo();
      const storage = makeStorage();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await svc.delete(baseRow.id);

      expect(repo.delete).toHaveBeenCalledWith(baseRow.id);
      expect(storage.delete).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'companydata.deleted',
          resourceId: baseRow.id,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.delete start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.delete end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
    });

    it('removes the signature file before deleting the record', async () => {
      const rowWithSig = {
        ...baseRow,
        signaturePath: 'https://cdn.example.com/company-signatures/sig.png',
      };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await svc.delete(baseRow.id);

      expect(storage.delete).toHaveBeenCalledWith('company-signatures/sig.png');
      expect(repo.delete).toHaveBeenCalledWith(baseRow.id);
    });

    it('throws NotFoundException when record does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await expect(svc.delete(baseRow.id)).rejects.toThrow(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('uploadSignature', () => {
    it('uploads new file, updates signaturePath, and logs audit + info at start and end', async () => {
      const repo = makeRepo();
      const storage = makeStorage();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await svc.uploadSignature(baseRow.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/png',
      });

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^company-signatures\/.+\.png$/),
        expect.any(Buffer),
        'image/png',
      );
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
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.uploadSignature start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.uploadSignature end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
    });

    it('deletes the previous signature before uploading the new one', async () => {
      const oldUrl = 'https://cdn.example.com/company-signatures/old.png';
      const rowWithSig = { ...baseRow, signaturePath: oldUrl };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await svc.uploadSignature(baseRow.id, {
        buffer: Buffer.from('img'),
        mimeType: 'image/png',
      });

      // Old file removed BEFORE new upload
      expect(storage.delete).toHaveBeenCalledWith('company-signatures/old.png');
      expect(storage.upload).toHaveBeenCalled();
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
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

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
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

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
    it('removes the file from storage, clears signaturePath, and logs audit + info at start and end', async () => {
      const rowWithSig = {
        ...baseRow,
        signaturePath: 'https://cdn.example.com/company-signatures/sig.png',
      };
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(rowWithSig),
      });
      const storage = makeStorage();
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        storage as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

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
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.deleteSignature start',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'CompanyDataService.deleteSignature end',
        expect.objectContaining({ traceId: 'trace-test' }),
      );
    });

    it('throws NotFoundException when company data is not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const audit = makeAudit();
      const svc = new CompanyDataService(
        repo as never,
        makeStorage() as never,
        cache as never,
        logger as never,
        cls as never,
        audit,
      );

      await expect(svc.deleteSignature(baseRow.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(audit.log).not.toHaveBeenCalled();
    });
  });
});
