import { User, UserRole } from '@prisma/client';
import { jest, describe, expect, it } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { UserAccountService } from './user-account.service';
import { UserAdministrationService } from './user-administration.service';
import { UsersService } from './users.service';

describe('UsersService façade', () => {
  it('delegates account and administration operations without changing arguments', async () => {
    const user = { userId: 'user-1' } as User;
    const actor = { userId: 'admin-1' } as AuthenticatedRequestUser;
    const findById = jest
      .fn<(userId: string) => Promise<User | null>>()
      .mockResolvedValue(user);
    const setActive = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ userId: 'user-1' });
    const account = {
      findById,
      findByEmail: jest.fn(),
      findByIdentity: jest.fn(),
      create: jest.fn(),
      linkIdentity: jest.fn(),
      markAsLoggedIn: jest.fn(),
      findIdentityProviderByCode: jest.fn(),
      findForProfile: jest.fn(),
    } as unknown as UserAccountService;
    const administration = {
      listForAdministration: jest.fn(),
      findForAdministration: jest.fn(),
      preProvision: jest.fn(),
      mapRole: jest.fn(),
      setActive,
      addDepartmentMembership: jest.fn(),
      removeDepartmentMembership: jest.fn(),
    } as unknown as UserAdministrationService;
    const service = new UsersService(account, administration);

    await expect(service.findById('user-1')).resolves.toBe(user);
    await expect(
      service.setActive('user-1', { active: false }, actor),
    ).resolves.toEqual({ userId: 'user-1' });

    expect(findById).toHaveBeenCalledWith('user-1');
    expect(setActive).toHaveBeenCalledWith('user-1', { active: false }, actor);
  });

  it('keeps the role DTO and actor flow intact for role changes', async () => {
    const actor = { userId: 'admin-1' } as AuthenticatedRequestUser;
    const dto = { role: UserRole.Agent };
    const mapRole = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ userId: 'user-1' });
    const administration = {
      mapRole,
    } as unknown as UserAdministrationService;
    const account = {} as UserAccountService;
    const service = new UsersService(account, administration);

    await service.mapRole('user-1', dto, actor);

    expect(mapRole).toHaveBeenCalledWith('user-1', dto, actor);
  });
});
