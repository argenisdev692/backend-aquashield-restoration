export interface IPasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

export const PASSWORD_HASHER_PORT = Symbol('IPasswordHasherPort');
