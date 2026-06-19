import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Retell from 'retell-sdk';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { verifyRetellSignature } from './retell-signature.util';
import {
  RetellCallObjectSchema,
  type RetellCallObject,
} from '../../application/dtos/retell-webhook.dto';
import type {
  IRetellApiPort,
  RetellListCallsFilter,
} from '../../domain/ports/outbound/retell-api.port.interface';
import type { IRetellWebhookVerifier } from '../../domain/ports/outbound/webhook-verifier.port.interface';

/**
 * Single adapter to the Retell platform:
 *  - {@link IRetellApiPort}        — REST client for backfill/sync (resilient).
 *  - {@link IRetellWebhookVerifier} — HMAC-SHA256 verification of inbound
 *    webhooks. The installed `retell-sdk` (Stainless) dropped `Retell.verify`,
 *    so we reproduce its documented scheme: hex HMAC of the RAW body keyed by
 *    the API key, compared in constant time.
 */
@Injectable()
export class RetellSdkAdapter
  implements IRetellApiPort, IRetellWebhookVerifier, OnModuleInit
{
  private client!: Retell;
  private apiKey!: string;
  private policy!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RetellSdkAdapter.name);
  }

  onModuleInit(): void {
    this.apiKey = this.config.getOrThrow<string>('RETELL_AI_API_KEY');
    this.client = new Retell({ apiKey: this.apiKey });
    this.policy = createExternalServicePolicy('retell', 'http-default');
  }

  verify(rawBody: string, signature: string | undefined): boolean {
    return verifyRetellSignature(rawBody, signature, this.apiKey);
  }

  async listCalls(filter?: RetellListCallsFilter): Promise<RetellCallObject[]> {
    const traceId = this.cls.get<string>('traceId');
    const response = await this.policy.execute(() =>
      this.client.call.list({
        limit: filter?.limit ?? 100,
        sort_order: 'descending',
        ...(filter?.startTimestampMs != null && filter?.endTimestampMs != null
          ? {
              filter_criteria: {
                start_timestamp: {
                  op: 'bt',
                  type: 'range',
                  value: [filter.startTimestampMs, filter.endTimestampMs],
                },
              },
            }
          : {}),
      }),
    );

    const calls: RetellCallObject[] = [];
    for (const item of response.items ?? []) {
      const parsed = RetellCallObjectSchema.safeParse(item);
      if (parsed.success) calls.push(parsed.data);
      else
        this.logger.warn('Skipping malformed Retell call in list response', {
          traceId,
        });
    }
    return calls;
  }

  async getCall(callId: string): Promise<RetellCallObject | null> {
    const response = await this.policy.execute(() =>
      this.client.call.retrieve(callId),
    );
    const parsed = RetellCallObjectSchema.safeParse(response);
    return parsed.success ? parsed.data : null;
  }
}
