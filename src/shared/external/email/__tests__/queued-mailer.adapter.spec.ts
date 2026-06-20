import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { QUEUE_NAMES } from '../../../messaging/queues.constants';
import { MAILER_TRANSPORT, type IMailer } from '../mailer.port';
import { QueuedMailerAdapter } from '../queued-mailer.adapter';

describe('QueuedMailerAdapter', () => {
  let adapter: QueuedMailerAdapter;
  let mockQueue: { add: jest.Mock };
  let mockTransport: { send: jest.Mock };
  let queueEnabled: boolean;

  const build = async (): Promise<void> => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    mockTransport = {
      send: jest.fn().mockResolvedValue({ delivered: true, skipped: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuedMailerAdapter,
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: mockQueue },
        { provide: MAILER_TRANSPORT, useValue: mockTransport as IMailer },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(queueEnabled) },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    adapter = module.get(QueuedMailerAdapter);
  };

  describe('queue enabled', () => {
    beforeEach(async () => {
      queueEnabled = true;
      await build();
    });

    it('enqueues the email and returns an accepted-for-delivery result', async () => {
      const result = await adapter.send({
        to: 'user@aquashield.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'email.send',
        expect.objectContaining({
          to: ['user@aquashield.com'],
          subject: 'Hi',
          html: '<p>Hi</p>',
        }),
        expect.objectContaining({ attempts: 5 }),
      );
      expect(mockTransport.send).not.toHaveBeenCalled();
      expect(result).toEqual({ delivered: true, skipped: false });
    });

    it('skips (no enqueue) when every recipient is filtered', async () => {
      const result = await adapter.send({
        to: 'fixture@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      });

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockTransport.send).not.toHaveBeenCalled();
      expect(result).toEqual({ delivered: false, skipped: true });
    });

    it('falls back to direct transport send when enqueue throws (Redis down)', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await adapter.send({
        to: 'user@aquashield.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      });

      expect(mockTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Hi' }),
      );
      expect(result).toEqual({ delivered: true, skipped: false });
    });
  });

  describe('queue disabled', () => {
    beforeEach(async () => {
      queueEnabled = false;
      await build();
    });

    it('delivers synchronously through the transport', async () => {
      const result = await adapter.send({
        to: 'user@aquashield.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      });

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockTransport.send).toHaveBeenCalled();
      expect(result).toEqual({ delivered: true, skipped: false });
    });
  });
});
