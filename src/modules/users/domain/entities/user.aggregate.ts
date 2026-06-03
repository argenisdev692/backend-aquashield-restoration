import type { Email } from '../value-objects/email.vo';
import type { UserId } from '../value-objects/user-id.vo';

export class User {
  private constructor(
    public readonly id: UserId,
    public readonly email: Email,
    public readonly name: string,
    public readonly lastName: string | null,
    public readonly username: string | null,
    public readonly phone: string | null,
    public readonly dateOfBirth: Date | null,
    public readonly address: string | null,
    public readonly address2: string | null,
    public readonly zipCode: string | null,
    public readonly city: string | null,
    public readonly state: string | null,
    public readonly country: string | null,
    public readonly gender: string | null,
    public readonly profilePhotoPath: string | null,
    public readonly totpEnabled: boolean,
    public readonly mustChangePassword: boolean,
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
      null,
      params.phone,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      false,
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
    username: string | null;
    phone: string | null;
    dateOfBirth: Date | null;
    address: string | null;
    address2: string | null;
    zipCode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    gender: string | null;
    profilePhotoPath: string | null;
    totpEnabled: boolean;
    mustChangePassword: boolean;
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
      params.username,
      params.phone,
      params.dateOfBirth,
      params.address,
      params.address2,
      params.zipCode,
      params.city,
      params.state,
      params.country,
      params.gender,
      params.profilePhotoPath,
      params.totpEnabled,
      params.mustChangePassword,
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
