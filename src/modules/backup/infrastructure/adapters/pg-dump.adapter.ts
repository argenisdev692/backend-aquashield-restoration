import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { DbDumpResult, IDbDumper } from '../../domain/ports/db-dumper.port';

const PG_DUMP_TIMEOUT_MS = 30 * 60 * 1_000;
const STDERR_TAIL_CHARS = 4_000;
const COMPRESSION_LEVEL = '6';

/**
 * Shells out to `pg_dump` in PostgreSQL custom format (-Fc) and streams
 * the output to a temp file. Custom format is required so the artifact
 * can later be restored with `pg_restore` and is compressed natively.
 *
 * Credentials are passed to the child process via PG* environment
 * variables (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE),
 * parsed from DATABASE_URL. Argv contains ONLY the dump flags so the
 * password is never visible in `ps`/`/proc/<pid>/cmdline`.
 *
 * Hard 30-minute timeout — pg_dump receives SIGTERM and the file is
 * rejected; the calling handler flips the row to FAILED.
 */
@Injectable()
export class PgDumpAdapter implements IDbDumper {
  private readonly pgDumpBin: string;
  private readonly tmpDir: string;
  private readonly pgEnv: NodeJS.ProcessEnv;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(PgDumpAdapter.name);
    this.pgDumpBin = config.get<string>('BACKUP_PG_DUMP_BIN', 'pg_dump');
    this.tmpDir = config.get<string>('BACKUP_TMP_DIR', tmpdir());
    this.pgEnv = this.buildPgEnv(config.getOrThrow<string>('DATABASE_URL'));
  }

  async dump(backupId: string): Promise<DbDumpResult> {
    await fs.mkdir(this.tmpDir, { recursive: true });
    const filePath = join(this.tmpDir, `backup-${backupId}.dump`);
    const traceId = this.cls.isActive() ? this.cls.get<string>('traceId') : undefined;

    this.logger.info('PgDumpAdapter.dump start', {
      layer: 'adapter',
      traceId,
      backupId,
      filePath,
    });

    await this.runPgDump(filePath, traceId);

    const sizeBytes = (await fs.stat(filePath)).size;
    if (sizeBytes === 0) {
      throw new Error('pg_dump produced an empty file');
    }
    const checksum = await this.sha256(filePath);

    this.logger.info('PgDumpAdapter.dump end', {
      layer: 'adapter',
      traceId,
      backupId,
      sizeBytes,
      checksum,
    });
    return { filePath, sizeBytes, checksum };
  }

  private runPgDump(filePath: string, traceId: string | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
      const out = createWriteStream(filePath);
      const child = spawn(
        this.pgDumpBin,
        ['-Fc', '-Z', COMPRESSION_LEVEL],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          // Credentials live in env, not argv — keeps the password out of
          // `ps` / `/proc/<pid>/cmdline`. We inherit nothing else so a
          // host-level PG* leak cannot redirect the dump elsewhere.
          env: this.pgEnv,
        },
      );

      const stderrChunks: Buffer[] = [];
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
      child.stdout.pipe(out);

      const timeout = setTimeout(() => {
        this.logger.error('PgDumpAdapter timeout — killing pg_dump', {
          layer: 'adapter',
          traceId,
          filePath,
        });
        child.kill('SIGTERM');
      }, PG_DUMP_TIMEOUT_MS);

      const finish = (err?: Error): void => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      };

      child.on('error', (err) => {
        out.destroy();
        finish(err);
      });

      child.on('exit', (code, signal) => {
        out.end(() => {
          if (code === 0) return finish();
          const stderrTail = Buffer.concat(stderrChunks)
            .toString('utf8')
            .slice(-STDERR_TAIL_CHARS);
          finish(
            new Error(
              `pg_dump exited with code=${code} signal=${signal}: ${stderrTail}`,
            ),
          );
        });
      });

      out.on('error', (err) => {
        child.kill('SIGTERM');
        finish(err);
      });
    });
  }

  private async sha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    await pipeline(createReadStream(filePath), hash);
    return hash.digest('hex');
  }

  /**
   * Parses `postgres://user:pass@host:port/db?sslmode=require` into the
   * `PG*` env vars `pg_dump` reads natively. Returns a fresh object — we
   * do NOT spread `process.env` so the child sees ONLY what we set, which
   * blocks ambient `PGSERVICE`/`PGPASSFILE` from redirecting the dump.
   */
  private buildPgEnv(databaseUrl: string): NodeJS.ProcessEnv {
    const url = new URL(databaseUrl);
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? '',
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
    if (url.username) env.PGUSER = decodeURIComponent(url.username);
    if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode) env.PGSSLMODE = sslmode;
    return env;
  }
}
