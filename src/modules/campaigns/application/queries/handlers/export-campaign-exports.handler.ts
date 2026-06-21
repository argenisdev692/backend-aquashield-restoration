import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  ExportCampaignExportsQuery,
  type CampaignExportFileResult,
} from '../export-campaign-exports.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  csvEscape,
  sheetEscape,
} from '../../../../../shared/export/export.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';
import { CompanyBrandingService } from '../../../../companydata/company-branding.service';

const COLUMNS = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'companyName', key: 'companyName', width: 40 },
  { header: 'niche', key: 'niche', width: 40 },
  { header: 'location', key: 'location', width: 30 },
  { header: 'phone', key: 'phone', width: 20 },
  { header: 'status', key: 'status', width: 14 },
  { header: 'stages', key: 'stages', width: 30 },
  { header: 'format', key: 'format', width: 10 },
  { header: 'durationSeconds', key: 'durationSeconds', width: 16 },
  { header: 'language', key: 'language', width: 10 },
  { header: 'generateImages', key: 'generateImages', width: 14 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
  { header: 'updatedAt', key: 'updatedAt', width: 22 },
  { header: 'errorMessage', key: 'errorMessage', width: 50 },
] as const;

type ExportRow = Record<(typeof COLUMNS)[number]['key'], unknown>;

function toRow(item: {
  id: string;
  companyNameSnapshot: string;
  niche: string;
  location: string;
  phone: string;
  status: string;
  stages: string[];
  format: string;
  durationSeconds: number;
  language: string;
  generateImages: boolean;
  createdAt: Date;
  updatedAt: Date;
  errorMessage: string | null;
}): ExportRow {
  return {
    id: item.id,
    companyName: item.companyNameSnapshot,
    niche: item.niche,
    location: item.location,
    phone: item.phone,
    status: item.status,
    stages: item.stages.join(', '),
    format: item.format,
    durationSeconds: item.durationSeconds,
    language: item.language,
    generateImages: item.generateImages,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    errorMessage: item.errorMessage ?? '',
  };
}

@QueryHandler(ExportCampaignExportsQuery)
@Injectable()
export class ExportCampaignExportsHandler implements IQueryHandler<
  ExportCampaignExportsQuery,
  CampaignExportFileResult
> {
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly branding: CompanyBrandingService,
  ) {
    this.logger.setContext(ExportCampaignExportsHandler.name);
  }

  async execute(
    query: ExportCampaignExportsQuery,
  ): Promise<CampaignExportFileResult> {
    const traceId = this.cls.get<string>('traceId');
    const { dto, actorId } = query;

    this.logger.info('ExportCampaignExportsHandler start', {
      traceId,
      actorId,
      format: dto.format,
      status: dto.status,
    });

    const dateRange = resolveDateRange({
      start_date: dto.start_date,
      end_date: dto.end_date,
    });

    const rows = await this.campaignRepo.findForExport(actorId, {
      status: dto.status,
      dateRange,
    });

    const result =
      dto.format === 'pdf'
        ? await this.buildPdf(rows)
        : dto.format === 'xlsx'
          ? await this.buildXlsx(rows)
          : this.buildCsv(rows);

    await this.audit.log(
      {
        action: 'campaigns.list_exported',
        actorId,
        metadata: {
          format: dto.format,
          count: rows.length,
          status: dto.status ?? null,
          start_date: dto.start_date ?? null,
          end_date: dto.end_date ?? null,
        },
      },
      { strict: true },
    );

    this.logger.info('ExportCampaignExportsHandler completed', {
      traceId,
      actorId,
      count: rows.length,
      format: dto.format,
    });

    return result;
  }

  private buildCsv(
    rows: Awaited<ReturnType<ICampaignGenerationRepository['findForExport']>>,
  ): CampaignExportFileResult {
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
      filename: `campaign-exports-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: Awaited<ReturnType<ICampaignGenerationRepository['findForExport']>>,
  ): Promise<CampaignExportFileResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = this.branding.getFallbackName();
    wb.created = new Date();

    const sheet = wb.addWorksheet('CampaignExports');
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
      filename: `campaign-exports-${this.timestamp()}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(
    rows: Awaited<ReturnType<ICampaignGenerationRepository['findForExport']>>,
  ): Promise<CampaignExportFileResult> {
    return new Promise<CampaignExportFileResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `campaign-exports-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Campaign Exports — History', { align: 'left' });
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
          doc.fontSize(11).text(`${r.companyNameSnapshot} — ${r.niche}`);
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Status: ${r.status}  ·  Format: ${r.format}  ·  Stages: ${r.stages.join(', ')}`,
            )
            .fillColor('#000');
          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(
              `id: ${r.id}    created: ${r.createdAt.toISOString()}    phone: ${r.phone}`,
            )
            .fillColor('#000');
          if (r.errorMessage) {
            doc
              .fontSize(8)
              .fillColor('#b91c1c')
              .text(`Error: ${r.errorMessage}`);
          }
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
