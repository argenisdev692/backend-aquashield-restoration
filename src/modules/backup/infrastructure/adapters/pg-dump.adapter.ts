import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * Connection URL is passed as an argv (`-d <url>`). On a single-tenant
 * container that's acceptable; if multi-tenant hosting is on the roadmap,
 * switch to PGSERVICE + .pgpass so the password never appears in argv.
 *
 * Hard 30-minute timeout — pg_dump receives SIGTERM and the file is
 * rejected; the calling handler flips the row to FAILED.
 */
@Injectable()
export class PgDumpAdapter implements IDbDumper {
  private readonly pgDumpBin: string;
  private readonly tmpDir: string;
  private readonly databaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PgDumpAdapter.name);
    this.pgDumpBin = config.get<string>('BACKUP_PG_DUMP_BIN', 'pg_dump');
    this.tmpDir = config.get<string>('BACKUP_TMP_DIR', tmpdir());
    this.databaseUrl = config.getOrThrow<string>('DATABASE_URL');
  }

  async dump(backupId: string): Promise<DbDumpResult> {
    await fs.mkdir(this.tmpDir, { recursive: true });
    const filePath = join(this.tmpDir, `backup-${backupId}.dump`);

    this.logger.info('PgDumpAdapter.dump start', {
      layer: 'adapter',
      backupId,
      filePath,
    });

    await this.runPgDump(filePath);

    const sizeBytes = (await fs.stat(filePath)).size;
    if (sizeBytes === 0) {
      throw new Error('pg_dump produced an empty file');
    }
    const checksum = await this.sha256(filePath);

    this.logger.info('PgDumpAdapter.dump end', {
      layer: 'adapter',
      backupId,
      sizeBytes,
      checksum,
    });
    return { filePath, sizeBytes, checksum };
  }

  private runPgDump(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const out = createWriteStream(filePath);
      const child = spawn(
        this.pgDumpBin,
        ['-Fc', '-Z', COMPRESSION_LEVEL, '-d', this.databaseUrl],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );

      const stderrChunks: Buffer[] = [];
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
      child.stdout.pipe(out);

      const timeout = setTimeout(() => {
        this.logger.error('PgDumpAdapter timeout — killing pg_dump', {
          layer: 'adapter',
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
}
