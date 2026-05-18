export interface UserAuthRow {
  id: string;
  email: string;
  password: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  roleIds: string[];
  googleId: string | null;
  emailVerifiedAt: Date | null;
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
}

export interface CreateUserData {
  name: string;
  lastName?: string;
  email: string;
  hashedPassword: string;
  termsAndConditions: boolean;
}

export interface UserProfileRow {
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
  emailVerifiedAt: Date | null;
  totpEnabled: boolean;
  passwordConfirmedAt: Date | null;
  googleId: string | null;
  roles: Array<{ id: string; name: string }>;
  permissions: Array<{ action: string; subject: string }>;
  createdAt: Date;
}

export interface UpdateProfileData {
  name?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: string;
  address2?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
  gender?: string;
}

export interface IUserAuthRepository {
  findByEmail(email: string): Promise<UserAuthRow | null>;
  findById(id: string): Promise<UserAuthRow | null>;
  findByGoogleId(googleId: string): Promise<UserAuthRow | null>;
  findProfileById(id: string): Promise<UserProfileRow | null>;
  create(data: CreateUserData): Promise<UserAuthRow>;
  updateTotpSecret(userId: string, secret: string): Promise<void>;
  enableTotp(userId: string): Promise<void>;
  disableTotp(userId: string): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  updatePasswordWithStatus(
    userId: string,
    hashedPassword: string,
    passwordChangedAt: Date,
    passwordExpiresAt: Date | null,
  ): Promise<void>;
  setMustChangePassword(userId: string, value: boolean): Promise<void>;
  setEmailVerified(userId: string): Promise<void>;
  setPasswordConfirmed(userId: string): Promise<void>;
  getPasswordConfirmedAt(userId: string): Promise<Date | null>;
  setGoogleId(userId: string, googleId: string): Promise<void>;
  updateProfile(userId: string, data: UpdateProfileData): Promise<void>;
}

export const USER_AUTH_REPOSITORY = Symbol('IUserAuthRepository');
