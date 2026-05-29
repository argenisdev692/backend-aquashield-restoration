import { z } from 'zod';

export const DownloadZipSchema = z.object({
  id: z.string().uuid(),
});

export class DownloadZipCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}

export interface DownloadZipResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
