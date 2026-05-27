import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import {
  csvEscape,
  sheetEscape,
} from '../../../../../shared/export/export.util';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { BackupReadModel } from '../../../domain/read-models/backup.read-model';
import {
  ExportBackupsQuery,
  type ExportBackupsResult,
} from '../export-backups.query';

const EXPORT_MAX_ROWS = 5_000;

const COLUMNS = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'status', key: 'status', width: 12 },
  { header: 'triggeredBy', key: 'triggeredBy', width: 12 },
  { header: 'actorId', key: 'actorId', width: 38 },
  { header: 'objectKey', key: 'objectKey', width: 48 },
  { header: 'sizeBytes', key: 'sizeBytes', width: 14 },
  { header: 'checksum', key: 'checksum', width: 64 },
  { header: 'error', key: 'error', width: 40 },
  { header: 'startedAt', key: 'startedAt', width: 22 },
  { header: 'completedAt', key: 'completedAt', width: 22 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
] as const;

type Row = Record<(typeof COLUMNS)[number]['key'], unknown>;

function toRow(r: BackupReadModel): Row {
  return {
    id: r.id,
    status: r.status,
    triggeredBy: r.triggeredBy,
    actorId: r.actorId ?? '',
    objectKey: r.objectKey ?? '',
    sizeBytes: r.sizeBytes ?? '',
    checksum: r.checksum ?? '',
    error: r.error ?? '',
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : '',
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
@QueryHandler(ExportBackupsQuery)
export class ExportBackupsHandler implements IQueryHandler<ExportBackupsQuery> {
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ExportBackupsHandler.name);
  }

  async execute(query: ExportBackupsQuery): Promise<ExportBackupsResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportBackupsHandler start', {
      traceId,
      format: query.format,
      actorId: query.actorId,
    });

    const rows = await this.repo.findAllForExport(EXPORT_MAX_ROWS);

    const result =
      query.format === 'pdf'
        ? await this.buildPdf(rows)
        : query.format === 'xlsx'
          ? await this.buildXlsx(rows)
          : this.buildCsv(rows);

    await this.audit.log(
      {
        action: 'backups.export',
        actorId: query.actorId,
        resourceType: 'DATABASE_BACKUP',
        metadata: { format: query.format, count: rows.length },
      },
      { strict: false },
    );

    this.logger.info('ExportBackupsHandler end', {
      traceId,
      format: query.format,
      count: rows.length,
    });

    return result;
  }

  private buildCsv(rows: BackupReadModel[]): ExportBackupsResult {
    const header = COLUMNS.map((c) => c.header).join(',');
    const body = rows
      .map((r) => {
        const row = toRow(r);
        return COLUMNS.map((c) => csvEscape(row[c.key])).join(',');
      })
      .join('\r\n');
    const csv =
      body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, 'utf8'),
    ]);
    return {
      buffer,
      filename: `backups-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: BackupReadModel[],
  ): Promise<ExportBackupsResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aquashield Restoration LLC';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Backups');
    sheet.columns = COLUMNS.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      const row = toRow(r);
      const escaped: Record<string, string | number | boolean | null> = {};
      for (const c of COLUMNS) {
        escaped[c.key] = sheetEscape(row[c.key]);
      }
      sheet.addRow(escaped);
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `backups-${this.timestamp()}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(rows: BackupReadModel[]): Promise<ExportBackupsResult> {
    return new Promise<ExportBackupsResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `backups-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Database Backups — export', { align: 'left' });
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text(`Generated: ${new Date().toISOString()}    Rows: ${rows.length}`)
        .fillColor('#000');
      doc.moveDown();

      if (rows.length === 0) {
        doc.fontSize(11).text('No rows to export.');
      } else {
        for (const r of rows) {
          doc
            .fontSize(11)
            .text(
              `${r.status} · ${r.triggeredBy} · ${r.createdAt.toISOString()}`,
            );
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `id: ${r.id}    size: ${r.sizeBytes ?? '—'} bytes    ` +
                `checksum: ${r.checksum ?? '—'}`,
            )
            .fillColor('#000');
          if (r.objectKey) {
            doc.fontSize(9).text(`object: ${r.objectKey}`);
          }
          if (r.error) {
            doc
              .fontSize(9)
              .fillColor('#b91c1c')
              .text(`error: ${r.error}`)
              .fillColor('#000');
          }
          doc.moveDown(0.6);
        }
      }

      doc.end();
    });
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
