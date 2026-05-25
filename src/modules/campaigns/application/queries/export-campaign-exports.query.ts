import type { ExportCampaignExportsInput } from '../dtos/export-campaign-exports.dto';

export type CampaignExportFormat = 'csv' | 'xlsx' | 'pdf';

export class ExportCampaignExportsQuery {
  constructor(
    public readonly dto: ExportCampaignExportsInput,
    public readonly actorId: string,
  ) {}
}

export interface CampaignExportFileResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
