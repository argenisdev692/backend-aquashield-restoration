import type { CreateUserInput } from '../dtos/create-user.dto';

export class CreateUserCommand {
  constructor(
    public readonly dto: CreateUserInput,
    public readonly actorId: string,
  ) {}
}
