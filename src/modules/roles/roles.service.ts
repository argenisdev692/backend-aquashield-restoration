import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { RolesRepository } from './roles.repository';
import type { RolePermissionInput } from './roles.repository';
import type { Role, Permission } from './roles.entity';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AttachPermissionDto } from './dto/attach-permission.dto';
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

const PDF_PAGE_BREAK_Y = 520;

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(RolesService.name);
  }

  async findAll(
    limit = 50,
    skip = 0,
    search?: string,
    trashed: TrashedMode = 'exclude',
  ): Promise<Role[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.findAll', {
      traceId,
      limit,
      skip,
      trashed,
    });
    return this.repository.findAll(limit, skip, search, trashed);
  }

  async findById(id: string, withTrashed = false): Promise<Role> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.findById', {
      traceId,
      id,
      withTrashed,
    });
    return this.findOrFail(id, withTrashed);
  }

  async create(dto: CreateRoleDto, actorId: string): Promise<Role> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.create start', { traceId, actorId });

    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Role with this name already exists');
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.create(dto);
      await this.audit.log(
        {
          action: 'roles.created',
          actorId,
          resourceType: 'ROLE',
          resourceId: row.id,
          metadata: { name: row.name },
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('RolesService.create end', { traceId, roleId: result.id });
    return result;
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string): Promise<Role> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.update start', { traceId, id, actorId });

    const existing = await this.findOrFail(id, true);

    if (existing.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.repository.findByName(dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, dto);
      await this.audit.log(
        {
          action: 'roles.updated',
          actorId,
          resourceType: 'ROLE',
          resourceId: id,
          metadata: { name: row.name },
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('RolesService.update end', { traceId, id });
    return result;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.delete start', { traceId, id, actorId });

    const existing = await this.findOrFail(id, false);

    if (existing.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    await this.tx.runInTx(async () => {
      await this.repository.delete(id);
      await this.audit.log(
        {
          action: 'roles.deleted',
          actorId,
          resourceType: 'ROLE',
          resourceId: id,
          metadata: { name: existing.name },
        },
        { strict: true },
      );
    });

    await this.invalidateCache();
    this.logger.info('RolesService.delete end', { traceId, id });
  }

  async restore(id: string, actorId: string): Promise<Role> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.restore start', { traceId, id, actorId });

    await this.findOrFail(id, true);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.restore(id);
      await this.audit.log(
        {
          action: 'roles.restored',
          actorId,
          resourceType: 'ROLE',
          resourceId: id,
          metadata: { name: row.name },
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('RolesService.restore end', { traceId, id });
    return result;
  }

  async bulkDelete(ids: string[], actorId: string): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.bulkDelete start', {
      traceId,
      actorId,
      count: ids.length,
    });

    const systemHit = await this.repository.countSystemInIds(ids);
    if (systemHit > 0) {
      throw new BadRequestException('Bulk delete cannot include system roles');
    }

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkDelete(ids);
      await this.audit.log(
        {
          action: 'roles.bulk_deleted',
          actorId,
          resourceType: 'ROLE',
          ...(ids.length === 1 ? { resourceId: ids[0] } : {}),
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('RolesService.bulkDelete end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  async bulkRestore(
    ids: string[],
    actorId: string,
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.bulkRestore start', {
      traceId,
      actorId,
      count: ids.length,
    });

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkRestore(ids);
      await this.audit.log(
        {
          action: 'roles.bulk_restored',
          actorId,
          resourceType: 'ROLE',
          ...(ids.length === 1 ? { resourceId: ids[0] } : {}),
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('RolesService.bulkRestore end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  async findAllPermissions(): Promise<Permission[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.findAllPermissions', { traceId });
    return this.repository.findAllPermissions();
  }

  async exportRoles(
    query: { search?: string; withTrashed?: boolean; onlyTrashed?: boolean },
    format: 'csv' | 'xlsx' | 'pdf',
    actorId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const traceId = this.cls.get<string>('traceId');
    const trashed = resolveTrashedMode({
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });

    this.logger.info('RolesService.exportRoles start', {
      traceId,
      format,
      trashed,
    });

    const roles = await this.repository.findAll(
      10000,
      0,
      query.search,
      trashed,
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let result: { buffer: Buffer; filename: string; contentType: string };

    if (format === 'csv') {
      result = this.buildCsv(roles, timestamp);
    } else if (format === 'xlsx') {
      result = await this.buildXlsx(roles, timestamp);
    } else {
      result = await this.buildPdf(roles, timestamp);
    }

    await this.audit.log(
      {
        action: 'roles.export',
        actorId,
        resourceType: 'ROLE',
        metadata: { format, rowCount: roles.length },
      },
      { strict: false },
    );

    this.logger.info('RolesService.exportRoles end', {
      traceId,
      format,
      rowCount: roles.length,
    });

    return result;
  }

  private buildCsv(roles: Role[], timestamp: string) {
    const columns = [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Description', key: 'description' },
      { header: 'System Role', key: 'isSystem' },
      { header: 'Created At', key: 'createdAt' },
      { header: 'Deleted At', key: 'deletedAt' },
      { header: 'Permissions', key: 'permissions' },
    ];

    const header = columns.map((c) => c.header).join(',');
    const body = roles
      .map((r) => {
        const permsStr = r.permissions
          ? r.permissions.map((p) => p.name).join(', ')
          : '';
        return [
          csvEscape(r.id),
          csvEscape(r.name),
          csvEscape(r.description),
          csvEscape(r.isSystem ? 'yes' : 'no'),
          csvEscape(r.createdAt.toISOString()),
          csvEscape(r.deletedAt ? r.deletedAt.toISOString() : ''),
          csvEscape(permsStr),
        ].join(',');
      })
      .join('\r\n');

    const csv =
      body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;

    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
      Buffer.from(csv, 'utf8'),
    ]);

    return {
      buffer,
      filename: `roles-${timestamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(roles: Role[], timestamp: string) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Vidula';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Roles');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'System Role', key: 'isSystem', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 24 },
      { header: 'Deleted At', key: 'deletedAt', width: 24 },
      { header: 'Permissions', key: 'permissions', width: 60 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of roles) {
      const permsStr = r.permissions
        ? r.permissions.map((p) => p.name).join(', ')
        : '';
      sheet.addRow({
        id: sheetEscape(r.id),
        name: sheetEscape(r.name),
        description: sheetEscape(r.description),
        isSystem: r.isSystem ? 'yes' : 'no',
        createdAt: sheetEscape(r.createdAt.toISOString()),
        deletedAt: r.deletedAt ? sheetEscape(r.deletedAt.toISOString()) : '',
        permissions: sheetEscape(permsStr),
      });
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `roles-${timestamp}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(
    roles: Role[],
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
          filename: `roles-${timestamp}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Roles — Export', { align: 'left' });
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text(`Generated: ${new Date().toISOString()}    Rows: ${roles.length}`)
        .fillColor('#000');
      doc.moveDown();

      if (roles.length === 0) {
        doc.fontSize(11).text('No rows to export.');
      } else {
        for (const r of roles) {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(`${r.name}${r.isSystem ? ' (System Role)' : ''}`);

          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Description: ${r.description ?? '—'}  ·  Created At: ${r.createdAt.toISOString()}${
                r.deletedAt
                  ? `  ·  DELETED AT: ${r.deletedAt.toISOString()}`
                  : ''
              }`,
            );

          const permsStr = r.permissions
            ? r.permissions.map((p) => p.name).join(', ')
            : '';
          doc
            .fontSize(9)
            .fillColor('#0284c7')
            .text(`Permissions: ${permsStr || 'None'}`);

          doc
            .fontSize(8)
            .fillColor('#94a3b8')
            .text(`ID: ${r.id}`)
            .fillColor('#000');

          doc.moveDown(0.8);

          if (doc.y > PDF_PAGE_BREAK_Y) {
            doc.addPage();
          }
        }
      }

      doc.end();
    });
  }

  private async findOrFail(id: string, withTrashed = false): Promise<Role> {
    const result = await this.repository.findById(id, withTrashed);
    if (!result) throw new NotFoundException('Role not found');
    return result;
  }

  /**
   * Bumps every cache that depends on role/permission state. Per backend-nest.md
   * "Identity responses" rule: ACL mutations MUST invalidate the `users` and
   * `auth/me` HTTP caches. We also drop every per-user CASL ability cache
   * because a role change can affect any user that holds it.
   */
  private async invalidateCache(): Promise<void> {
    await this.cache.delByPattern('http:*:/roles*');
    await this.cache.delByPattern('http:*:/permissions*');
    await this.cache.delByPattern('http:*:/users*');
    await this.cache.delByPattern('http:*:/auth/me*');
    await this.cache.delByPattern('casl:ability:*');
  }

  async attachPermission(
    id: string,
    dto: AttachPermissionDto,
    actorId: string,
  ): Promise<Role> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.attachPermission start', {
      traceId,
      id,
      permissionId: dto.permissionId,
      actorId,
    });

    const existing = await this.findOrFail(id, false);
    if (existing.isSystem) {
      throw new BadRequestException(
        'System roles cannot have their permissions modified',
      );
    }

    const exists = await this.repository.permissionExists(dto.permissionId);
    if (!exists) {
      throw new NotFoundException('Permission not found');
    }

    const assignment: RolePermissionInput = {
      permissionId: dto.permissionId,
      conditions: dto.conditions ?? null,
      fields: dto.fields ?? [],
    };

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.attachPermission(id, assignment);
      await this.audit.log(
        {
          action: 'roles.permission_attached',
          actorId,
          resourceType: 'ROLE',
          resourceId: id,
          metadata: {
            permissionId: assignment.permissionId,
            hasConditions: assignment.conditions !== null,
            fieldCount: assignment.fields?.length ?? 0,
          },
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('RolesService.attachPermission end', {
      traceId,
      id,
      permissionId: dto.permissionId,
    });
    return result;
  }

  async detachPermission(
    id: string,
    permissionId: string,
    actorId: string,
  ): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RolesService.detachPermission start', {
      traceId,
      id,
      permissionId,
      actorId,
    });

    const existing = await this.findOrFail(id, false);
    if (existing.isSystem) {
      throw new BadRequestException(
        'System roles cannot have their permissions modified',
      );
    }

    const removed = await this.tx.runInTx(async () => {
      const detached = await this.repository.detachPermission(id, permissionId);
      if (!detached) {
        throw new NotFoundException('Permission is not attached to this role');
      }
      await this.audit.log(
        {
          action: 'roles.permission_detached',
          actorId,
          resourceType: 'ROLE',
          resourceId: id,
          metadata: { permissionId },
        },
        { strict: true },
      );
      return detached;
    });

    if (removed) {
      await this.invalidateCache();
    }
    this.logger.info('RolesService.detachPermission end', {
      traceId,
      id,
      permissionId,
    });
  }
}
