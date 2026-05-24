import type { CreatePostInput } from '../dtos/create-post.dto';

export class CreatePostCommand {
  constructor(
    public readonly dto: CreatePostInput,
    public readonly actorId: string,
  ) {}
}
