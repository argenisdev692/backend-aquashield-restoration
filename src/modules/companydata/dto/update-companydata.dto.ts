import { z } from 'zod';

export const UpdateCompanyDataSchema = z
  .object({
    name: z.string().max(255).optional(),
    companyName: z.string().max(255).optional(),
    taxId: z.string().max(50).optional().or(z.literal('')),
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
  })
  .strict();

export type UpdateCompanyDataDto = z.infer<typeof UpdateCompanyDataSchema>;
