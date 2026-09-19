import { describe, expect, it, jest } from '@jest/globals';
import { HandoffCancellationService } from './handoff-cancellation.service';
import type { HandoffsRepository } from './handoffs.repository';

describe('HandoffCancellationService', () => {
  it('processes each affected ticket once in deterministic order', async () => {
    const findPendingForUser = jest.fn().mockResolvedValue([
      { ticketId: 'ticket-3' },
      { ticketId: 'ticket-1' },
      { ticketId: 'ticket-3' },
      { ticketId: 'ticket-2' },
    ]);
    const lockTicket = jest.fn().mockResolvedValue(undefined);
    const cancelPendingForTicket = jest.fn().mockResolvedValue(undefined);
    const repository = {
      findPendingForUser,
      lockTicket,
      cancelPendingForTicket,
    } as unknown as HandoffsRepository;
    const service = new HandoffCancellationService(repository);
    const client = {} as never;

    await service.cancelPendingForUser('user-1', 'actor-1', client);

    expect(findPendingForUser).toHaveBeenCalledWith('user-1', client);
    expect(lockTicket.mock.invocationCallOrder).toEqual(
      expect.arrayContaining([
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      ]),
    );
    expect(cancelPendingForTicket.mock.calls).toEqual([
      ['ticket-1', 'actor-1', 'USER_ELIGIBILITY_CHANGED', client],
      ['ticket-2', 'actor-1', 'USER_ELIGIBILITY_CHANGED', client],
      ['ticket-3', 'actor-1', 'USER_ELIGIBILITY_CHANGED', client],
    ]);
    expect(lockTicket.mock.calls).toEqual([
      ['ticket-1', client],
      ['ticket-2', client],
      ['ticket-3', client],
    ]);
  });
});
