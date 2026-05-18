export class Email {
  private constructor(public readonly value: string | null) {}

  static create(value: string | null | undefined): Email {
    if (!value) {
      return new Email(null);
    }
    const email = value.trim();
    if (email.length > 255) {
      throw new Error('Email cannot exceed 255 characters');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    return new Email(email);
  }
}
