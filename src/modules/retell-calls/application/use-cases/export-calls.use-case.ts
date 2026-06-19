import { Inject, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type RetellCallReadModel,
} from '../../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../domain/ports/outbound/audit.port.interface';
import { ExportService } from '../../../../shared/export/export.service';
import type { ExportColumn } from '../../../../shared/export/export.service';
import { resolveTrashedMode } from '../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../shared/crud/date-range.util';
import type { ExportCallsInput } from '../dtos/export-calls.dto';

export interface ExportCallsResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const COLUMNS: ExportColumn[] = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'callId', key: 'callId', width: 34 },
  { header: 'direction', key: 'direction', width: 12 },
  { header: 'fromNumber', key: 'fromNumber', width: 18 },
  { header: 'toNumber', key: 'toNumber', width: 18 },
  { header: 'callStatus', key: 'callStatus', width: 14 },
  { header: 'userSentiment', key: 'userSentiment', width: 14 },
  { header: 'durationMs', key: 'durationMs', width: 12 },
  { header: 'startedAt', key: 'startedAt', width: 22 },
  { header: 'endedAt', key: 'endedAt', width: 22 },
  { header: 'callSummary', key: 'callSummary', width: 50 },
  { header: 'recordingUrl', key: 'recordingUrl', width: 50 },
  { header: 'isRead', key: 'isRead', width: 8 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
  { header: 'deletedAt', key: 'deletedAt', width: 22 },
];

function toExportRow(r: RetellCallReadModel): Record<string, unknown> {
  return {
    id: r.id,
    callId: r.callId,
    direction: r.direction ?? '',
    fromNumber: r.fromNumber ?? '',
    toNumber: r.toNumber ?? '',
    callStatus: r.callStatus ?? '',
    userSentiment: r.userSentiment ?? '',
    durationMs: r.durationMs ?? '',
    startedAt: r.startedAt ? r.startedAt.toISOString() : '',
    endedAt: r.endedAt ? r.endedAt.toISOString() : '',
    callSummary: r.callSummary ?? '',
    recordingUrl: r.recordingUrl ?? '',
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : '',
  };
}

@Injectable()
export class ExportCallsUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly exporter: ExportService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ExportCallsUseCase.name);
  }

  async execute(
    dto: ExportCallsInput,
    actorId?: string,
  ): Promise<ExportCallsResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Exporting Retell calls', {
      traceId,
      format: dto.format,
      actorId,
    });
    const mode = resolveTrashedMode({
      status: dto.status,
      withTrashed: dto.withTrashed,
      onlyTrashed: dto.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: dto.start_date,
      end_date: dto.end_date,
    });

    const rows = await this.repo.findForExport(
      {
        search: dto.search,
        callStatus: dto.callStatus,
        userSentiment: dto.userSentiment,
      },
      mode,
      range,
    );

    const result =
      dto.format === 'pdf'
        ? await this.buildPdf(rows)
        : await this.buildTabular(rows, dto.format);

    await this.audit.log(
      {
        action: 'call-records.export',
        actorId,
        traceId,
        metadata: { format: dto.format, count: rows.length },
      },
      { strict: false },
    );

    this.logger.info('Retell calls export ready', {
      traceId,
      format: dto.format,
      count: rows.length,
    });
    return result;
  }

  private async buildTabular(
    rows: RetellCallReadModel[],
    format: 'csv' | 'xlsx',
  ): Promise<ExportCallsResult> {
    const buffer = await this.exporter.generate(
      {
        columns: COLUMNS,
        rows: rows.map(toExportRow),
        sheetName: 'Call Records',
      },
      format,
    );
    return {
      buffer,
      filename: `call-records-${this.timestamp()}.${format}`,
      contentType:
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(rows: RetellCallReadModel[]): Promise<ExportCallsResult> {
    return new Promise<ExportCallsResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `call-records-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Retell call records — export');
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
            .text(`${r.fromNumber ?? '—'} → ${r.toNumber ?? '—'}`);
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Status: ${r.callStatus ?? '—'}  ·  Sentiment: ${
                r.userSentiment ?? '—'
              }  ·  Duration: ${
                r.durationMs != null
                  ? `${Math.round(r.durationMs / 1000)}s`
                  : '—'
              }  ·  Read: ${r.isRead ? 'yes' : 'no'}${
                r.deletedAt ? '  ·  DELETED' : ''
              }`,
            )
            .fillColor('#000');
          if (r.callSummary) {
            doc.fontSize(10).text(r.callSummary, { width: 520 });
          }
          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(
              `call_id: ${r.callId}    started: ${
                r.startedAt ? r.startedAt.toISOString() : '—'
              }`,
            )
            .fillColor('#000');
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
