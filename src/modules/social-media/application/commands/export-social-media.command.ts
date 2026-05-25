import type { ExportSocialMediaInput } from '../dtos/export-social-media.dto';

/**
 * Command: ExportSocialMediaCommand (Full Hex/DDD)
 * Export is a privileged, auditable operation → modeled as Command (not Query).
 * Plain TS class.
 */
export class ExportSocialMediaCommand {
  constructor(
    public readonly dto: ExportSocialMediaInput,
    public readonly actorId: string,
  ) {}
}

export interface ExportSocialMediaResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
