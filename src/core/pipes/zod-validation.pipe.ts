import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Per-route Zod v4 validation pipe. Replaces class-validator entirely.
 *
 * Usage: `@Body(new ZodValidationPipe(CreateXSchema)) dto: CreateXDto`.
 * Returns the parsed (and transformed/coerced) value; on failure throws a
 * 400 with a safe, field-level message list.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    return result.data;
  }
}
