import { SocialMediaGenerationAggregate } from '../../domain/entities/social-media-generation.aggregate';
import { SocialMediaGenerationDomainException } from '../../domain/exceptions/social-media-generation-domain.exception';

describe('SocialMediaGenerationAggregate (pure domain, zero NestJS/Prisma)', () => {
  const validParams = {
    userId: '11111111-1111-1111-1111-111111111111',
    niche: 'AI Productivity',
    topicTitle: 'How AI is changing work in 2026',
    topicDescription: 'A deep dive into new workflows',
    language: 'es',
    networks: { linkedin: true, twitter: false },
  };

  it('creates a valid aggregate with at least one network', () => {
    const agg = SocialMediaGenerationAggregate.create(validParams);

    expect(agg.id).toBeDefined();
    expect(agg.userId).toBe(validParams.userId);
    expect(agg.topicTitle).toBe(validParams.topicTitle);
    expect(agg.networks.linkedin).toBe(true);
    expect(agg.canBeDeletedBy(validParams.userId)).toBe(true);
    expect(agg.canBeDeletedBy('other-user')).toBe(false);
  });

  it('throws when no network is selected', () => {
    expect(() =>
      SocialMediaGenerationAggregate.create({
        ...validParams,
        networks: { linkedin: false },
      }),
    ).toThrow(SocialMediaGenerationDomainException);
  });

  it('throws when topicTitle is too short', () => {
    expect(() =>
      SocialMediaGenerationAggregate.create({
        ...validParams,
        topicTitle: 'ab',
      }),
    ).toThrow(SocialMediaGenerationDomainException);
  });

  it('enforces addGeneratedPost only for selected networks', () => {
    const agg = SocialMediaGenerationAggregate.create(validParams);

    expect(() =>
      agg.addGeneratedPost('facebook', { body: 'x', hashtags: [] }),
    ).toThrow(SocialMediaGenerationDomainException);

    // linkedin is selected
    agg.addGeneratedPost('linkedin', { body: 'hello linkedin', hashtags: ['#ai'] });
    expect(agg.generatedPosts.linkedin?.body).toContain('hello linkedin');
  });

  it('toSnapshot returns plain serializable shape', () => {
    const agg = SocialMediaGenerationAggregate.create(validParams);
    const snap = agg.toSnapshot();

    expect(snap).not.toHaveProperty('addGeneratedPost');
    expect(snap.networks).toEqual({ linkedin: true });
  });
});
