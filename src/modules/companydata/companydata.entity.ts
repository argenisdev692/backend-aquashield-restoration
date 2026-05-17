import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CompanyDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255).nullable(),
  companyName: z.string().max(255),
  signaturePath: z.string().max(255).nullable(),
  email: z.string().max(255).nullable(),
  phone: z.string().max(20).nullable(),
  address: z.string().max(255).nullable(),
  address2: z.string().max(255).nullable(),
  website: z.string().max(255).nullable(),
  facebookLink: z.string().max(255).nullable(),
  instagramLink: z.string().max(255).nullable(),
  linkedinLink: z.string().max(255).nullable(),
  twitterLink: z.string().max(255).nullable(),
  userId: z.string().uuid(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type CompanyData = z.infer<typeof CompanyDataSchema>;

export const CompanyDataResponseSchema = CompanyDataSchema;
export class CompanyDataResponse extends createZodDto(CompanyDataResponseSchema) {}