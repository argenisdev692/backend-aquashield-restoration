import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { formatPhonePretty } from '../../../../../shared/phone/phone.util';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';
import { sheetEscape } from '../../../../../shared/export/export.util';
import { ExportUsersCommand } from '../export-users.command';

@CommandHandler(ExportUsersCommand)
export class ExportUsersHandler implements ICommandHandler<ExportUsersCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(command: ExportUsersCommand): Promise<Buffer> {
    const { query, format, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    const trashed = resolveTrashedMode({
      withTrashed: query.withTrashed,
      onlyTrashed: query.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: query.start_date,
      end_date: query.end_date,
    });
    this.logger.info('ExportUsersHandler start', { traceId, format, trashed, range });

    const { users } = await this.userRepo.findAll({
      skip: 0,
      take: 10_000,
      search: query.search,
      trashed,
      range,
    });

    const rows = users.map((u) => ({
      id: u.id.value,
      name: u.name,
      lastName: u.lastName ?? '',
      email: u.email.value,
      // Phone is stored E.164 and rendered international-pretty per country
      // (e.g. `+351 912 345 678`, `+1 415 555 2671`, `+34 612 34 56 78`).
      phone: formatPhonePretty(u.phone) ?? '',
      createdAt: u.createdAt.toISOString(),
      // Empty for active users; ISO timestamp when the row was suspended.
      // Lets the frontend / spreadsheet filter on "is suspended?".
      deletedAt: u.deletedAt?.toISOString() ?? '',
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

    this.logger.info('ExportUsersHandler end', {
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
      phone: string;
      createdAt: string;
      deletedAt: string;
    }[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 22 },
      { header: 'Created At', key: 'createdAt', width: 24 },
      { header: 'Deleted At', key: 'deletedAt', width: 24 },
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
      sheet.addRow({
        id: sheetEscape(row.id),
        name: sheetEscape(row.name),
        lastName: sheetEscape(row.lastName),
        email: sheetEscape(row.email),
        phone: sheetEscape(row.phone),
        createdAt: sheetEscape(row.createdAt),
        deletedAt: sheetEscape(row.deletedAt),
      });
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
      phone: string;
      createdAt: string;
      deletedAt: string;
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

      const headers = [
        'ID',
        'Name',
        'Last Name',
        'Email',
        'Phone',
        'Created At',
        'Deleted At',
      ];
      const colWidths = [170, 80, 80, 130, 110, 90, 90];
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
        const vals = [
          row.id,
          row.name,
          row.lastName,
          row.email,
          row.phone,
          row.createdAt,
          row.deletedAt,
        ];
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
