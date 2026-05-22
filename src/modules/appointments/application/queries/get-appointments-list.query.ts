import type { AppointmentFiltersInput } from '../dtos/appointment-filters.dto';

export class GetAppointmentsListQuery {
  constructor(public readonly dto: AppointmentFiltersInput) {}
}
