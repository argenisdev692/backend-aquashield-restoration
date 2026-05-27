import { z } from 'zod';

/**
 * Branded type for FunnelStage.
 * Allowed values: TOFU | MOFU | BOFU | LOYALTY
 */
export type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU' | 'LOYALTY';

export const FUNNEL_STAGES: readonly FunnelStage[] = [
  'TOFU',
  'MOFU',
  'BOFU',
  'LOYALTY',
] as const;

export const FunnelStageSchema = z.enum(FUNNEL_STAGES);

export class InvalidFunnelStageException extends Error {
  constructor(value: unknown) {
    super(
      `Invalid funnel stage: ${String(value)}. Allowed: ${FUNNEL_STAGES.join(', ')}`,
    );
    this.name = 'InvalidFunnelStageException';
  }
}

/**
 * Value Object for a single funnel stage.
 * Enforces allowed values at construction.
 */
export class FunnelStageVO {
  private constructor(public readonly value: FunnelStage) {}

  static create(value: unknown): FunnelStageVO {
    const parsed = FunnelStageSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidFunnelStageException(value);
    }
    return new FunnelStageVO(parsed.data);
  }

  static fromString(value: string): FunnelStageVO {
    return FunnelStageVO.create(value);
  }

  equals(other: FunnelStageVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
