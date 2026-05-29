import type { GenerateSocialPostDto } from '../dtos/generate-social-post.dto';

export class GenerateSocialPostCommand {
  constructor(
    public readonly dto: GenerateSocialPostDto,
    public readonly actorId: string,
  ) {}
}
