import type { TrashedMode } from '../../../../shared/crud/trashed.util';

export class ListContactSupportQuery {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly readed?: boolean,
    public readonly trashed: TrashedMode = 'exclude',
  ) {}
}
