import { CampaignGeneration } from '../../../domain/entities/campaign-generation.aggregate';
import type { FunnelStage } from '../../../domain/value-objects/funnel-stage.vo';

describe('CampaignGeneration', () => {
  const baseProps = {
    userId: 'user-123',
    companyDataId: 'company-456',
    companyNameSnapshot: 'Acme Corp',
    niche: 'Fitness',
    location: 'Madrid',
    phone: '+34600111222',
    website: 'https://acme.com',
    stages: ['TOFU', 'MOFU'] as FunnelStage[],
    format: '9:16' as const,
    durationSeconds: 15 as const,
    language: 'es',
    generateImages: false,
  };

  it('should create a valid aggregate and emit domain event on first creation', () => {
    const agg = CampaignGeneration.create(baseProps);

    expect(agg.id).toBeNull();
    expect(agg.userId).toBe('user-123');
    expect(agg.status).toBe('pending');
    expect(agg.domainEvents.length).toBe(1);
  });

  it('should transition status correctly', () => {
    const agg = CampaignGeneration.create(baseProps);
    agg.markProcessing();
    expect(agg.status).toBe('processing');

    agg.complete();
    expect(['completed', 'partial', 'failed']).toContain(agg.status);
  });

  it('should throw on invalid status transition', () => {
    const agg = CampaignGeneration.create(baseProps);
    agg.complete();
    expect(() => agg.markProcessing()).toThrow();
  });
});
