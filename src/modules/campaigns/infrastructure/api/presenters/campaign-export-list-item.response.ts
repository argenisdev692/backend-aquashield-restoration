import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CampaignExportListItemResponseSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  niche: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'partial']),
  stagesRequested: z.number().int(),
  stagesCompleted: z.number().int(),
  hasErrors: z.boolean(),
  createdAt: z.string().datetime(),
});

export class CampaignExportListItemResponse extends createZodDto(
  CampaignExportListItemResponseSchema,
) {}
