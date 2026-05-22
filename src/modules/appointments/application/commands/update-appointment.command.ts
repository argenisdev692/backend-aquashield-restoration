import type { UpdateAppointmentInput } from '../dtos/update-appointment.dto';

export class UpdateAppointmentCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateAppointmentInput,
    public readonly actorId?: string,
  ) {}
}
