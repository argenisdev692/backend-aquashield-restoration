import { RequestCampaignExportHandler } from '../../../../application/commands/handlers/request-campaign-export.handler';
import { RequestCampaignExportCommand } from '../../../../application/commands/request-campaign-export.command';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../../domain/ports/campaign-generation.repository.port';
import { COMPANY_DATA_LOOKUP_PORT } from '../../../../domain/ports/outbound/company-data-lookup.port';
import { AUDIT_PORT } from '../../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock the transactional decorator so it becomes a no-op in tests
jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

describe('RequestCampaignExportHandler', () => {
  let handler: RequestCampaignExportHandler;
  let campaignRepo: { save: jest.Mock };
  let companyDataLookup: { getCompanyNameByIdForUser: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

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

    handler = new RequestCampaignExportHandler(
      campaignRepo as any,
      audit as any,
      cache as any,
      companyDataLookup as any,
      eventEmitter as any,
      logger as any,
      cls as any,
    );
  });

  it('should call audit.log with strict: true on successful export request', async () => {
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
      } as any,
      'user-1',
    );

    const result = await handler.execute(cmd);

    expect(result).toBe('gen-123');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaigns.export_requested' }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('campaigns:exports:*');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('start'),
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('end'),
      expect.any(Object),
    );
  });

  it('should throw NotFound when company lookup fails', async () => {
    companyDataLookup.getCompanyNameByIdForUser.mockResolvedValueOnce(null);

    const cmd = new RequestCampaignExportCommand(
      {
        companyDataId: 'bad',
        niche: 'x',
        location: 'y',
        phone: 'z',
        stages: ['TOFU'],
        format: '9:16',
        durationSeconds: 15,
      } as any,
      'user-1',
    );

    await expect(handler.execute(cmd)).rejects.toThrow();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
