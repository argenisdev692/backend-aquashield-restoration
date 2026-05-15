export interface UserAuthRow {
  id: string;
  email: string;
  password: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  roleIds: string[];
}

export interface IUserAuthRepository {
  findByEmail(email: string): Promise<UserAuthRow | null>;
  findById(id: string): Promise<UserAuthRow | null>;
  updateTotpSecret(userId: string, secret: string): Promise<void>;
  enableTotp(userId: string): Promise<void>;
  disableTotp(userId: string): Promise<void>;
}

export const USER_AUTH_REPOSITORY = Symbol('IUserAuthRepository');
