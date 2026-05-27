import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ExportContactSupportHandler } from '../../application/queries/handlers/export-contact-support.handler';
import { ExportContactSupportQuery } from '../../application/queries/export-contact-support.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import type { ContactSupportReadModel } from '../../domain/read-models/contact-support.read-model';

const ACTOR = 'admin-uuid';

function row(
  over: Partial<ContactSupportReadModel> = {},
): ContactSupportReadModel {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@acme.com',
    phone: '+1-555-0100',
    subject: 'Help',
    message: 'message body',
    smsConsent: false,
    readed: false,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

describe('ExportContactSupportHandler', () => {
  let handler: ExportContactSupportHandler;
  let repo: { findAllForExport: jest.Mock };
  let audit: { log: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = { findAllForExport: jest.fn().mockResolvedValue([row()]) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportContactSupportHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: LoggerService, useValue: logger },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(ExportContactSupportHandler);
  });

  describe('CSV', () => {
    it('returns a CSV buffer with header row + UTF-8 BOM and audits', async () => {
      const result = await handler.execute(
        new ExportContactSupportQuery('csv', ACTOR, undefined, 'exclude'),
      );

      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.filename).toMatch(/^contact-support-.*\.csv$/);

      // BOM
      expect(result.buffer.subarray(0, 3)).toEqual(
        Buffer.from([0xef, 0xbb, 0xbf]),
      );

      const text = result.buffer.subarray(3).toString('utf8');
      expect(text.startsWith('id,firstName,lastName')).toBe(true);
      expect(text).toContain('john@acme.com');

      expect(repo.findAllForExport).toHaveBeenCalledWith({
        readed: undefined,
        trashed: 'exclude',
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contact_support.export',
          actorId: ACTOR,
          resourceType: 'CONTACT',
          metadata: { format: 'csv', trashed: 'exclude', count: 1 },
        }),
      );
    });

    it('neutralizes CSV formula-injection attempts', async () => {
      repo.findAllForExport.mockResolvedValueOnce([
        row({ firstName: '=SUM(A1:A99)', subject: '+CMD' }),
      ]);

      const result = await handler.execute(
        new ExportContactSupportQuery('csv', ACTOR),
      );
      const text = result.buffer.subarray(3).toString('utf8');

      // Leading `=` and `+` must be prefixed with a single quote inside the quoted cell.
      expect(text).toContain('"\'=SUM(A1:A99)"');
      expect(text).toContain('"\'+CMD"');
    });

    it('forwards trashed=only when requested', async () => {
      repo.findAllForExport.mockResolvedValueOnce([]);
      await handler.execute(
        new ExportContactSupportQuery('csv', ACTOR, undefined, 'only'),
      );
      expect(repo.findAllForExport).toHaveBeenCalledWith({
        readed: undefined,
        trashed: 'only',
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { format: 'csv', trashed: 'only', count: 0 },
        }),
      );
    });
  });

  describe('PDF', () => {
    it('returns a PDF buffer (starts with %PDF magic) and audits', async () => {
      const result = await handler.execute(
        new ExportContactSupportQuery('pdf', ACTOR),
      );

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^contact-support-.*\.pdf$/);
      expect(result.buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contact_support.export',
          metadata: expect.objectContaining({ format: 'pdf', count: 1 }),
        }),
      );
    });
  });
});
