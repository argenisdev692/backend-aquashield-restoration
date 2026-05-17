export interface UserReadModel {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: Date | null;
  passwordConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
