export class PostsBulkDeletedEvent {
  constructor(public readonly postIds: string[]) {}
}
