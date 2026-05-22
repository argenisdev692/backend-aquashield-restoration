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
      phone: row.phone,
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
    email: string;
    phone: string | null;
    password: string | null;
  } {
    return {
      id: user.id.value,
      name: user.name,
      lastName: user.lastName,
      email: user.email.value,
      phone: user.phone,
      password: user.password,
    };
  }
}
