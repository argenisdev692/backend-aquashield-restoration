import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

// Pass-through policy: no real retry/backoff so the failure test stays fast.
jest.mock('../../resilience', () => ({
  createExternalServicePolicy: () => ({
    execute: (fn: () => unknown) => fn(),
  }),
}));

import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { MAILER_TRANSPORT, type IMailer } from '../mailer.port';
import { EmailProcessor } from '../email.processor';
import type { EmailJob } from '../email-job.types';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mockTransport: { send: jest.Mock };
  let mockCls: { run: jest.Mock; set: jest.Mock; get: jest.Mock };

  const jobData: EmailJob = {
    to: ['user@aquashield.com'],
    subject: 'Hi',
    html: '<p>Hi</p>',
    traceId: 'trace-123',
  };

  beforeEach(async () => {
    mockTransport = {
      send: jest.fn().mockResolvedValue({ delivered: true, skipped: false }),
    };
    mockCls = {
      run: jest.fn((fn: () => Promise<void>) => fn()),
      set: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: MAILER_TRANSPORT, useValue: mockTransport as IMailer },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    processor = module.get(EmailProcessor);
  });

  it('delivers the job through the transport', async () => {
    const job = { id: 'job-1', attemptsMade: 0, data: jobData } as Job<EmailJob>;

    await processor.process(job);

    expect(mockTransport.send).toHaveBeenCalledWith(jobData);
  });

  it('re-seeds the request traceId into CLS for the delivery', async () => {
    const job = { id: 'job-1', attemptsMade: 0, data: jobData } as Job<EmailJob>;

    await processor.process(job);

    expect(mockCls.run).toHaveBeenCalled();
    expect(mockCls.set).toHaveBeenCalledWith('traceId', 'trace-123');
  });

  it('re-throws on delivery failure so BullMQ retries', async () => {
    mockTransport.send.mockRejectedValue(new Error('Resend 5xx'));
    const job = { id: 'job-2', attemptsMade: 1, data: jobData } as Job<EmailJob>;

    await expect(processor.process(job)).rejects.toThrow('Resend 5xx');
  });
});
