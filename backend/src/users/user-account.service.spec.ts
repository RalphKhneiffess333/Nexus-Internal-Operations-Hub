import { User } from '@prisma/client';
import { jest, describe, expect, it } from '@jest/globals';
import { UsersRepository } from './repositories/users.repository';
import { UserAccountService } from './user-account.service';
import { SafeUserResponse, UserResponseMapper } from './user-response.mapper';

describe('UserAccountService', () => {
  it('does not write when the identity is already linked and logged in', async () => {
    const user = {
      userId: 'user-1',
      identityProviderId: 'provider-1',
      identityProviderUserId: 'subject-1',
      hasLogged: true,
    } as User;
    const update = jest.fn();
    const repository = { update } as unknown as UsersRepository;
    const mapper = {} as UserResponseMapper;
    const service = new UserAccountService(repository, mapper);

    await expect(
      service.linkIdentity(user, 'provider-1', 'subject-1'),
    ).resolves.toBe(user);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects login-state updates for an unlinked account', async () => {
    const user = { userId: 'user-1', hasLogged: false } as User;
    const repository = {} as UsersRepository;
    const mapper = {} as UserResponseMapper;
    const service = new UserAccountService(repository, mapper);

    await expect(service.markAsLoggedIn(user)).rejects.toThrow(
      'User account is not linked to an authenticated identity',
    );
  });

  it('maps profile reads through the safe response mapper', async () => {
    const record = { userId: 'user-1' } as Awaited<
      ReturnType<UsersRepository['findAdminById']>
    >;
    const response = { userId: 'user-1' } as SafeUserResponse;
    const findAdminById = jest
      .fn<UsersRepository['findAdminById']>()
      .mockResolvedValue(record);
    const toSafeResponse = jest.fn().mockReturnValue(response);
    const repository = { findAdminById } as unknown as UsersRepository;
    const mapper = { toSafeResponse } as unknown as UserResponseMapper;
    const service = new UserAccountService(repository, mapper);

    await expect(service.findForProfile('user-1')).resolves.toBe(response);
    expect(toSafeResponse).toHaveBeenCalledWith(record);
  });
});
