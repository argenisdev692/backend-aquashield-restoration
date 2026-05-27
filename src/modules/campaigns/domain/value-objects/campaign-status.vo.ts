import { z } from 'zod';

/**
 * Lifecycle status for a CampaignGeneration export request.
 */
export type CampaignStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partial';

export const CAMPAIGN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'partial',
] as const;

export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUSES);

export class InvalidCampaignStatusException extends Error {
  constructor(value: unknown) {
    super(
      `Invalid campaign status: ${String(value)}. Allowed: ${CAMPAIGN_STATUSES.join(', ')}`,
    );
    this.name = 'InvalidCampaignStatusException';
  }
}

export class CampaignStatusVO {
  private constructor(public readonly value: CampaignStatus) {}

  static create(value: unknown): CampaignStatusVO {
    const parsed = CampaignStatusSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidCampaignStatusException(value);
    }
    return new CampaignStatusVO(parsed.data);
  }

  static pending(): CampaignStatusVO {
    return new CampaignStatusVO('pending');
  }

  static processing(): CampaignStatusVO {
    return new CampaignStatusVO('processing');
  }

  static completed(): CampaignStatusVO {
    return new CampaignStatusVO('completed');
  }

  static failed(): CampaignStatusVO {
    return new CampaignStatusVO('failed');
  }

  static partial(): CampaignStatusVO {
    return new CampaignStatusVO('partial');
  }

  isTerminal(): boolean {
    return (
      this.value === 'completed' ||
      this.value === 'failed' ||
      this.value === 'partial'
    );
  }

  canTransitionTo(next: CampaignStatusVO): boolean {
    const order: CampaignStatus[] = [
      'pending',
      'processing',
      'completed',
      'failed',
      'partial',
    ];
    const currentIdx = order.indexOf(this.value);
    const nextIdx = order.indexOf(next.value);
    // Only allow forward or terminal transitions (simplified state machine)
    return nextIdx >= currentIdx || next.isTerminal();
  }

  equals(other: CampaignStatusVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
