import { z } from 'zod';
import { CreateCompanyDataSchema } from './create-companydata.dto';

export const UpdateCompanyDataSchema = CreateCompanyDataSchema.partial();

export type UpdateCompanyDataDto = z.infer<typeof UpdateCompanyDataSchema>;
