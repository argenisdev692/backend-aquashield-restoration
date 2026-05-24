export type ExportBackupsFormat = 'csv' | 'xlsx' | 'pdf';

export class ExportBackupsQuery {
  constructor(
    public readonly format: ExportBackupsFormat,
    public readonly actorId: string,
  ) {}
}

export interface ExportBackupsResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
