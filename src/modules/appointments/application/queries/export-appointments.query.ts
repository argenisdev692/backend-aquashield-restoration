import type { ExportAppointmentsInput } from '../dtos/export-appointments.dto';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export class ExportAppointmentsQuery {
  constructor(
    public readonly dto: ExportAppointmentsInput,
    public readonly format: ExportFormat,
    public readonly userId: string,
  ) {}
}

export interface ExportAppointmentsResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
