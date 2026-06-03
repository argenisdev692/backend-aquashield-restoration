import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { GetUsersListHandler } from '../../application/queries/handlers/get-users-list.handler';
import { GetUsersListQuery } from '../../application/queries/get-users-list.query';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';

const activeUser = User.reconstitute({
  id: UserId.reconstitute('11111111-1111-1111-1111-111111111111'),
  email: Email.create('active@example.com'),
  name: 'Active',
  lastName: null,
  phone: null,
  username: null,
  dateOfBirth: null,
  address: null,
  address2: null,
  zipCode: null,
  city: null,
  state: null,
  country: null,
  gender: null,
  profilePhotoPath: null,
  totpEnabled: false,
  mustChangePassword: false,
  password: null,
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const suspendedUser = User.reconstitute({
  id: UserId.reconstitute('22222222-2222-2222-2222-222222222222'),
  email: Email.create('suspended@example.com'),
  name: 'Suspended',
  lastName: null,
  phone: null,
  username: null,
  dateOfBirth: null,
  address: null,
  address2: null,
  zipCode: null,
  city: null,
  state: null,
  country: null,
  gender: null,
  profilePhotoPath: null,
  totpEnabled: false,
  mustChangePassword: false,
  password: null,
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: new Date('2026-05-01T10:00:00.000Z'),
});

describe('GetUsersListHandler — trashed semantics', () => {
  let handler: GetUsersListHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ users: [activeUser], total: 1 }),
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
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUsersListHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(GetUsersListHandler);
  });

  it('passes trashed=exclude when no flags are set (default)', async () => {
    await handler.execute(
      new GetUsersListQuery({ page: 1, limit: 20, search: undefined }),
    );
    expect(mockUserRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'exclude' }),
    );
  });

  it('passes trashed=include when withTrashed=true', async () => {
    mockUserRepo.findAll.mockResolvedValueOnce({
      users: [activeUser, suspendedUser],
      total: 2,
    });
    const result = await handler.execute(
      new GetUsersListQuery({
        page: 1,
        limit: 20,
        search: undefined,
        withTrashed: true,
      }),
    );
    expect(mockUserRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'include' }),
    );
    expect(result.data).toHaveLength(2);
    expect(result.data[1].deletedAt).toEqual(suspendedUser.deletedAt);
  });

  it('passes trashed=only when onlyTrashed=true', async () => {
    mockUserRepo.findAll.mockResolvedValueOnce({
      users: [suspendedUser],
      total: 1,
    });
    const result = await handler.execute(
      new GetUsersListQuery({
        page: 1,
        limit: 20,
        search: undefined,
        onlyTrashed: true,
      }),
    );
    expect(mockUserRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'only' }),
    );
    expect(result.data[0].deletedAt).not.toBeNull();
  });

  it('exposes deletedAt in every read model — null for active rows', async () => {
    const result = await handler.execute(
      new GetUsersListQuery({ page: 1, limit: 20, search: undefined }),
    );
    expect(result.data[0]).toHaveProperty('deletedAt', null);
  });

  it('merges roles + permissions from the batched access fetch', async () => {
    mockUserRepo.findAll.mockResolvedValueOnce({
      users: [activeUser, suspendedUser],
      total: 2,
    });
    mockUserRepo.findAccessByUserIds.mockResolvedValueOnce(
      new Map([
        [
          activeUser.id.value,
          {
            roles: [{ id: 'r1', name: 'admin', description: null }],
            permissions: [{ action: 'read', subject: 'USER' }],
          },
        ],
        // suspendedUser intentionally absent — handler must default to empty
      ]),
    );

    const result = await handler.execute(
      new GetUsersListQuery({
        page: 1,
        limit: 20,
        search: undefined,
        withTrashed: true,
      }),
    );

    expect(mockUserRepo.findAccessByUserIds).toHaveBeenCalledWith([
      activeUser.id.value,
      suspendedUser.id.value,
    ]);
    expect(result.data[0].roles).toEqual([{ id: 'r1', name: 'admin' }]);
    expect(result.data[0].permissions).toEqual([
      { action: 'read', subject: 'USER' },
    ]);
    expect(result.data[1].roles).toEqual([]);
    expect(result.data[1].permissions).toEqual([]);
  });

  it('calls findAccessByUserIds even on empty pages (returns empty map)', async () => {
    mockUserRepo.findAll.mockResolvedValueOnce({ users: [], total: 0 });
    const result = await handler.execute(
      new GetUsersListQuery({ page: 1, limit: 20, search: undefined }),
    );
    expect(mockUserRepo.findAccessByUserIds).toHaveBeenCalledWith([]);
    expect(result.data).toEqual([]);
  });
});
