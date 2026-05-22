import type { TrashedMode } from '../../../../shared/crud/trashed.util';

export type ExportFormat = 'csv' | 'pdf';

export class ExportContactSupportQuery {
  constructor(
    public readonly format: ExportFormat,
    public readonly actorId: string,
    public readonly readed?: boolean,
    public readonly trashed: TrashedMode = 'exclude',
  ) {}
}

export interface ExportContactSupportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
