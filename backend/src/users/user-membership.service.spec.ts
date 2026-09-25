import { Prisma } from '@prisma/client';
import { jest, describe, expect, it } from '@jest/globals';
import { TicketAssignmentReconciliationService } from '../tickets/ticket-assignment-reconciliation.service';
import { UsersRepository } from './repositories/users.repository';
import { UserMembershipService } from './user-membership.service';

describe('UserMembershipService', () => {
  it('delegates eligibility reconciliation through the Tickets boundary', async () => {
    const tx = {} as Prisma.TransactionClient;
    const memberships = [
      { departmentId: 'department-1' },
      { departmentId: 'department-2' },
    ];
    const findMemberships = jest.fn() as jest.MockedFunction<
      UsersRepository['findMemberships']
    >;
    findMemberships.mockResolvedValue(memberships as never);
    const deleteMemberships = jest.fn() as jest.MockedFunction<
      UsersRepository['deleteMemberships']
    >;
    deleteMemberships.mockResolvedValue(undefined);
    const cancelPendingForUser = jest.fn() as jest.MockedFunction<
      TicketAssignmentReconciliationService['cancelPendingForUser']
    >;
    cancelPendingForUser.mockResolvedValue(undefined);
    const cancelPendingForUserInDepartment = jest.fn() as jest.MockedFunction<
      TicketAssignmentReconciliationService['cancelPendingForUserInDepartment']
    >;
    cancelPendingForUserInDepartment.mockResolvedValue(undefined);
    const reconcileDepartmentClaims = jest.fn() as jest.MockedFunction<
      TicketAssignmentReconciliationService['reconcileDepartmentClaims']
    >;
    reconcileDepartmentClaims.mockResolvedValue([
      { ticket: { ticketId: 'ticket-1' }, ticketEventId: 'event-1' } as never,
    ]);
    const repository = {
      findMemberships,
      deleteMemberships,
    } as unknown as UsersRepository;
    const reconciliation = {
      cancelPendingForUser,
      cancelPendingForUserInDepartment,
      reconcileDepartmentClaims,
    } as unknown as TicketAssignmentReconciliationService;
    const service = new UserMembershipService(
      repository,
      {} as never,
      reconciliation,
    );

    await service.reconcileUserEligibility('user-1', 'admin-1', tx);

    expect(cancelPendingForUser).toHaveBeenCalledWith('user-1', 'admin-1', tx);
    expect(cancelPendingForUserInDepartment).toHaveBeenCalledTimes(2);
    expect(reconcileDepartmentClaims).toHaveBeenCalledTimes(2);
    expect(deleteMemberships).toHaveBeenCalledWith('user-1', tx);
  });

  it('publishes reconciled ticket mutations through the Tickets boundary', () => {
    const publish = jest.fn();
    const reconciliation = {
      publish,
    } as unknown as TicketAssignmentReconciliationService;
    const service = new UserMembershipService(
      {} as UsersRepository,
      {} as never,
      reconciliation,
    );
    const mutations = [{ ticketEventId: 'event-1' }] as never;

    service.publish(mutations, 'admin-1');

    expect(publish).toHaveBeenCalledWith(mutations, 'admin-1');
  });

  it('cancels eligible tickets before removing a deactivated user from departments', async () => {
    const tx = {} as Prisma.TransactionClient;
    const cancelled = [{ ticketEventId: 'cancel-event' }] as never;
    const reconciled = [{ ticketEventId: 'close-event' }] as never;
    const cancelTicketsForDeactivatedUser = jest
      .fn()
      .mockResolvedValue(cancelled);
    const cancelPendingForUser = jest.fn().mockResolvedValue(undefined);
    const reconciliation = {
      cancelTicketsForDeactivatedUser,
      cancelPendingForUser,
    } as unknown as TicketAssignmentReconciliationService;
    const service = new UserMembershipService(
      {
        findMemberships: jest.fn().mockResolvedValue([]),
      } as unknown as UsersRepository,
      {} as never,
      reconciliation,
    );
    jest
      .spyOn(service, 'reconcileUserEligibility')
      .mockResolvedValue(reconciled);

    await expect(
      service.reconcileUserDeactivation('user-1', 'admin-1', tx),
    ).resolves.toEqual([...cancelled, ...reconciled]);

    expect(cancelTicketsForDeactivatedUser).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
      tx,
    );
  });
});
