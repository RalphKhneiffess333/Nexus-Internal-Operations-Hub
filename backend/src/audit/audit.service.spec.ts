import { TicketEventAction } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { TicketEventsRepository } from '../tickets/events/ticket-events.repository';

describe('AuditService', () => {
  it('owns ticket-event pagination for the audit controller', async () => {
    const findAll = jest
      .fn<TicketEventsRepository['findAll']>()
      .mockResolvedValue([]);
    const service = new AuditService(
      {} as AuditRepository,
      { findAll } as unknown as TicketEventsRepository,
    );
    const query = {
      page: 2,
      pageSize: 10,
      action: TicketEventAction.CLOSE,
    };

    await expect(service.listTicketEvents(query)).resolves.toEqual([]);
    expect(findAll).toHaveBeenCalledWith(10, 10, TicketEventAction.CLOSE);
  });
});
