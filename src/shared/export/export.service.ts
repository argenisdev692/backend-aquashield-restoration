import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { csvEscape, sheetEscape, type ExportPrimitive } from './export.util';

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportColumn<TRow = Record<string, unknown>> {
  /** Header label rendered in the first row / first CSV line. */
  header: string;
  /** Dotted-path key into the row OR a custom selector. */
  key: keyof TRow & string;
  /** XLSX column width (chars). Ignored by CSV. */
  width?: number;
  /** Optional value transform applied before escaping. */
  format?: (value: unknown, row: TRow) => ExportPrimitive;
}

export interface GenerateExportInput<TRow = Record<string, unknown>> {
  columns: ExportColumn<TRow>[];
  rows: TRow[];
  /** Worksheet name for XLSX (ignored by CSV). Defaults to `Export`. */
  sheetName?: string;
  /** Header fill color (ARGB) for XLSX. Defaults to the brand blue. */
  headerColor?: string;
}

/**
 * Shared exporter for XLSX + CSV. Centralizes:
 * - CSV/XLSX formula-injection defusing (`csvEscape` / `sheetEscape`).
 * - Header styling (bold, brand fill) so every module gets the same look.
 * - One ExcelJS dependency surface — new modules just hand over
 *   `{ columns, rows }` instead of re-wiring `new Workbook()`.
 *
 * PDF generation is intentionally NOT here — the layouts vary too much per
 * domain (tabular vs. invoice vs. report). Modules that need PDF should
 * implement their own builder until a 2nd consumer justifies promoting it.
 */
@Injectable()
export class ExportService {
  generate<TRow extends Record<string, unknown>>(
    input: GenerateExportInput<TRow>,
    format: ExportFormat,
  ): Promise<Buffer> {
    if (format === 'csv') {
      return Promise.resolve(this.toCsv(input));
    }
    return this.toXlsx(input);
  }

  private async toXlsx<TRow extends Record<string, unknown>>(
    input: GenerateExportInput<TRow>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(input.sheetName ?? 'Export');

    sheet.columns = input.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 20,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: input.headerColor ?? 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle' };

    for (const row of input.rows) {
      const cells: Record<string, ExportPrimitive> = {};
      for (const col of input.columns) {
        const raw = col.format ? col.format(row[col.key], row) : row[col.key];
        cells[col.key] = sheetEscape(raw);
      }
      sheet.addRow(cells);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private toCsv<TRow extends Record<string, unknown>>(
    input: GenerateExportInput<TRow>,
  ): Buffer {
    const header = input.columns.map((c) => csvEscape(c.header)).join(',');
    const lines = input.rows.map((row) =>
      input.columns
        .map((col) => {
          const raw = col.format ? col.format(row[col.key], row) : row[col.key];
          return csvEscape(raw);
        })
        .join(','),
    );
    // BOM keeps Excel happy with UTF-8 content (accented characters, etc.).
    return Buffer.from('﻿' + [header, ...lines].join('\r\n'), 'utf8');
  }
}
