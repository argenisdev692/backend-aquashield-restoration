import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Retell webhook envelope: `{ event, call }`. The `call` object is large and
 * evolves over time, so we validate only the fields we read and keep the rest
 * via `looseObject` (stored verbatim in `retell_calls.raw`).
 *
 * `event` is left as a free string: Retell may add event types, and rejecting
 * an unknown one with a 400 would trigger its retry loop. We ack everything
 * and act only on `call_analyzed` in the use-case.
 */
export const RetellCallObjectSchema = z.looseObject({
  call_id: z.string().min(1),
  agent_id: z.string().optional(),
  call_type: z.string().optional(),
  direction: z.string().optional(),
  from_number: z.string().optional(),
  to_number: z.string().optional(),
  call_status: z.string().optional(),
  disconnection_reason: z.string().optional(),
  start_timestamp: z.number().optional(),
  end_timestamp: z.number().optional(),
  duration_ms: z.number().optional(),
  recording_url: z.string().optional(),
  transcript: z.string().optional(),
  call_analysis: z
    .looseObject({
      call_summary: z.string().optional(),
      user_sentiment: z.string().optional(),
    })
    .optional(),
});

export const RetellWebhookSchema = z.object({
  event: z.string().min(1),
  call: RetellCallObjectSchema,
});

export type RetellWebhookPayload = z.infer<typeof RetellWebhookSchema>;
export type RetellCallObject = z.infer<typeof RetellCallObjectSchema>;

export class RetellWebhookDto extends createZodDto(RetellWebhookSchema) {}
