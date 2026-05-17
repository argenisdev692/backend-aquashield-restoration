import { z } from 'zod';

export const CreateCompanyDataSchema = z.object({
  name: z.string().max(255).optional(),
  companyName: z.string().max(255),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  address2: z.string().max(255).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  facebookLink: z.string().url().max(255).optional().or(z.literal('')),
  instagramLink: z.string().url().max(255).optional().or(z.literal('')),
  linkedinLink: z.string().url().max(255).optional().or(z.literal('')),
  twitterLink: z.string().url().max(255).optional().or(z.literal('')),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type CreateCompanyDataDto = z.infer<typeof CreateCompanyDataSchema>;