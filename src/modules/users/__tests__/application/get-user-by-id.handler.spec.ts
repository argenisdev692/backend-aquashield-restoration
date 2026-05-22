import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { GetUserByIdHandler } from '../../application/queries/handlers/get-user-by-id.handler';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';

const userId = '11111111-1111-1111-1111-111111111111';
const suspendedAt = new Date('2026-05-01T10:00:00.000Z');

const suspendedUser = User.reconstitute({
  id: UserId.reconstitute(userId),
  email: Email.create('suspended@example.com'),
  name: 'Suspended',
  lastName: null,
  phone: null,
  password: null,
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: suspendedAt,
});

describe('GetUserByIdHandler — withTrashed semantics', () => {
  let handler: GetUserByIdHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findAccessByUserId: jest
        .fn()
        .mockResolvedValue({ roles: [], permissions: [] }),
      findAccessByUserIds: jest.fn().mockResolvedValue(new Map()),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      replacePermissions: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setContext: jest.fn() } as unknown as jest.Mocked<LoggerService>;
    mockCls = { get: jest.fn().mockReturnValue('trace-1') } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserByIdHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(GetUserByIdHandler);
  });

  it('forwards withTrashed=false by default (Laravel: find() ignores trashed)', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);
    await handler.execute(new GetUserByIdQuery(userId));
    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId, false);
  });

  it('forwards withTrashed=true so suspended users are visible', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(suspendedUser);
    const result = await handler.execute(new GetUserByIdQuery(userId, true));
    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId, true);
    expect(result?.deletedAt).toEqual(suspendedAt);
  });

  it('returns null when the user does not exist', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);
    const result = await handler.execute(new GetUserByIdQuery(userId, true));
    expect(result).toBeNull();
  });

  it('merges roles + effective permissions from findAccessByUserId', async () => {
    const roleId = '22222222-2222-2222-2222-222222222222';
    mockUserRepo.findById.mockResolvedValueOnce(suspendedUser);
    mockUserRepo.findAccessByUserId.mockResolvedValueOnce({
      roles: [{ id: roleId, name: 'admin' }],
      permissions: [
        { action: 'read', subject: 'USER' },
        { action: 'update', subject: 'USER' },
      ],
    });

    const result = await handler.execute(new GetUserByIdQuery(userId, true));

    expect(mockUserRepo.findAccessByUserId).toHaveBeenCalledWith(userId);
    expect(result?.roles).toEqual([{ id: roleId, name: 'admin' }]);
    expect(result?.permissions).toEqual([
      { action: 'read', subject: 'USER' },
      { action: 'update', subject: 'USER' },
    ]);
  });

  it('emits empty arrays when the user has no roles or permissions', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(suspendedUser);
    // default mock already returns { roles: [], permissions: [] }
    const result = await handler.execute(new GetUserByIdQuery(userId, true));
    expect(result?.roles).toEqual([]);
    expect(result?.permissions).toEqual([]);
  });
});
