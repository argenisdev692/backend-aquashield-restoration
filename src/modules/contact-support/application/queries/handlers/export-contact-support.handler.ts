import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import PDFDocument from 'pdfkit';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import {
  ExportContactSupportQuery,
  type ExportContactSupportResult,
} from '../export-contact-support.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';
import type { ContactSupportReadModel } from '../../../domain/read-models/contact-support.read-model';
import { csvEscape } from '../../../../../shared/export/export.util';

const CSV_HEADERS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'phone',
  'subject',
  'message',
  'smsConsent',
  'readed',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

@QueryHandler(ExportContactSupportQuery)
export class ExportContactSupportHandler
  implements IQueryHandler<ExportContactSupportQuery>
{
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ExportContactSupportHandler.name);
  }

  async execute(
    query: ExportContactSupportQuery,
  ): Promise<ExportContactSupportResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportContactSupportHandler start', {
      traceId,
      format: query.format,
      trashed: query.trashed,
    });

    const rows = await this.repo.findAllForExport({
      readed: query.readed,
      trashed: query.trashed,
    });

    const { buffer, filename, contentType } =
      query.format === 'pdf'
        ? await this.buildPdf(rows)
        : this.buildCsv(rows);

    await this.audit.log({
      action: 'contact_support.export',
      actorId: query.actorId,
      resourceType: 'CONTACT',
      metadata: {
        format: query.format,
        trashed: query.trashed,
        count: rows.length,
      },
    });

    this.logger.info('ExportContactSupportHandler end', {
      traceId,
      format: query.format,
      count: rows.length,
    });

    return { buffer, filename, contentType };
  }

  private buildCsv(rows: ContactSupportReadModel[]): ExportContactSupportResult {
    const header = CSV_HEADERS.join(',');
    const body = rows
      .map((r) =>
        [
          r.id,
          r.firstName,
          r.lastName,
          r.email,
          r.phone,
          r.subject,
          r.message,
          r.smsConsent,
          r.readed,
          r.createdAt,
          r.updatedAt,
          r.deletedAt ?? '',
        ]
          .map(csvEscape)
          .join(','),
      )
      .join('\r\n');
    const csv = body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;
    // UTF-8 BOM so Excel auto-detects the encoding.
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]);
    return {
      buffer,
      filename: `contact-support-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private buildPdf(
    rows: ContactSupportReadModel[],
  ): Promise<ExportContactSupportResult> {
    return new Promise<ExportContactSupportResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `contact-support-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Contact Support — export', { align: 'left' });
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
            .text(`${r.firstName} ${r.lastName}  <${r.email}>`, {
              continued: false,
            });
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Phone: ${r.phone}  ·  Subject: ${r.subject}  ·  Read: ${
                r.readed ? 'yes' : 'no'
              }${r.deletedAt ? '  ·  DELETED' : ''}`,
            )
            .fillColor('#000');
          doc.fontSize(10).text(r.message, { width: 520 });
          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(`id: ${r.id}    created: ${r.createdAt}`)
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
