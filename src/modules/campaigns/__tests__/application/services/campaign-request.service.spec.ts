import { CampaignRequestService } from '../../../application/services/campaign-request.service';
import type { CampaignGenerationRequestInput } from '../../../application/services/campaign-request.service';

describe('CampaignRequestService', () => {
  let service: CampaignRequestService;
  let campaignRepo: { save: jest.Mock };
  let companyDataLookup: { getCompanyNameByIdForUser: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const input: CampaignGenerationRequestInput = {
    companyDataId: 'c-1',
    niche: 'Fitness',
    location: 'Madrid',
    phone: '+34',
    stages: ['TOFU'],
    format: '9:16',
    durationSeconds: 15,
    language: 'es',
    generateImages: false,
  };

  beforeEach(() => {
    campaignRepo = { save: jest.fn().mockResolvedValue('gen-123') };
    companyDataLookup = {
      getCompanyNameByIdForUser: jest.fn().mockResolvedValue('Acme Corp'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    cache = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    logger = { info: jest.fn(), setContext: jest.fn() };
    cls = { get: jest.fn().mockReturnValue('trace-xyz') };
    eventEmitter = { emit: jest.fn() };

    service = new CampaignRequestService(
      campaignRepo as never,
      audit as never,
      cache as never,
      companyDataLookup as never,
      eventEmitter as never,
      logger as never,
      cls as never,
    );
  });

  it('audits with strict:true and invalidates the http cache key on success', async () => {
    const result = await service.requestGeneration({
      input,
      actorId: 'user-1',
      auditAction: 'campaigns.export_requested',
    });

    expect(result).toBe('gen-123');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaigns.export_requested' }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/campaigns*');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'campaign.export.requested',
      expect.anything(),
    );
  });

  it('throws NotFound and does not audit when company lookup fails', async () => {
    companyDataLookup.getCompanyNameByIdForUser.mockResolvedValueOnce(null);

    await expect(
      service.requestGeneration({
        input,
        actorId: 'user-1',
        auditAction: 'campaigns.export_requested',
      }),
    ).rejects.toThrow();

    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
  });
});
