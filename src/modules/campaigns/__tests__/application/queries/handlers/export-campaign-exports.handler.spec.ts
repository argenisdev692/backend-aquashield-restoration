import { ExportCampaignExportsHandler } from '../../../../application/queries/handlers/export-campaign-exports.handler';
import { ExportCampaignExportsQuery } from '../../../../application/queries/export-campaign-exports.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../../domain/ports/campaign-generation.repository.port';
import { AUDIT_PORT } from '../../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('ExportCampaignExportsHandler', () => {
  let handler: ExportCampaignExportsHandler;
  let campaignRepo: { findForExport: jest.Mock };
  let audit: { log: jest.Mock };
  let logger: { info: jest.Mock; setContext: jest.Mock };
  let cls: { get: jest.Mock };

  beforeEach(() => {
    campaignRepo = { findForExport: jest.fn().mockResolvedValue([]) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    logger = { info: jest.fn(), setContext: jest.fn() };
    cls = { get: jest.fn().mockReturnValue('trace-xyz') };

    handler = new ExportCampaignExportsHandler(
      campaignRepo as any,
      audit,
      logger as any,
      cls as any,
      { getFallbackName: () => 'Company' } as any,
    );
  });

  it('should call audit.log on export', async () => {
    const dto = { format: 'csv' as const };
    await handler.execute(new ExportCampaignExportsQuery(dto, 'user-1'));

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaigns.list_exported' }),
      { strict: true },
    );
  });

  it('should produce CSV with BOM header', async () => {
    const dto = { format: 'csv' as const };
    const result = await handler.execute(
      new ExportCampaignExportsQuery(dto, 'user-1'),
    );

    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.buffer[0]).toBe(0xef);
    expect(result.buffer[1]).toBe(0xbb);
    expect(result.buffer[2]).toBe(0xbf);
    expect(result.filename).toMatch(/^campaign-exports-.*\.csv$/);
  });

  it('should produce XLSX when format is xlsx', async () => {
    const dto = { format: 'xlsx' as const };
    const result = await handler.execute(
      new ExportCampaignExportsQuery(dto, 'user-1'),
    );

    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(result.filename).toMatch(/^campaign-exports-.*\.xlsx$/);
  });

  it('should produce PDF when format is pdf', async () => {
    const dto = { format: 'pdf' as const };
    const result = await handler.execute(
      new ExportCampaignExportsQuery(dto, 'user-1'),
    );

    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toMatch(/^campaign-exports-.*\.pdf$/);
  });

  it('should pass status + resolved date range to repository', async () => {
    const dto = {
      format: 'csv' as const,
      status: 'completed' as const,
      start_date: '2025-01-01',
      end_date: '2025-06-01',
    };
    await handler.execute(new ExportCampaignExportsQuery(dto, 'user-1'));

    expect(campaignRepo.findForExport).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: 'completed',
        dateRange: expect.objectContaining({
          startDate: expect.anything(),
          endDate: expect.anything(),
        }),
      }),
    );
  });
});
