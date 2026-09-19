import { Prisma, User, UserRole } from '@prisma/client';
import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersRepository } from './repositories/users.repository';
import { UserAdministrationService } from './user-administration.service';
import { UserMembershipService } from './user-membership.service';
import { UserInternalEvent } from './user-events';
import { SafeUserResponse, UserResponseMapper } from './user-response.mapper';

describe('UserAdministrationService', () => {
  let service: UserAdministrationService;
  let repository: {
    transaction: jest.Mock;
    findByIdForUpdate: jest.Mock;
    updateWithClient: jest.Mock;
    findAdminById: jest.Mock;
  };
  let membership: {
    reconcileUserEligibility: jest.Mock;
    ensureAdministrationMembership: jest.Mock;
    publish: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let mapper: { toSafeResponse: jest.Mock };
  let notifications: { notify: jest.Mock };

  beforeEach(() => {
    const tx = {} as Prisma.TransactionClient;
    repository = {
      transaction: jest.fn(),
      findByIdForUpdate: jest.fn(),
      updateWithClient: jest.fn(),
      findAdminById: jest.fn(),
    };
    repository.transaction.mockImplementation(async (operation) =>
      (operation as (client: Prisma.TransactionClient) => Promise<unknown>)(tx),
    );
    membership = {
      reconcileUserEligibility: jest.fn().mockResolvedValue([] as never),
      ensureAdministrationMembership: jest
        .fn()
        .mockResolvedValue(undefined as never),
      publish: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };
    mapper = { toSafeResponse: jest.fn() };
    notifications = { notify: jest.fn() };
    service = new UserAdministrationService(
      repository as unknown as UsersRepository,
      {
        append: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as AuditService,
      membership as unknown as UserMembershipService,
      mapper as unknown as UserResponseMapper,
      eventEmitter as never,
      notifications as unknown as NotificationsService,
    );
  });

  it('publishes deactivation only after the transaction succeeds', async () => {
    const user = {
      userId: 'user-1',
      role: UserRole.Agent,
      isActive: true,
    } as User;
    const updated = { ...user, isActive: false };
    const response = { userId: 'user-1' } as SafeUserResponse;
    repository.findByIdForUpdate.mockResolvedValue(user as never);
    repository.updateWithClient.mockResolvedValue(updated as never);
    repository.findAdminById.mockResolvedValue({ userId: 'user-1' } as never);
    mapper.toSafeResponse.mockReturnValue(response);
    const actor = { userId: 'admin-1' } as AuthenticatedRequestUser;

    await expect(
      service.setActive('user-1', { active: false }, actor),
    ).resolves.toBe(response);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      UserInternalEvent.Deactivated,
      { userId: 'user-1' },
    );
    expect(membership.reconcileUserEligibility).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
      expect.anything(),
    );
    expect(notifications.notify).toHaveBeenCalled();
  });

  it('does not publish deactivation when the transaction fails', async () => {
    repository.transaction.mockRejectedValue(new Error('rollback') as never);

    await expect(
      service.setActive('user-1', { active: false }, {
        userId: 'admin-1',
      } as AuthenticatedRequestUser),
    ).rejects.toThrow('rollback');

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(membership.publish).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
