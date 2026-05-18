/**
 * Domain shape of the owner-company record (platform singleton, 1:1 with User).
 * Plain TypeScript — no NestJS, no Prisma, no decorators.
 * Dates are serialized to ISO strings by the repository (lean mobile-first payloads).
 * Nullable fields are `T | null`, never `T | undefined`.
 */
export interface CompanyData {
  id: string;
  name: string | null;
  companyName: string;
  signaturePath: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  address2: string | null;
  website: string | null;
  facebookLink: string | null;
  instagramLink: string | null;
  linkedinLink: string | null;
  twitterLink: string | null;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
