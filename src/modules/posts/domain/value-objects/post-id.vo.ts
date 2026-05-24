import { z } from 'zod';
import { InvalidPostIdException } from '../exceptions/invalid-post-id.exception';

const UuidSchema = z.string().uuid();

export class PostId {
  private constructor(public readonly value: string) {}

  static create(value: string): PostId {
    const parsed = UuidSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidPostIdException(value);
    }
    return new PostId(parsed.data);
  }

  /**
   * Reconstitute a PostId from a trusted persistence source (e.g. database row).
   * Skips re-validation because the value originated from our own schema.
   */
  static reconstitute(value: string): PostId {
    return new PostId(value);
  }
}
