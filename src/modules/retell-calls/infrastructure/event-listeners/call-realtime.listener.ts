import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RetellCallsGateway } from '../gateways/retell-calls.gateway';
import { RetellCallRecordedEvent } from '../../domain/events/retell-call-recorded.domain-event';
import {
  RetellCallDeletedEvent,
  RetellCallRestoredEvent,
  RetellCallsBulkDeletedEvent,
  RetellCallsBulkRestoredEvent,
} from '../../domain/events/retell-call-lifecycle.events';

/** Pushes Retell call lifecycle changes to the admin dashboard over WS. */
@Injectable()
export class CallRealtimeListener {
  constructor(private readonly gateway: RetellCallsGateway) {}

  @OnEvent(RetellCallRecordedEvent.eventName)
  onRecorded(event: RetellCallRecordedEvent): void {
    this.gateway.broadcastCallRecorded(event.recordId, event.callId);
  }

  @OnEvent(RetellCallDeletedEvent.eventName)
  onDeleted(event: RetellCallDeletedEvent): void {
    this.gateway.broadcastCallDeleted(event.recordId);
  }

  @OnEvent(RetellCallRestoredEvent.eventName)
  onRestored(event: RetellCallRestoredEvent): void {
    this.gateway.broadcastCallRestored(event.recordId);
  }

  @OnEvent(RetellCallsBulkDeletedEvent.eventName)
  onBulkDeleted(event: RetellCallsBulkDeletedEvent): void {
    this.gateway.broadcastBulkDeleted(event.recordIds);
  }

  @OnEvent(RetellCallsBulkRestoredEvent.eventName)
  onBulkRestored(event: RetellCallsBulkRestoredEvent): void {
    this.gateway.broadcastBulkRestored(event.recordIds);
  }
}
