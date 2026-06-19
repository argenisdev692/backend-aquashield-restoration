/** Soft-delete / restore lifecycle events — drive the realtime gateway only. */

export class RetellCallDeletedEvent {
  static readonly eventName = 'retell-call.deleted';
  constructor(public readonly recordId: string) {}
}

export class RetellCallRestoredEvent {
  static readonly eventName = 'retell-call.restored';
  constructor(public readonly recordId: string) {}
}

export class RetellCallsBulkDeletedEvent {
  static readonly eventName = 'retell-call.bulk_deleted';
  constructor(public readonly recordIds: readonly string[]) {}
}

export class RetellCallsBulkRestoredEvent {
  static readonly eventName = 'retell-call.bulk_restored';
  constructor(public readonly recordIds: readonly string[]) {}
}
