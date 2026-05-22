import type { AppointmentFiltersInput } from '../dtos/appointment-filters.dto';

export class ExportAppointmentsQuery {
  constructor(
    public readonly dto: AppointmentFiltersInput,
    public readonly format: 'xlsx' | 'pdf',
    public readonly userId: string,
  ) {}
}
