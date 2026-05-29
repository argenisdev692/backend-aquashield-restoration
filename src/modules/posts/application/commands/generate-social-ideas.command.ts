import type { GenerateSocialPostIdeasDto } from '../dtos/generate-social-post-ideas.dto';

export class GenerateSocialIdeasCommand {
  constructor(
    public readonly dto: GenerateSocialPostIdeasDto,
    public readonly actorId: string,
  ) {}
}
