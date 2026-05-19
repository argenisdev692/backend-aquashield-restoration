import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { UsersListQuery } from '../dtos/users-list-query.dto';

@Injectable()
export class ExportUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(
    query: UsersListQuery,
    format: 'xlsx' | 'pdf',
    actorId: string,
  ): Promise<Buffer> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportUsersUseCase start', { traceId, format });

    const { users } = await this.userRepo.findAll({
      skip: 0,
      take: 10_000,
      search: query.search,
    });

    const rows = users.map((u) => ({
      id: u.id.value,
      name: u.name,
      lastName: u.lastName ?? '',
      email: u.email.value,
      createdAt: u.createdAt.toISOString(),
    }));

    const buffer =
      format === 'pdf'
        ? await this.generatePdf(rows)
        : await this.generateXlsx(rows);

    await this.audit.log({
      action: 'users.export',
      resourceType: 'USER',
      actorId,
      metadata: { format, rowCount: rows.length },
    });

    this.logger.info('ExportUsersUseCase end', {
      traceId,
      format,
      rowCount: rows.length,
    });

    return buffer;
  }

  private async generateXlsx(
    rows: {
      id: string;
      name: string;
      lastName: string;
      email: string;
      createdAt: string;
    }[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Created At', key: 'createdAt', width: 24 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle' };

    for (const row of rows) {
      sheet.addRow(row);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private generatePdf(
    rows: {
      id: string;
      name: string;
      lastName: string;
      email: string;
      createdAt: string;
    }[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Users Export', { align: 'center' });
      doc.moveDown(1);

      const headers = ['ID', 'Name', 'Last Name', 'Email', 'Created At'];
      const colWidths = [220, 100, 100, 170, 130];
      const startX = 40;
      let y = doc.y;

      doc.fontSize(9).font('Helvetica-Bold');
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, y, { width: colWidths[i], continued: false });
        x += colWidths[i];
      }
      y += 18;
      doc
        .moveTo(startX, y)
        .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
        .stroke();
      y += 6;

      doc.font('Helvetica').fontSize(8);
      for (const row of rows) {
        if (y > 540) {
          doc.addPage();
          y = 40;
        }
        const vals = [row.id, row.name, row.lastName, row.email, row.createdAt];
        x = startX;
        for (let i = 0; i < vals.length; i++) {
          doc.text(vals[i], x, y, { width: colWidths[i], continued: false });
          x += colWidths[i];
        }
        y += 16;
      }

      doc.end();
    });
  }
}
