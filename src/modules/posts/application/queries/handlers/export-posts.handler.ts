import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  ExportPostsQuery,
  type ExportPostsResult,
} from '../export-posts.query';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type {
  IPostRepository,
  PostFilters,
  PostReadModel,
} from '../../../domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import {
  csvEscape,
  sheetEscape,
} from '../../../../../shared/export/export.util';

const COLUMNS = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'postTitle', key: 'postTitle', width: 30 },
  { header: 'postTitleSlug', key: 'postTitleSlug', width: 30 },
  { header: 'postContent', key: 'postContent', width: 60 },
  { header: 'postExcerpt', key: 'postExcerpt', width: 40 },
  { header: 'postCoverImage', key: 'postCoverImage', width: 40 },
  { header: 'metaTitle', key: 'metaTitle', width: 30 },
  { header: 'metaDescription', key: 'metaDescription', width: 40 },
  { header: 'metaKeywords', key: 'metaKeywords', width: 30 },
  { header: 'categoryId', key: 'categoryId', width: 38 },
  { header: 'categoryName', key: 'categoryName', width: 24 },
  { header: 'userId', key: 'userId', width: 38 },
  { header: 'userName', key: 'userName', width: 24 },
  { header: 'postStatus', key: 'postStatus', width: 14 },
  { header: 'scheduledAt', key: 'scheduledAt', width: 22 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
  { header: 'updatedAt', key: 'updatedAt', width: 22 },
  { header: 'deletedAt', key: 'deletedAt', width: 22 },
] as const;

type Row = Record<(typeof COLUMNS)[number]['key'], unknown>;

function toRow(r: PostReadModel): Row {
  return {
    id: r.id,
    postTitle: r.postTitle,
    postTitleSlug: r.postTitleSlug,
    postContent: r.postContent,
    postExcerpt: r.postExcerpt ?? '',
    postCoverImage: r.postCoverImage ?? '',
    metaTitle: r.metaTitle ?? '',
    metaDescription: r.metaDescription ?? '',
    metaKeywords: r.metaKeywords ?? '',
    categoryId: r.categoryId ?? '',
    categoryName: r.categoryName ?? '',
    userId: r.userId ?? '',
    userName: r.userName ?? '',
    postStatus: r.postStatus,
    scheduledAt: r.scheduledAt ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt ?? '',
  };
}

@Injectable()
@QueryHandler(ExportPostsQuery)
export class ExportPostsHandler
  implements IQueryHandler<ExportPostsQuery>
{
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repo: IPostRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ExportPostsHandler.name);
  }

  async execute(
    query: ExportPostsQuery,
  ): Promise<ExportPostsResult> {
    const { dto, format, userId } = query;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportPostsHandler start', {
      traceId,
      format,
      userId,
    });

    const filters: PostFilters = {
      postStatus: dto.postStatus,
      categoryId: dto.categoryId,
      userId: dto.userId,
      search: dto.search,
      trashed: resolveTrashedMode({
        withTrashed: dto.withTrashed,
        onlyTrashed: dto.onlyTrashed,
      }),
    };

    const { data } = await this.repo.findAll(filters);

    const result =
      format === 'pdf'
        ? await this.buildPdf(data)
        : format === 'xlsx'
          ? await this.buildXlsx(data)
          : this.buildCsv(data);

    await this.audit.log(
      {
        action: 'posts.export',
        actorId: userId,
        metadata: { format, count: data.length },
      },
      { strict: false },
    );

    this.logger.info('ExportPostsHandler end', {
      traceId,
      format,
      count: data.length,
    });

    return result;
  }

  private buildCsv(rows: PostReadModel[]): ExportPostsResult {
    const header = COLUMNS.map((c) => c.header).join(',');
    const body = rows
      .map((r) => {
        const row = toRow(r);
        return COLUMNS.map((c) => csvEscape(row[c.key])).join(',');
      })
      .join('\r\n');
    const csv = body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, 'utf8'),
    ]);
    return {
      buffer,
      filename: `posts-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: PostReadModel[],
  ): Promise<ExportPostsResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Vidula';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Posts');
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
      filename: `posts-${this.timestamp()}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(
    rows: PostReadModel[],
  ): Promise<ExportPostsResult> {
    return new Promise<ExportPostsResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `posts-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Posts — export', { align: 'left' });
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
              `${r.postTitle}` +
                (r.userName ? `  by ${r.userName}` : ''),
            );
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Status: ${r.postStatus}  ·  Slug: ${r.postTitleSlug}` +
                `${r.categoryName ? `  ·  Category: ${r.categoryName}` : ''}` +
                `${r.deletedAt ? '  ·  DELETED' : ''}`,
            );
          if (r.postExcerpt) {
            doc.fontSize(10).text(r.postExcerpt, { width: 520 });
          }
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
