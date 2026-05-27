import { ListMyCampaignExportsHandler } from '../../../../application/queries/handlers/list-my-campaign-exports.handler';
import { ListMyCampaignExportsQuery } from '../../../../application/queries/list-my-campaign-exports.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../../domain/ports/campaign-generation.repository.port';
import { LoggerService } from '../../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('ListMyCampaignExportsHandler', () => {
  let handler: ListMyCampaignExportsHandler;
  let campaignRepo: { findByUserId: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };

  beforeEach(() => {
    campaignRepo = { findByUserId: jest.fn().mockResolvedValue([]) };
    logger = { info: jest.fn(), setContext: jest.fn() };
    cls = { get: jest.fn().mockReturnValue('trace-123') };

    handler = new ListMyCampaignExportsHandler(
      campaignRepo as any,
      logger as any,
      cls as any,
    );
  });

  it('should NOT call audit.log (read path)', async () => {
    await handler.execute(
      new ListMyCampaignExportsQuery('user-1', { limit: 10, offset: 0 }),
    );

    expect(campaignRepo.findByUserId).toHaveBeenCalledWith('user-1', {
      limit: 10,
      offset: 0,
      withTrashed: false,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('ListMyCampaignExportsHandler'),
      expect.any(Object),
    );
  });

  it('should return empty array when no exports exist', async () => {
    const result = await handler.execute(
      new ListMyCampaignExportsQuery('user-1'),
    );

    expect(result).toEqual([]);
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
      createdAt: new Date('2025-01-01'),
    };
    campaignRepo.findByUserId.mockResolvedValue([mockAggregate]);

    const result = await handler.execute(
      new ListMyCampaignExportsQuery('user-1'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'gen-1',
      companyName: 'Acme Corp',
      niche: 'Fitness',
      status: 'completed',
      stagesRequested: 2,
      stagesCompleted: 2,
      hasErrors: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
  });
});
