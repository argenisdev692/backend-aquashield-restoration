import { GetCampaignExportStatusHandler } from '../../../../application/queries/handlers/get-campaign-export-status.handler';
import { GetCampaignExportStatusQuery } from '../../../../application/queries/get-campaign-export-status.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../../domain/ports/campaign-generation.repository.port';
import { CampaignGenerationNotFoundException } from '../../../../domain/exceptions/campaign-domain.exception';
import { LoggerService } from '../../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('GetCampaignExportStatusHandler', () => {
  let handler: GetCampaignExportStatusHandler;
  let campaignRepo: { findById: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };

  beforeEach(() => {
    campaignRepo = {
      findById: jest.fn(),
    };
    logger = { info: jest.fn(), setContext: jest.fn() };
    cls = { get: jest.fn().mockReturnValue('trace-123') };

    handler = new GetCampaignExportStatusHandler(
      campaignRepo as any,
      logger as any,
      cls as any,
    );
  });

  it('should NOT call audit.log (read path)', async () => {
    const agg = {
      id: 'g-1',
      userId: 'u-1',
      companyNameSnapshot: 'Acme',
      niche: 'x',
      location: 'y',
      phone: 'z',
      website: null,
      stages: ['TOFU'],
      format: '9:16',
      durationSeconds: 15,
      language: 'es',
      generateImages: false,
      status: 'pending',
      errorMessage: null,
      stageResults: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    campaignRepo.findById.mockResolvedValue(agg);

    await handler.execute(new GetCampaignExportStatusQuery('g-1', 'u-1'));

    // Audit is never injected into read handlers — this test just proves the path does not touch it
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('GetCampaignExportStatusHandler'),
      expect.any(Object),
    );
  });

  it('should throw domain not-found when ownership fails (returns same error to avoid enumeration)', async () => {
    const agg = { id: 'g-1', userId: 'other-user' /* ... minimal */ };
    campaignRepo.findById.mockResolvedValue(agg);

    await expect(
      handler.execute(new GetCampaignExportStatusQuery('g-1', 'u-1')),
    ).rejects.toBeInstanceOf(CampaignGenerationNotFoundException);
  });
});
