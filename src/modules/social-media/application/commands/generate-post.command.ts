import type { GeneratePostInput } from '../dtos/generate-post.dto';

/**
 * Command: GeneratePostCommand (Full Hex/DDD)
 * Plain TS class — no NestJS or infrastructure imports.
 * Dispatched via CommandBus from controller.
 */
export class GeneratePostCommand {
  constructor(
    public readonly dto: GeneratePostInput,
    public readonly actorId: string,
  ) {}
}
