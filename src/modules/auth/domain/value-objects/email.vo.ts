import { z } from 'zod';

export const EmailSchema = z.string().trim().toLowerCase().email().max(255);

export class InvalidEmailException extends Error {
  constructor(value: unknown) {
    super(`Invalid email address: ${String(value)}`);
    this.name = 'InvalidEmailException';
  }
}

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: unknown): Email {
    const parsed = EmailSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidEmailException(value);
    }
    return new Email(parsed.data);
  }

  /** Used by mappers to rehydrate without re-running validation. */
  static unsafeReconstitute(value: string): Email {
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
