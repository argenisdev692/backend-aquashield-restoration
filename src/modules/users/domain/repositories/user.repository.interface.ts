import type { User } from '../entities/user.aggregate';

export interface UserRow {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  password: string | null;
  emailVerifiedAt: Date | null;
  passwordConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserData {
  name: string;
  lastName?: string;
  email: string;
}

export interface UpdateUserData {
  name?: string;
  lastName?: string;
  email?: string;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }>;
  create(user: User): Promise<User>;
  save(user: User): Promise<void>;
  softDelete(id: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
