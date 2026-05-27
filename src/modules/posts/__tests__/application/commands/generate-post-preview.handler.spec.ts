import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { GeneratePostPreviewHandler } from '../../../application/commands/handlers/generate-post-preview.handler';
import { GeneratePostPreviewCommand } from '../../../application/commands/generate-post-preview.command';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../../shared/cache/cache.port';
import { MESSAGING_REDIS_CONNECTION } from '../../../../../shared/messaging/messaging.constants';
import { QUEUE_NAMES } from '../../../../../shared/messaging/queues.constants';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { GeneratePostPreviewInput } from '../../../application/dtos/generate-post-preview.dto';
import { GeneratedPostPreview } from '../../../domain/value-objects/generated-post-preview.vo';

describe('GeneratePostPreviewHandler', () => {
  let handler: GeneratePostPreviewHandler;
  let mockCache: jest.Mocked<ICachePort>;
  let mockQueue: { add: jest.Mock };
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;

  const baseDto: GeneratePostPreviewInput = {
    topic: 'How to optimize React performance',
    niche: 'Web Development',
    wordCount: 1200,
  };

  const mockPreview = new GeneratedPostPreview(
    '# Test Content\n\nThis is a test article.',
    'how-to-optimize-react-performance',
    'A concise excerpt about React performance.',
    'React Performance Optimization Guide',
    'Learn how to make your React apps faster.',
    'react, performance, optimization',
    'https://cdn.example.com/ai/posts/hero.jpg',
    [],
  );

  beforeEach(async () => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };

    // Mock BullMQ Queue — the handler only calls .add() and relies on the returned job's waitUntilFinished
    const fakeJob = {
      id: 'job-123',
      waitUntilFinished: jest.fn().mockResolvedValue(mockPreview),
    };
    mockQueue = {
      add: jest.fn().mockResolvedValue(fakeJob),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockCls = {
      get: jest.fn().mockReturnValue('trace-abc-123'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePostPreviewHandler,
        { provide: CACHE_PORT, useValue: mockCache },
        {
          provide: getQueueToken(QUEUE_NAMES.AI_GENERATION),
          useValue: mockQueue,
        },
        {
          provide: MESSAGING_REDIS_CONNECTION,
          useValue: { on: jest.fn(), off: jest.fn() }, // minimal ioredis mock for QueueEvents
        },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(GeneratePostPreviewHandler);
  });

  it('returns cached preview immediately (cache hit — no job enqueued)', async () => {
    mockCache.get.mockResolvedValueOnce(mockPreview);

    const command = new GeneratePostPreviewCommand(baseDto, 'user-123');
    const result = await handler.execute(command);

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
    expect(result).toBe(mockPreview);
  });

  it('enqueues idempotent job and waits for result when cache misses', async () => {
    mockCache.get.mockResolvedValueOnce(null);

    const command = new GeneratePostPreviewCommand(baseDto, 'user-123');
    const result = await handler.execute(command);

    expect(mockCache.get).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledTimes(1);

    // Verify the job is enqueued with stable data + deterministic jobId (idempotency)
    const [jobName, jobData, jobOpts] = mockQueue.add.mock.calls[0];
    expect(jobName).toBe('generate-post-preview');
    expect(jobData).toEqual({
      topic: baseDto.topic,
      niche: baseDto.niche,
      wordCount: baseDto.wordCount,
    });
    expect(jobOpts).toEqual(
      expect.objectContaining({ jobId: expect.any(String) }),
    );

    expect(result).toBe(mockPreview);
  });

  it('logs start + job enqueued + completed with traceId', async () => {
    mockCache.get.mockResolvedValueOnce(null);

    const command = new GeneratePostPreviewCommand(baseDto, 'user-123');
    await handler.execute(command);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'GeneratePostPreviewHandler start',
      expect.objectContaining({
        traceId: 'trace-abc-123',
        topic: baseDto.topic,
      }),
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'GeneratePostPreviewHandler job enqueued',
      expect.objectContaining({ traceId: 'trace-abc-123' }),
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'GeneratePostPreviewHandler job completed',
      expect.objectContaining({
        traceId: 'trace-abc-123',
        hasImage: true,
        sourcesCount: 0,
      }),
    );
  });
});
