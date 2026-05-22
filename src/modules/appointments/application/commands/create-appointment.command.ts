import type { CreateAppointmentInput } from '../dtos/create-appointment.dto';

export class CreateAppointmentCommand {
  constructor(
    public readonly dto: CreateAppointmentInput,
    public readonly actorId?: string,
  ) {}
}
