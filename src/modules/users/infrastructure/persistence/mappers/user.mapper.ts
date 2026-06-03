import { User } from '../../../domain/entities/user.aggregate';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import type { User as UserRow } from '../../../../../generated/prisma/client';

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.reconstitute({
      id: UserId.reconstitute(row.id),
      email: Email.reconstitute(row.email),
      name: row.name,
      lastName: row.lastName,
      username: row.username,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      address: row.address,
      address2: row.address2,
      zipCode: row.zipCode,
      city: row.city,
      state: row.state,
      country: row.country,
      gender: row.gender,
      profilePhotoPath: row.profilePhotoPath,
      totpEnabled: row.totpEnabled,
      mustChangePassword: row.mustChangePassword,
      password: row.password,
      emailVerifiedAt: row.emailVerifiedAt,
      passwordConfirmedAt: row.passwordConfirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPersistence(user: User): {
    id: string;
    name: string;
    lastName: string | null;
    username: string | null;
    email: string;
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
  } {
    return {
      id: user.id.value,
      name: user.name,
      lastName: user.lastName,
      username: user.username,
      email: user.email.value,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
      address: user.address,
      address2: user.address2,
      zipCode: user.zipCode,
      city: user.city,
      state: user.state,
      country: user.country,
      gender: user.gender,
      profilePhotoPath: user.profilePhotoPath,
      totpEnabled: user.totpEnabled,
      mustChangePassword: user.mustChangePassword,
      password: user.password,
    };
  }
}
