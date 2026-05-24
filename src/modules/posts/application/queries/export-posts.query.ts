import type { ExportPostsInput } from '../dtos/export-posts.dto';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export class ExportPostsQuery {
  constructor(
    public readonly dto: ExportPostsInput,
    public readonly format: ExportFormat,
    public readonly userId: string,
  ) {}
}

export interface ExportPostsResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
