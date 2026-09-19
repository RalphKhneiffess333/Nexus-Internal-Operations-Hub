import { describe, expect, it } from '@jest/globals';
import { TicketPriority, TicketStatus } from '@prisma/client';
import {
  ticketClosedTemplate,
  ticketSubmittedTemplate,
} from './email-templates';

const context = {
  ticketId: 'ticket-1',
  ticketCode: 'NEX-0001',
  title: '<script>alert("x")</script>',
  status: TicketStatus.OPEN,
  priority: TicketPriority.HIGH,
  departmentName: 'IT & Support',
  submitterName: 'Morgan',
  completionNotes: null,
  ticketLink: 'http://localhost:5173/tickets/ticket-1',
};

describe('email templates', () => {
  it('escapes entity-controlled values in HTML', () => {
    const template = ticketSubmittedTemplate(context);

    expect(template.html).not.toContain('<script>');
    expect(template.html).toContain('&lt;script&gt;');
    expect(template.text).toContain(context.title);
  });

  it('includes completion notes only when they exist', () => {
    const template = ticketClosedTemplate({
      ...context,
      status: TicketStatus.CLOSED,
      completionNotes: 'Completed <safely>',
    });

    expect(template.text).toContain('Completion notes: Completed <safely>');
    expect(template.html).toContain('Completed &lt;safely&gt;');
  });
});
