import type { AppointmentFiltersInput } from '../dtos/appointment-filters.dto';
import type { DateRange } from '../../../../shared/crud/date-range.util';

export class GetAppointmentsListQuery {
  constructor(
    public readonly dto: AppointmentFiltersInput,
    public readonly range: DateRange,
  ) {}
}
