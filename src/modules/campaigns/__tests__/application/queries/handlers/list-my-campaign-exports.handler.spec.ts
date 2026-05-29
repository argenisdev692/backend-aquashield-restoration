import { ListMyCampaignExportsHandler } from '../../../../application/queries/handlers/list-my-campaign-exports.handler';
import { ListMyCampaignExportsQuery } from '../../../../application/queries/list-my-campaign-exports.query';

describe('ListMyCampaignExportsHandler', () => {
  let handler: ListMyCampaignExportsHandler;
  let campaignRepo: { findByUserId: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };

  beforeEach(() => {
    campaignRepo = {
      findByUserId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    logger = { info: jest.fn(), setContext: jest.fn() };
    cls = { get: jest.fn().mockReturnValue('trace-123') };

    handler = new ListMyCampaignExportsHandler(
      campaignRepo as never,
      logger as never,
      cls as never,
    );
  });

  it('should NOT call audit.log (read path) and query the repo', async () => {
    await handler.execute(
      new ListMyCampaignExportsQuery('user-1', { limit: 10, offset: 0 }),
    );

    expect(campaignRepo.findByUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ limit: 10, offset: 0, withTrashed: false }),
    );
  });

  it('should return empty data when no exports exist', async () => {
    const result = await handler.execute(
      new ListMyCampaignExportsQuery('user-1', {}),
    );

    expect(result).toEqual({ data: [], total: 0 });
  });

  it('should map aggregates to list items correctly', async () => {
    const mockAggregate = {
      id: 'gen-1',
      companyNameSnapshot: 'Acme Corp',
      niche: 'Fitness',
      status: 'completed',
      stages: ['TOFU', 'MOFU'],
      stageResults: [
        { isSuccess: () => true, isFailure: () => false },
        { isSuccess: () => true, isFailure: () => false },
      ],
      viralityScore: 80,
      roiScore: 72,
      createdAt: new Date('2025-01-01'),
    };
    campaignRepo.findByUserId.mockResolvedValue({
      data: [mockAggregate],
      total: 1,
    });

    const result = await handler.execute(
      new ListMyCampaignExportsQuery('user-1', {}),
    );

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      id: 'gen-1',
      companyName: 'Acme Corp',
      niche: 'Fitness',
      status: 'completed',
      stagesRequested: 2,
      stagesCompleted: 2,
      hasErrors: false,
      viralityScore: 80,
      roiScore: 72,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
  });
});
