import type { UpdatePostInput } from '../dtos/update-post.dto';

export class UpdatePostCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdatePostInput,
    public readonly actorId: string,
  ) {}
}
