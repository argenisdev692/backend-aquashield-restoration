export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed.length > 255) {
      throw new Error('Email must be between 1 and 255 characters');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid email format');
    }
    return new Email(trimmed);
  }

  static reconstitute(value: string): Email {
    return new Email(value);
  }
}
