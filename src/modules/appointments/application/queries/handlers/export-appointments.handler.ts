import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  ExportAppointmentsQuery,
  type ExportAppointmentsResult,
} from '../export-appointments.query';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentFilters,
  AppointmentReadModel,
} from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';
import {
  csvEscape,
  sheetEscape,
} from '../../../../../shared/export/export.util';

const COLUMNS = [
  { header: 'id', key: 'id', width: 38 },
  { header: 'firstName', key: 'firstName', width: 18 },
  { header: 'lastName', key: 'lastName', width: 18 },
  { header: 'phone', key: 'phone', width: 18 },
  { header: 'email', key: 'email', width: 28 },
  { header: 'address', key: 'address', width: 30 },
  { header: 'address2', key: 'address2', width: 20 },
  { header: 'city', key: 'city', width: 18 },
  { header: 'state', key: 'state', width: 12 },
  { header: 'zipcode', key: 'zipcode', width: 12 },
  { header: 'country', key: 'country', width: 16 },
  { header: 'statusLead', key: 'statusLead', width: 12 },
  { header: 'owner', key: 'owner', width: 18 },
  { header: 'smsConsent', key: 'smsConsent', width: 10 },
  { header: 'readed', key: 'readed', width: 8 },
  { header: 'message', key: 'message', width: 40 },
  { header: 'notes', key: 'notes', width: 30 },
  { header: 'additionalNote', key: 'additionalNote', width: 30 },
  { header: 'registrationDate', key: 'registrationDate', width: 22 },
  { header: 'createdAt', key: 'createdAt', width: 22 },
  { header: 'updatedAt', key: 'updatedAt', width: 22 },
  { header: 'deletedAt', key: 'deletedAt', width: 22 },
] as const;

type Row = Record<(typeof COLUMNS)[number]['key'], unknown>;

function toRow(r: AppointmentReadModel): Row {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    email: r.email ?? '',
    address: r.address,
    address2: r.address2 ?? '',
    city: r.city,
    state: r.state,
    zipcode: r.zipcode,
    country: r.country,
    statusLead: r.statusLead ?? '',
    owner: r.owner ?? '',
    smsConsent: r.smsConsent,
    readed: r.readed,
    message: r.message ?? '',
    notes: r.notes ?? '',
    additionalNote: r.additionalNote ?? '',
    registrationDate: r.registrationDate ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt ?? '',
  };
}

@Injectable()
@QueryHandler(ExportAppointmentsQuery)
export class ExportAppointmentsHandler implements IQueryHandler<ExportAppointmentsQuery> {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ExportAppointmentsHandler.name);
  }

  async execute(
    query: ExportAppointmentsQuery,
  ): Promise<ExportAppointmentsResult> {
    const { dto, format, userId } = query;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportAppointmentsHandler start', {
      traceId,
      format,
      userId,
    });

    const filters: AppointmentFilters = {
      statusLead: dto.statusLead,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      owner: dto.owner,
      trashed: resolveTrashedMode({
        withTrashed: dto.withTrashed,
        onlyTrashed: dto.onlyTrashed,
      }),
      range: query.range,
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
        action: 'appointments.export',
        actorId: userId,
        traceId,
        metadata: { format, count: data.length },
      },
      { strict: false },
    );

    this.logger.info('ExportAppointmentsHandler end', {
      traceId,
      format,
      count: data.length,
    });

    return result;
  }

  private buildCsv(rows: AppointmentReadModel[]): ExportAppointmentsResult {
    const header = COLUMNS.map((c) => c.header).join(',');
    const body = rows
      .map((r) => {
        const row = toRow(r);
        return COLUMNS.map((c) => csvEscape(row[c.key])).join(',');
      })
      .join('\r\n');
    const csv =
      body.length === 0 ? `${header}\r\n` : `${header}\r\n${body}\r\n`;
    // UTF-8 BOM so Excel auto-detects the encoding.
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, 'utf8'),
    ]);
    return {
      buffer,
      filename: `appointments-${this.timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async buildXlsx(
    rows: AppointmentReadModel[],
  ): Promise<ExportAppointmentsResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aquashield Restoration LLC';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Appointments');
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
      filename: `appointments-${this.timestamp()}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildPdf(
    rows: AppointmentReadModel[],
  ): Promise<ExportAppointmentsResult> {
    return new Promise<ExportAppointmentsResult>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `appointments-${this.timestamp()}.pdf`,
          contentType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      doc.fontSize(16).text('Appointments — export', { align: 'left' });
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
              `${r.firstName} ${r.lastName}` +
                (r.email ? `  <${r.email}>` : ''),
            );
          doc
            .fontSize(9)
            .fillColor('#475569')
            .text(
              `Phone: ${r.phone}  ·  Status: ${r.statusLead ?? '—'}  ·  Read: ${
                r.readed ? 'yes' : 'no'
              }${r.deletedAt ? '  ·  DELETED' : ''}`,
            );
          doc
            .fontSize(9)
            .text(
              `${r.address}${r.address2 ? `, ${r.address2}` : ''}, ${r.city}, ${r.state} ${r.zipcode}, ${r.country}`,
            )
            .fillColor('#000');
          if (r.message) {
            doc.fontSize(10).text(r.message, { width: 520 });
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
