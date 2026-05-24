export class PostsBulkRestoredEvent {
  constructor(public readonly postIds: string[]) {}
}
