import type { Email } from '../value-objects/email.vo';
import type { UserId } from '../value-objects/user-id.vo';

export class User {
  private constructor(
    public readonly id: UserId,
    public readonly email: Email,
    public readonly name: string,
    public readonly lastName: string | null,
    public readonly phone: string | null,
    private _password: string | null,
    private _emailVerifiedAt: Date | null,
    private _passwordConfirmedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  static create(params: {
    id: UserId;
    email: Email;
    name: string;
    lastName: string | null;
    phone: string | null;
  }): User {
    return new User(
      params.id,
      params.email,
      params.name,
      params.lastName,
      params.phone,
      null,
      null,
      null,
      new Date(),
      new Date(),
      null,
    );
  }

  static reconstitute(params: {
    id: UserId;
    email: Email;
    name: string;
    lastName: string | null;
    phone: string | null;
    password: string | null;
    emailVerifiedAt: Date | null;
    passwordConfirmedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): User {
    return new User(
      params.id,
      params.email,
      params.name,
      params.lastName,
      params.phone,
      params.password,
      params.emailVerifiedAt,
      params.passwordConfirmedAt,
      params.createdAt,
      params.updatedAt,
      params.deletedAt,
    );
  }

  setPassword(hashedPassword: string): void {
    this._password = hashedPassword;
    this._passwordConfirmedAt = new Date();
  }

  changePassword(hashedPassword: string): void {
    this._password = hashedPassword;
  }

  get password(): string | null {
    return this._password;
  }

  get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }

  get passwordConfirmedAt(): Date | null {
    return this._passwordConfirmedAt;
  }
}
