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
  delete: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeStorage = (overrides: Record<string, jest.Mock> = {}) => ({
  upload: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  publicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  keyFromUrl: jest.fn((url: string) => {
    const prefix = 'https://cdn.example.com/';
    if (!url.startsWith(prefix)) throw new Error(`URL does not belong to this storage bucket: ${url}`);
    return url.slice(prefix.length);
  }),
  ...overrides,
});

describe('CompanyDataService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findByUserId', () => {
    it('returns the company data row for the user', async () => {
      const repo = makeRepo();
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      const result = await svc.findByUserId(baseRow.userId);

      expect(repo.findByUserId).toHaveBeenCalledWith(baseRow.userId);
      expect(result).toEqual(baseRow);
    });

    it('returns null when no record exists', async () => {
      const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      const result = await svc.findByUserId(baseRow.userId);

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the company data when found', async () => {
      const repo = makeRepo();
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      const result = await svc.findById(baseRow.id);

      expect(result).toEqual(baseRow);
    });

    it('throws NotFoundException when not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(svc.findById(baseRow.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a company when none exists', async () => {
      const repo = makeRepo({ existsAny: jest.fn().mockResolvedValue(false) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);
      const dto = { companyName: 'New Corp' };

      await svc.create(baseRow.userId, dto);

      expect(repo.existsAny).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId: baseRow.userId });
    });

    it('throws ConflictException when a company already exists', async () => {
      const repo = makeRepo({ existsAny: jest.fn().mockResolvedValue(true) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(svc.create(baseRow.userId, { companyName: 'Duplicate' })).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns updated entity', async () => {
      const updated = { ...baseRow, companyName: 'Updated Corp' };
      const repo = makeRepo({ update: jest.fn().mockResolvedValue(updated) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      const result = await svc.update(baseRow.id, { companyName: 'Updated Corp' });

      expect(result.companyName).toBe('Updated Corp');
    });

    it('throws NotFoundException when record is missing', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(svc.update(baseRow.id, {})).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a record without signature', async () => {
      const repo = makeRepo();
      const storage = makeStorage();
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await svc.delete(baseRow.id);

      expect(repo.delete).toHaveBeenCalledWith(baseRow.id);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('removes the signature file before deleting the record', async () => {
      const rowWithSig = { ...baseRow, signaturePath: 'https://cdn.example.com/company-signatures/sig.png' };
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(rowWithSig) });
      const storage = makeStorage();
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await svc.delete(baseRow.id);

      expect(storage.delete).toHaveBeenCalledWith('company-signatures/sig.png');
      expect(repo.delete).toHaveBeenCalledWith(baseRow.id);
    });

    it('throws NotFoundException when record does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(svc.delete(baseRow.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadSignature', () => {
    it('uploads new file and updates signaturePath', async () => {
      const repo = makeRepo();
      const storage = makeStorage();
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await svc.uploadSignature(baseRow.id, { buffer: Buffer.from('img'), mimeType: 'image/png' });

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^company-signatures\/.+\.png$/),
        expect.any(Buffer),
        'image/png',
      );
      expect(repo.update).toHaveBeenCalledWith(
        baseRow.id,
        expect.objectContaining({ signaturePath: expect.stringContaining('company-signatures/') }),
      );
    });

    it('deletes the previous signature before uploading the new one', async () => {
      const oldUrl = 'https://cdn.example.com/company-signatures/old.png';
      const rowWithSig = { ...baseRow, signaturePath: oldUrl };
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(rowWithSig) });
      const storage = makeStorage();
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await svc.uploadSignature(baseRow.id, { buffer: Buffer.from('img'), mimeType: 'image/png' });

      // Old file removed BEFORE new upload
      expect(storage.delete).toHaveBeenCalledWith('company-signatures/old.png');
      expect(storage.upload).toHaveBeenCalled();
    });

    it('logs an error (does not throw) when old-signature deletion fails', async () => {
      const oldUrl = 'https://cdn.example.com/company-signatures/old.png';
      const rowWithSig = { ...baseRow, signaturePath: oldUrl };
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(rowWithSig) });
      const storage = makeStorage({ delete: jest.fn().mockRejectedValue(new Error('R2 unavailable')) });
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await expect(
        svc.uploadSignature(baseRow.id, { buffer: Buffer.from('img'), mimeType: 'image/png' }),
      ).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws NotFoundException when company data is not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(
        svc.uploadSignature(baseRow.id, { buffer: Buffer.from('img'), mimeType: 'image/png' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSignature', () => {
    it('removes the file from storage and clears signaturePath', async () => {
      const rowWithSig = { ...baseRow, signaturePath: 'https://cdn.example.com/company-signatures/sig.png' };
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(rowWithSig) });
      const storage = makeStorage();
      const svc = new CompanyDataService(repo as never, storage as never, logger as never, cls as never);

      await svc.deleteSignature(baseRow.id);

      expect(storage.delete).toHaveBeenCalledWith('company-signatures/sig.png');
      expect(repo.update).toHaveBeenCalledWith(baseRow.id, { signaturePath: null });
    });

    it('throws NotFoundException when company data is not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new CompanyDataService(repo as never, makeStorage() as never, logger as never, cls as never);

      await expect(svc.deleteSignature(baseRow.id)).rejects.toThrow(NotFoundException);
    });
  });
});
