import type { UpdateUserInput } from '../dtos/update-user.dto';

export class UpdateUserCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateUserInput,
    public readonly actorId: string,
  ) {}
}
