export class UserId {
  private constructor(public readonly value: string) {}

  static create(value: string): UserId {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('Invalid UUID format');
    }
    return new UserId(value);
  }

  static reconstitute(value: string): UserId {
    return new UserId(value);
  }
}
