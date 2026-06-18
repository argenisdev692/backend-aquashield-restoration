import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { GetContactSupportByIdUseCase } from '../../application/use-cases/get-contact-support-by-id.use-case';
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
  isRead: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const suspendedRow = {
  ...activeRow,
  deletedAt: '2026-05-01T10:00:00.000Z',
};

describe('GetContactSupportByIdUseCase — withTrashed', () => {
  let useCase: GetContactSupportByIdUseCase;
  let repo: { findReadModelById: jest.Mock };

  beforeEach(async () => {
    repo = { findReadModelById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetContactSupportByIdUseCase,
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

    useCase = module.get(GetContactSupportByIdUseCase);
  });

  it('forwards withTrashed=false', async () => {
    repo.findReadModelById.mockResolvedValueOnce(activeRow);
    await useCase.execute(ID, false);
    expect(repo.findReadModelById).toHaveBeenCalledWith(ID, false);
  });

  it('forwards withTrashed=true so suspended rows are visible', async () => {
    repo.findReadModelById.mockResolvedValueOnce(suspendedRow);
    const result = await useCase.execute(ID, true);
    expect(repo.findReadModelById).toHaveBeenCalledWith(ID, true);
    expect(result.deletedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('throws NotFoundException when the row is missing', async () => {
    repo.findReadModelById.mockResolvedValueOnce(null);
    await expect(useCase.execute(ID, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
