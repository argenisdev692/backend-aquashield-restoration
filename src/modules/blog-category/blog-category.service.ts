import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BlogCategoryRepository } from './blog-category.repository';
import type { BlogCategory } from './blog-category.entity';
import type { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import type { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { StorageService } from '../../shared/storage/storage.service';
import { CacheService } from '../../shared/cache/cache.service';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../shared/database/transaction-manager.port';
import {
  resolveTrashedMode,
  type TrashedMode,
} from '../../shared/crud/trashed.util';
import { csvEscape, sheetEscape } from '../../shared/export/export.util';

@Injectable()
export class BlogCategoryService {
  private readonly imageDirectory = 'blog-category-images';
  /** Matches the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private readonly cacheKeyPattern = 'http:*:/blog-categories*';

  constructor(
    private readonly repository: BlogCategoryRepository,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(BlogCategoryService.name);
  }

  async findAll(
    userId: string,
    limit = 50,
    skip = 0,
    trashed: TrashedMode = 'exclude',
  ): Promise<BlogCategory[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findAll', {
      traceId,
      userId,
      limit,
      skip,
      trashed,
    });
    return this.repository.findAll(userId, limit, skip, trashed);
  }

  async findById(
    userId: string,
    id: string,
    withTrashed: boolean = false,
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findById', {
      traceId,
      userId,
      id,
      withTrashed,
    });
    const result = await this.repository.findById(userId, id, withTrashed);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  async create(
    userId: string,
    dto: CreateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.create start', { traceId, userId });

    if (dto.name) {
      const existing = await this.repository.findByName(userId, dto.name);
      if (existing) {
        throw new ConflictException(
          'Category with this name already exists',
        );
      }
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.create({ ...dto, userId });
      await this.audit.log(
        {
          action: 'blogcategory.created',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: row.id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.create end', {
      traceId,
      blogCategoryId: result.id,
    });
    return result;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.update start', {
      traceId,
      userId,
      id,
    });
    const existing = await this.findOrFail(userId, id);

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.repository.findByName(userId, dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, dto);
      await this.audit.log(
        {
          action: 'blogcategory.updated',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.update end', { traceId, id });
    return result;
  }

  async delete(userId: string, id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.delete start', {
      traceId,
      userId,
      id,
    });
    await this.findOrFail(userId, id);

    await this.tx.runInTx(async () => {
      // Soft delete only: the R2 image is intentionally kept so restore() can
      // bring the record back with its image intact. (Unlike companydata, which
      // hard-deletes and therefore removes the file.)
      await this.repository.softDelete(id);
      await this.audit.log(
        {
          action: 'blogcategory.deleted',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.delete end', { traceId, id });
  }

  async uploadImage(
    userId: string,
    id: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.uploadImage start', {
      traceId,
      userId,
      id,
    });

    const existing = await this.findOrFail(userId, id);

    const ext = file.mimeType.split('/').at(1) ?? 'bin';
    const key = `${this.imageDirectory}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimeType);

    let result: BlogCategory;
    try {
      result = await this.tx.runInTx(async () => {
        const row = await this.repository.update(id, {
          image: this.storage.publicUrl(key),
        });
        await this.audit.log(
          {
            action: 'blogcategory.image_uploaded',
            actorId: userId,
            resourceType: 'BLOG_CATEGORY',
            resourceId: id,
          },
          { strict: true },
        );
        return row;
      });
    } catch (error) {
      await this.deleteImageFileByKey(key);
      throw error;
    }

    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.uploadImage end', { traceId, id });
    return result;
  }

  async deleteImage(userId: string, id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.deleteImage start', {
      traceId,
      userId,
      id,
    });

    const existing = await this.findOrFail(userId, id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, { image: null });
      await this.audit.log(
        {
          action: 'blogcategory.image_deleted',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.deleteImage end', { traceId, id });
    return result;
  }

  async restore(userId: string, id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.restore start', {
      traceId,
      userId,
      id,
    });
    await this.findOrFailWithDeleted(userId, id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.restore(id);
      await this.audit.log(
        {
          action: 'blogcategory.restored',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.restore end', { traceId, id });
    return result;
  }

  async bulkDelete(
    actorId: string,
    ids: string[],
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.bulkDelete start', {
      traceId,
      actorId,
      idsCount: ids.length,
    });

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkDelete(actorId, ids);
      await this.audit.log(
        {
          action: 'blogcategory.bulk_deleted',
          actorId,
          resourceType: 'BLOG_CATEGORY',
          ...(ids.length === 1 ? { resourceId: ids[0] } : {}),
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.bulkDelete end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  async bulkRestore(
    actorId: string,
    ids: string[],
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.bulkRestore start', {
      traceId,
      actorId,
      idsCount: ids.length,
    });

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkRestore(actorId, ids);
      await this.audit.log(
        {
          action: 'blogcategory.bulk_restored',
          actorId,
          resourceType: 'BLOG_CATEGORY',
          ...(ids.length === 1 ? { resourceId: ids[0] } : {}),
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.bulkRestore end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  async exportBlogCategories(
    userId: string,
    query: { withTrashed?: boolean; onlyTrashed?: boolean },
    format: 'csv' | 'xlsx' | 'pdf',
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const traceId = this.cls.get<string>('traceId');
    const trashed = resolveTrashedMode({
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });

    this.logger.info('BlogCategoryService.exportBlogCategories start', {
      traceId,
      userId,
      format,
      trashed,
    });

    const rows = await this.repository.findAllForExport(userId, trashed);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let result: { buffer: Buffer; filename: string; contentType: string };
    if (format === 'csv') {
      result = this.buildCsv(rows, timestamp);
    } else if (format === 'xlsx') {
      result = await this.buildXlsx(rows, timestamp);
    } else {
      result = await this.buildPdf(rows, timestamp);
    }

    await this.audit.log(
      {
        action: 'blogcategory.export',
        actorId: userId,
        resourceType: 'BLOG_CATEGORY',
        metadata: { format, rowCount: rows.length },
      },
      { strict: false },
    );

    this.logger.info('BlogCategoryService.exportBlogCategories end', {
      traceId,
      format,
      rowCount: rows.length,
    });

    return result;
  }

  private buildCsv(
    rows: BlogCategory[],
    timestamp: string,
  ): { buffer: Buffer; filename: string; contentType: string } {
    const columns = [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Description', key: 'description' },
      { header: 'Image', key: 'image' },
      { header: 'Created At', key: 'createdAt' },
      { header: 'Updated At', key: 'updatedAt' },
      { header: 'Deleted At', key: 'deletedAt' },
    ];

    const header = columns.map((c) => c.header).join(',');
    const body = rows
      .map((r) =>
        [
          csvEscape(r.id),
          csvEscape(r.name),
          csvEscape(r.description),
          csvEscape(r.image),
          csvEscape(r.createdAt),
          csvEscape(r.updatedAt),
          csvEscape(r.deletedAt ?? ''),
        ].join(','),
      )
      .join('\r\n');

    const csv =
      body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;

    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, 'utf8'),
    ]);

    return {
      buffer,
      filename: `blog-categories-${timestamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: BlogCategory[],
    timestamp: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Vidula';
    wb.created = new Date();

    const sheet = wb.addWorksheet('BlogCategories');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Image', key: 'image', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 24 },
      { header: 'Updated At', key: 'updatedAt', width: 24 },
      { header: 'Deleted At', key: 'deletedAt', width: 24 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      sheet.addRow({
        id: sheetEscape(r.id),
        name: sheetEscape(r.name),
        description: sheetEscape(r.description),
        image: sheetEscape(r.image),
        createdAt: sheetEscape(r.createdAt),
        updatedAt: sheetEscape(r.updatedAt),
        deletedAt: sheetEscape(r.deletedAt ?? ''),
      });
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `blog-categories-${timestamp}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(
    rows: BlogCategory[],
    timestamp: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `blog-categories-${timestamp}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Blog Categories — Export', { align: 'left' });
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
            .font('Helvetica-Bold')
            .text(r.name ?? '(unnamed)');

          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#475569')
            .text(`ID: ${r.id}`)
            .text(`Created: ${r.createdAt}`)
            .text(`Updated: ${r.updatedAt}`)
            .text(r.deletedAt ? `Deleted: ${r.deletedAt}` : 'Deleted: —')
            .fillColor('#000');

          if (r.description) {
            doc.moveDown(0.2).fontSize(10).text(r.description);
          }
          doc.moveDown(0.6);
        }
      }

      doc.end();
    });
  }

  private async findOrFail(
    userId: string,
    id: string,
  ): Promise<BlogCategory> {
    const result = await this.repository.findById(userId, id);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  /** Tenant-scoped existence check that also sees soft-deleted rows — used by restore. */
  private async findOrFailWithDeleted(
    userId: string,
    id: string,
  ): Promise<BlogCategory> {
    const result = await this.repository.findByIdWithDeleted(userId, id);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.delByPattern(this.cacheKeyPattern);
  }

  /** Best-effort R2 cleanup — logs but never rethrows (PATTERN #4). */
  private async deleteImageFile(imageUrl: string): Promise<void> {
    try {
      const key = this.storage.keyFromUrl(imageUrl);
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to delete blog category image from storage', {
        traceId,
        error,
      });
    }
  }

  /** Rollback helper for the R2 blob when the surrounding DB tx aborts. */
  private async deleteImageFileByKey(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to rollback uploaded blog category image', {
        traceId,
        key,
        error,
      });
    }
  }
}
