import type { ExportAppointmentsInput } from '../dtos/export-appointments.dto';
import type { DateRange } from '../../../../shared/crud/date-range.util';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export class ExportAppointmentsQuery {
  constructor(
    public readonly dto: ExportAppointmentsInput,
    public readonly format: ExportFormat,
    public readonly userId: string,
    public readonly range: DateRange,
  ) {}
}

export interface ExportAppointmentsResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
