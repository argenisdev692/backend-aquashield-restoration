import type { GeneratePostPreviewInput } from '../dtos/generate-post-preview.dto';

export class GeneratePostPreviewCommand {
  constructor(
    public readonly dto: GeneratePostPreviewInput,
    public readonly actorId: string,
  ) {}
}
