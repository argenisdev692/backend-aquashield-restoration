import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import {
  ExportSocialMediaCommand,
  type ExportSocialMediaResult,
} from '../export-social-media.command';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService as NestClsService } from 'nestjs-cls';
import { csvEscape, sheetEscape } from '../../../../../shared/export/export.util';
import type { SocialMediaGeneration } from '../../../domain/entities/social-media-generation.entity';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const COLUMNS = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'userId', key: 'userId', width: 38 },
  { header: 'niche', key: 'niche', width: 40 },
  { header: 'topicTitle', key: 'topicTitle', width: 50 },
  { header: 'topicDescription', key: 'topicDescription', width: 60 },
  { header: 'language', key: 'language', width: 10 },
  { header: 'networks', key: 'networks', width: 30 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
] as const;

type Row = Record<(typeof COLUMNS)[number]['key'], unknown>;

function toRow(g: SocialMediaGeneration): Row {
  const networks = Object.keys(g.networks)
    .filter((k) => g.networks[k as keyof typeof g.networks])
    .join(', ');
  return {
    id: g.id,
    userId: g.userId,
    niche: g.niche,
    topicTitle: g.topicTitle,
    topicDescription: g.topicDescription ?? '',
    language: g.language ?? '',
    networks,
    createdAt: g.createdAt,
  };
}

@CommandHandler(ExportSocialMediaCommand)
@Injectable()
export class ExportSocialMediaHandler implements ICommandHandler<ExportSocialMediaCommand> {
  constructor(
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: NestClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(ExportSocialMediaHandler.name);
  }

  async execute(command: ExportSocialMediaCommand): Promise<ExportSocialMediaResult> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    this.logger.info('ExportSocialMediaHandler start', { traceId, format: dto.format });

    const { data } = await this.repo.findAll(
      {
        niche: dto.niche,
        language: dto.language,
        network: dto.network,
        from: dto.from ? new Date(dto.from) : undefined,
        to: dto.to ? new Date(dto.to) : undefined,
      },
      1,
      5000,
    );

    const result =
      dto.format === 'pdf'
        ? await this.buildPdf(data)
        : dto.format === 'xlsx'
          ? await this.buildXlsx(data)
          : this.buildCsv(data);

    await this.audit.log(
      {
        action: 'social-media.export',
        actorId,
        metadata: { format: dto.format, count: data.length },
      },
      { strict: true },
    );

    this.eventEmitter.emit('social-media.exported', {
      actorId,
      format: dto.format,
      count: data.length,
    });

    this.logger.info('ExportSocialMediaHandler end', { traceId, count: data.length });

    return result;
  }

  private buildCsv(rows: SocialMediaGeneration[]): ExportSocialMediaResult {
    const header = COLUMNS.map((c) => c.header).join(',');
    const body = rows
      .map((r) => {
        const row = toRow(r);
        return COLUMNS.map((c) => csvEscape(row[c.key as keyof Row])).join(',');
      })
      .join('\r\n');
    const csv = body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, 'utf8'),
    ]);
    return {
      buffer,
      filename: `social-media-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: SocialMediaGeneration[],
  ): Promise<ExportSocialMediaResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aquashield Restoration LLC';
    wb.created = new Date();

    const sheet = wb.addWorksheet('SocialMedia');
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
      filename: `social-media-${this.timestamp()}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(rows: SocialMediaGeneration[]): Promise<ExportSocialMediaResult> {
    return new Promise<ExportSocialMediaResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `social-media-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Social Media Generations — Export', { align: 'left' });
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
          const nets = Object.keys(r.networks)
            .filter((k) => r.networks[k as keyof typeof r.networks])
            .join(', ');
          doc.fontSize(11).text(`${r.topicTitle}`);
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(`Niche: ${r.niche}  ·  Networks: ${nets || '—'}`)
            .fillColor('#000');
          if (r.topicDescription) {
            doc.fontSize(9).text(r.topicDescription.slice(0, 120) + (r.topicDescription.length > 120 ? '...' : ''));
          }
          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(`id: ${r.id}    created: ${r.createdAt.toISOString()}`)
            .fillColor('#000');
          doc.moveDown(0.5);
        }
      }

      doc.end();
    });
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
