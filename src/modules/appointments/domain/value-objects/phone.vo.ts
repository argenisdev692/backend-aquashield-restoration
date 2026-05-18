export class Phone {
  private constructor(public readonly value: string) {}

  static create(value: string): Phone {
    if (!value || value.trim().length === 0) {
      throw new Error('Phone cannot be empty');
    }
    const phone = value.trim();
    if (phone.length > 20) {
      throw new Error('Phone cannot exceed 20 characters');
    }
    return new Phone(phone);
  }
}
