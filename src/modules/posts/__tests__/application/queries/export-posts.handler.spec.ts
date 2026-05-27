import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ExportPostsHandler } from '../../../application/queries/handlers/export-posts.handler';
import { ExportPostsQuery } from '../../../application/queries/export-posts.query';
import {
  POST_REPOSITORY,
  type IPostRepository,
} from '../../../domain/repositories/post-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';

describe('ExportPostsHandler', () => {
  let handler: ExportPostsHandler;
  let mockRepo: jest.Mocked<IPostRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdBySlug: jest.fn(),
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findScheduledDue: jest.fn(),
    };
    mockAudit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportPostsHandler,
        { provide: POST_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(ExportPostsHandler);
  });

  const fmt = 'xlsx' as const;
  const baseDto = { format: fmt };
  const actor = 'actor-1';

  it('forwards trashed=exclude when no flag is passed', async () => {
    await handler.execute(new ExportPostsQuery(baseDto, fmt, actor));
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'exclude' }),
    );
  });

  it('forwards trashed=include when withTrashed=true', async () => {
    await handler.execute(
      new ExportPostsQuery({ ...baseDto, withTrashed: true }, fmt, actor),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'include' }),
    );
  });

  it('forwards trashed=only when onlyTrashed=true', async () => {
    await handler.execute(
      new ExportPostsQuery({ ...baseDto, onlyTrashed: true }, fmt, actor),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'only' }),
    );
  });

  it('always audits the export', async () => {
    await handler.execute(
      new ExportPostsQuery({ ...baseDto, onlyTrashed: true }, fmt, actor),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'posts.export',
        actorId: actor,
      }),
      expect.anything(),
    );
  });

  describe('format-specific buffers', () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      postTitle: 'Test Post',
      postTitleSlug: 'test-post',
      postContent: 'Content here',
      postExcerpt: 'Excerpt',
      postCoverImage: null,
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      categoryId: null,
      userId: null,
      postStatus: 'draft' as const,
      scheduledAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      categoryName: null,
      userName: null,
    };

    beforeEach(() => {
      mockRepo.findAll.mockResolvedValue({
        data: [row],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('csv → text/csv with UTF-8 BOM and header row', async () => {
      const res = await handler.execute(
        new ExportPostsQuery({ format: 'csv' }, 'csv', actor),
      );
      expect(res.contentType).toBe('text/csv; charset=utf-8');
      expect(res.filename).toMatch(/^posts-.+\.csv$/);
      expect(res.buffer.slice(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const csv = res.buffer.slice(3).toString('utf8');
      expect(csv.split('\r\n')[0]).toContain('id,postTitle,postTitleSlug');
      expect(csv).toContain('Test Post');
    });

    it('xlsx → spreadsheetml MIME with ZIP magic bytes', async () => {
      const res = await handler.execute(
        new ExportPostsQuery({ format: 'xlsx' }, 'xlsx', actor),
      );
      expect(res.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.filename).toMatch(/^posts-.+\.xlsx$/);
      expect(res.buffer.slice(0, 4)).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
    });

    it('pdf → application/pdf with %PDF magic header', async () => {
      const res = await handler.execute(
        new ExportPostsQuery({ format: 'pdf' }, 'pdf', actor),
      );
      expect(res.contentType).toBe('application/pdf');
      expect(res.filename).toMatch(/^posts-.+\.pdf$/);
      expect(res.buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('csv defuses formula injection', async () => {
      mockRepo.findAll.mockResolvedValue({
        data: [{ ...row, postTitle: '=cmd|"/c calc"!A1' }],
        total: 1,
        page: 1,
        limit: 20,
      });
      const res = await handler.execute(
        new ExportPostsQuery({ format: 'csv' }, 'csv', actor),
      );
      const csv = res.buffer.slice(3).toString('utf8');
      expect(csv).toContain('"\'=cmd|""/c calc""!A1"');
    });
  });
});
