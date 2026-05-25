import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { GeneratePostHandler } from '../../../../application/commands/handlers/generate-post.handler';
import { GeneratePostCommand } from '../../../../application/commands/generate-post.command';
import {
  SOCIAL_MEDIA_JOB_PORT,
  type ISocialMediaJobPort,
  type EnqueueGeneratePostResult,
} from '../../../../../domain/ports/social-media-job.port';
import { LoggerService } from '../../../../../logger/logger.service';

describe('GeneratePostHandler', () => {
  let handler: GeneratePostHandler;
  let mockJobPort: jest.Mocked<ISocialMediaJobPort>;

  beforeEach(async () => {
    mockJobPort = {
      enqueueGeneratePost: jest.fn().mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
      } as EnqueueGeneratePostResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePostHandler,
        { provide: SOCIAL_MEDIA_JOB_PORT, useValue: mockJobPort },
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

    handler = module.get(GeneratePostHandler);
  });

  it('enqueues the generation job via the port and returns job descriptor', async () => {
    const dto = {
      topic: { title: 'Test Topic', description: 'Test description for the topic' },
      networks: { linkedin: true },
      language: 'es',
    };

    const result = await handler.execute(
      new GeneratePostCommand(
        dto as unknown as Parameters<typeof GeneratePostCommand>[0],
        'actor-1',
      ),
    );

    expect(mockJobPort.enqueueGeneratePost).toHaveBeenCalledWith({
      actorId: 'actor-1',
      topicTitle: 'Test Topic',
      topicDescription: 'Test description for the topic',
      activeNetworks: ['linkedin'],
      language: 'es',
    });

    expect(result).toEqual({
      jobId: 'job-123',
      status: 'queued',
    });
  });
});
