import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InMemoryDatabase } from '../../database/in-memory-database';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TicketsRepository {
  constructor(private readonly database: InMemoryDatabase) {}

  findById(ticketId: string): Ticket | undefined {
    return this.database.tickets.find((ticket) => ticket.ticketId === ticketId);
  }

  findAll(): Ticket[] {
    return [...this.database.tickets];
  }

  create(ticket: Omit<Ticket, 'ticketId' | 'ticketCode'>): Ticket {
    this.database.ticketSequence += 1;
    const created: Ticket = {
      ...ticket,
      ticketId: randomUUID(),
      ticketCode: `TKT-${String(this.database.ticketSequence).padStart(4, '0')}`,
    };
    this.database.tickets.push(created);
    return created;
  }

  save(ticket: Ticket): Ticket {
    const index = this.database.tickets.findIndex(
      (stored) => stored.ticketId === ticket.ticketId,
    );
    if (index >= 0) {
      this.database.tickets[index] = ticket;
    }
    return ticket;
  }
}
