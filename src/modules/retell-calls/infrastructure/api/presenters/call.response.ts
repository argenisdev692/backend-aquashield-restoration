import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { entityStatus } from '../../../../../shared/crud/trashed.util';
import type { RetellCallReadModel } from '../../../domain/repositories/retell-call-repository.interface';

export const CallResponseSchema = z.object({
  id: z.uuid(),
  callId: z.string(),
  agentId: z.string().nullable(),
  callType: z.string().nullable(),
  direction: z.string().nullable(),
  fromNumber: z.string().nullable(),
  toNumber: z.string().nullable(),
  callStatus: z.string().nullable(),
  disconnectionReason: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().nullable(),
  userSentiment: z.string().nullable(),
  callSummary: z.string().nullable(),
  transcript: z.string().nullable(),
  /** Playable audio URL — bind directly to a frontend <audio> element. */
  recordingUrl: z.string().nullable(),
  isRead: z.boolean(),
  /** Derived soft-delete badge so the client renders without null-checks. */
  status: z.enum(['active', 'suspended']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

export class CallResponse extends createZodDto(CallResponseSchema) {}

/** Read model + derived `status`. Dates are serialized to ISO by Nest. */
export type CallView = RetellCallReadModel & {
  status: 'active' | 'suspended';
};

export function toCallView(rm: RetellCallReadModel): CallView {
  return { ...rm, status: entityStatus(rm.deletedAt) };
}
