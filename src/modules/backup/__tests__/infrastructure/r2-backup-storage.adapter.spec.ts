import { Readable } from 'node:stream';

const sendMock = jest.fn();

class FakeNoSuchKey extends Error {
  readonly name = 'NoSuchKey';
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest
    .fn()
    .mockImplementation((input: Record<string, unknown>) => ({
      input,
      __cmd: 'put',
    })),
  GetObjectCommand: jest
    .fn()
    .mockImplementation((input: Record<string, unknown>) => ({
      input,
      __cmd: 'get',
    })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation((input: Record<string, unknown>) => ({
      input,
      __cmd: 'del',
    })),
  NoSuchKey: FakeNoSuchKey,
}));

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    createReadStream: jest.fn(() => Readable.from(Buffer.from('payload'))),
  };
});

import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { R2BackupStorageAdapter } from '../../infrastructure/adapters/r2-backup-storage.adapter';

function mockConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const env: Record<string, unknown> = {
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'shared-bucket',
    BACKUP_R2_PREFIX: 'backups',
    ...overrides,
  };
  return {
    get: jest.fn((k: string, dflt?: unknown) => (k in env ? env[k] : dflt)),
    getOrThrow: jest.fn((k: string) => {
      if (!(k in env)) throw new Error(`missing ${k}`);
      return env[k];
    }),
  } as unknown as ConfigService;
}

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
  return {
    get: jest.fn().mockReturnValue('trace-r2'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

describe('R2BackupStorageAdapter', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('uploadFromFile builds a date-prefixed key and uses no-store cache', async () => {
    sendMock.mockResolvedValueOnce({});
    const adapter = new R2BackupStorageAdapter(
      mockConfig(),
      mockLogger(),
      mockCls(),
    );

    const { objectKey } = await adapter.uploadFromFile({
      backupId: 'backup-1',
      filePath: '/tmp/backup-1.dump',
      sizeBytes: 100,
    });

    expect(objectKey).toMatch(/^backups\/\d{4}\/\d{2}\/\d{2}\/backup-1\.dump$/);
    const putCall = sendMock.mock.calls[0]![0] as {
      input: {
        Bucket: string;
        Key: string;
        ContentLength: number;
        CacheControl: string;
      };
    };
    expect(putCall.input.Bucket).toBe('shared-bucket');
    expect(putCall.input.Key).toBe(objectKey);
    expect(putCall.input.ContentLength).toBe(100);
    expect(putCall.input.CacheControl).toBe('private, no-store');
  });

  it('uses BACKUP_R2_BUCKET_NAME override when set', async () => {
    sendMock.mockResolvedValueOnce({});
    const adapter = new R2BackupStorageAdapter(
      mockConfig({ BACKUP_R2_BUCKET_NAME: 'isolated-backups' }),
      mockLogger(),
      mockCls(),
    );

    await adapter.uploadFromFile({
      backupId: 'b',
      filePath: '/tmp/b.dump',
      sizeBytes: 1,
    });

    const putCall = sendMock.mock.calls[0]![0] as { input: { Bucket: string } };
    expect(putCall.input.Bucket).toBe('isolated-backups');
  });

  it('delete swallows transport errors (best-effort) and logs WARN', async () => {
    sendMock.mockRejectedValueOnce(new Error('R2 down'));
    const logger = mockLogger();
    const adapter = new R2BackupStorageAdapter(mockConfig(), logger, mockCls());

    await expect(adapter.delete('some/key.dump')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'R2BackupStorageAdapter.delete failed',
      expect.objectContaining({ objectKey: 'some/key.dump' }),
    );
  });

  it('download returns body+contentLength on success', async () => {
    const body = Readable.from(Buffer.from('payload'));
    sendMock.mockResolvedValueOnce({ Body: body, ContentLength: 7 });
    const adapter = new R2BackupStorageAdapter(
      mockConfig(),
      mockLogger(),
      mockCls(),
    );

    const result = await adapter.download('some/key.dump');

    expect(result.body).toBe(body);
    expect(result.contentLength).toBe(7);
  });

  it('download maps NoSuchKey to a friendly missing-artifact error', async () => {
    sendMock.mockRejectedValueOnce(new FakeNoSuchKey('not here'));
    const adapter = new R2BackupStorageAdapter(
      mockConfig(),
      mockLogger(),
      mockCls(),
    );

    await expect(adapter.download('gone.dump')).rejects.toThrow(
      /Backup object missing in storage/,
    );
  });
});
