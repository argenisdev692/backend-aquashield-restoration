import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const spawnMock = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// We back the dump file with an in-memory fs map so sha256 + stat work
// without touching disk.
const fsContents = new Map<string, Buffer>();
let nextWriteBuffer: Buffer = Buffer.alloc(0);

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  const { PassThrough: PT, Readable: RD } = jest.requireActual('node:stream');
  return {
    ...actual,
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn(async (p: string) => ({
        size: (fsContents.get(p) ?? Buffer.alloc(0)).length,
      })),
      unlink: jest.fn().mockResolvedValue(undefined),
    },
    createWriteStream: jest.fn((p: string) => {
      const pt = new PT();
      const chunks: Buffer[] = [];
      pt.on('data', (c: Buffer) => chunks.push(c));
      pt.on('finish', () => {
        fsContents.set(p, Buffer.concat(chunks));
      });
      return pt;
    }),
    createReadStream: jest.fn((p: string) => {
      return RD.from(fsContents.get(p) ?? Buffer.alloc(0));
    }),
  };
});

import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { PgDumpAdapter } from '../../infrastructure/adapters/pg-dump.adapter';

function mockConfig(databaseUrl: string): ConfigService {
  return {
    get: jest.fn((k: string, dflt?: unknown) => {
      if (k === 'BACKUP_PG_DUMP_BIN') return dflt ?? 'pg_dump';
      if (k === 'BACKUP_TMP_DIR') return '/tmp';
      return dflt;
    }),
    getOrThrow: jest.fn((k: string) => {
      if (k === 'DATABASE_URL') return databaseUrl;
      throw new Error(`missing ${k}`);
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
    get: jest.fn().mockReturnValue('trace-pg'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

type FakeChild = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: jest.Mock;
};

function fakeChild(): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.stdout = new PassThrough();
  ee.stderr = new PassThrough();
  ee.kill = jest.fn();
  return ee;
}

describe('PgDumpAdapter', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    fsContents.clear();
    nextWriteBuffer = Buffer.from('PGDMP-fake-payload');
  });

  it('runs pg_dump WITHOUT credentials in argv and exports them via PG* env', async () => {
    const child = fakeChild();
    spawnMock.mockImplementationOnce(() => {
      setImmediate(() => {
        child.stdout.write(nextWriteBuffer);
        child.stdout.end();
        child.emit('exit', 0, null);
      });
      return child;
    });

    const adapter = new PgDumpAdapter(
      mockConfig('postgres://app:s3cret@db.host:6543/vidula?sslmode=require'),
      mockLogger(),
      mockCls(),
    );

    const result = await adapter.dump('backup-1');

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [bin, argv, opts] = spawnMock.mock.calls[0]! as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    expect(bin).toBe('pg_dump');
    expect(argv).toEqual(['-Fc', '-Z', '6']);
    // Critical: no DATABASE_URL or password in argv.
    expect(argv.join(' ')).not.toMatch(/s3cret|postgres:\/\//);
    expect(opts.env.PGHOST).toBe('db.host');
    expect(opts.env.PGPORT).toBe('6543');
    expect(opts.env.PGUSER).toBe('app');
    expect(opts.env.PGPASSWORD).toBe('s3cret');
    expect(opts.env.PGDATABASE).toBe('vidula');
    expect(opts.env.PGSSLMODE).toBe('require');

    // path.join uses OS-native separators (`\` on Windows), so just assert
    // the filename rather than the full path.
    expect(result.filePath).toMatch(/backup-backup-1\.dump$/);
    expect(result.sizeBytes).toBe(nextWriteBuffer.length);
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects when pg_dump exits with a non-zero code, surfacing stderr tail', async () => {
    const child = fakeChild();
    spawnMock.mockImplementationOnce(() => {
      setImmediate(() => {
        child.stderr.write('FATAL: connection refused');
        child.stdout.end();
        child.emit('exit', 1, null);
      });
      return child;
    });

    const adapter = new PgDumpAdapter(
      mockConfig('postgres://u:p@h:5432/db'),
      mockLogger(),
      mockCls(),
    );

    await expect(adapter.dump('b1')).rejects.toThrow(
      /pg_dump exited with code=1.*connection refused/s,
    );
  });

  it('rejects an empty dump file with a clear error', async () => {
    nextWriteBuffer = Buffer.alloc(0);
    const child = fakeChild();
    spawnMock.mockImplementationOnce(() => {
      setImmediate(() => {
        child.stdout.end();
        child.emit('exit', 0, null);
      });
      return child;
    });

    const adapter = new PgDumpAdapter(
      mockConfig('postgres://u:p@h:5432/db'),
      mockLogger(),
      mockCls(),
    );

    await expect(adapter.dump('b1')).rejects.toThrow(
      /pg_dump produced an empty file/,
    );
  });

  it('url-decodes special characters in user / password', async () => {
    const child = fakeChild();
    spawnMock.mockImplementationOnce(() => {
      setImmediate(() => {
        child.stdout.write(nextWriteBuffer);
        child.stdout.end();
        child.emit('exit', 0, null);
      });
      return child;
    });

    const adapter = new PgDumpAdapter(
      mockConfig('postgres://us%40er:p%40ss@h:5432/db'),
      mockLogger(),
      mockCls(),
    );

    await adapter.dump('b1');
    const opts = spawnMock.mock.calls[0]![2] as { env: NodeJS.ProcessEnv };
    expect(opts.env.PGUSER).toBe('us@er');
    expect(opts.env.PGPASSWORD).toBe('p@ss');
  });
});
