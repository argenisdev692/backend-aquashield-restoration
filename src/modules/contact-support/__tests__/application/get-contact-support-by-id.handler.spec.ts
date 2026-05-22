import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { GetContactSupportByIdHandler } from '../../application/queries/handlers/get-contact-support-by-id.handler';
import { GetContactSupportByIdQuery } from '../../application/queries/get-contact-support-by-id.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { LoggerService } from '../../../../logger/logger.service';

const ID = '11111111-1111-1111-1111-111111111111';

const activeRow = {
  id: ID,
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.c',
  phone: '+351912345678',
  subject: 'Hi',
  message: 'Test',
  smsConsent: false,
  readed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const suspendedRow = {
  ...activeRow,
  deletedAt: '2026-05-01T10:00:00.000Z',
};

describe('GetContactSupportByIdHandler — withTrashed', () => {
  let handler: GetContactSupportByIdHandler;
  let repo: { findReadModelById: jest.Mock };

  beforeEach(async () => {
    repo = { findReadModelById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetContactSupportByIdHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
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

    handler = module.get(GetContactSupportByIdHandler);
  });

  it('forwards withTrashed=false by default', async () => {
    repo.findReadModelById.mockResolvedValueOnce(activeRow);
    await handler.execute(new GetContactSupportByIdQuery(ID));
    expect(repo.findReadModelById).toHaveBeenCalledWith(ID, false);
  });

  it('forwards withTrashed=true so suspended rows are visible', async () => {
    repo.findReadModelById.mockResolvedValueOnce(suspendedRow);
    const result = await handler.execute(
      new GetContactSupportByIdQuery(ID, true),
    );
    expect(repo.findReadModelById).toHaveBeenCalledWith(ID, true);
    expect(result.deletedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('throws NotFoundException when the row is missing', async () => {
    repo.findReadModelById.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new GetContactSupportByIdQuery(ID, true)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
