import { RequestCampaignExportHandler } from '../../../../application/commands/handlers/request-campaign-export.handler';
import { RequestCampaignExportCommand } from '../../../../application/commands/request-campaign-export.command';
import type { CampaignRequestService } from '../../../../application/services/campaign-request.service';

// Mock the transactional decorator so it becomes a no-op in tests
jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

describe('RequestCampaignExportHandler', () => {
  let handler: RequestCampaignExportHandler;
  let campaignRequest: { requestGeneration: jest.Mock };

  beforeEach(() => {
    campaignRequest = {
      requestGeneration: jest.fn().mockResolvedValue('gen-123'),
    };
    handler = new RequestCampaignExportHandler(
      campaignRequest as unknown as CampaignRequestService,
    );
  });

  it('delegates to CampaignRequestService with the export_requested audit action', async () => {
    const cmd = new RequestCampaignExportCommand(
      {
        companyDataId: 'c-1',
        niche: 'Fitness',
        location: 'Madrid',
        phone: '+34',
        stages: ['TOFU'],
        format: '9:16',
        durationSeconds: 15,
        language: 'es',
        generateImages: false,
      } as never,
      'user-1',
    );

    const result = await handler.execute(cmd);

    expect(result).toBe('gen-123');
    expect(campaignRequest.requestGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        auditAction: 'campaigns.export_requested',
      }),
    );
  });
});
