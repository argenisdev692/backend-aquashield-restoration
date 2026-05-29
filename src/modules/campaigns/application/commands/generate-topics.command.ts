import type { GenerateTopicsDto } from '../dtos/generate-topics.dto';

export class GenerateTopicsCommand {
  constructor(
    public readonly dto: GenerateTopicsDto,
    public readonly actorId: string,
  ) {}
}
