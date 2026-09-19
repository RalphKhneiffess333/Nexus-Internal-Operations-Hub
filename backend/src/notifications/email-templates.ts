import type { TicketPriority, TicketStatus } from '@prisma/client';

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface TicketEmailContext {
  ticketId: string;
  ticketCode: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  departmentName: string;
  submitterName: string;
  completionNotes?: string | null;
  ticketLink?: string;
}

export interface HandoffEmailContext {
  handoffId: string;
  ticketCode: string;
  ticketTitle: string;
  departmentName: string;
  requesterName: string;
  requestedAgentName: string;
  message?: string | null;
  ticketLink?: string;
}

export function ticketSubmittedTemplate(
  context: TicketEmailContext,
): EmailTemplate {
  return ticketTemplate(
    context,
    'New ticket submitted',
    `A new ticket was submitted in ${context.departmentName}.`,
  );
}

export function ticketClaimedTemplate(
  context: TicketEmailContext,
): EmailTemplate {
  return ticketTemplate(
    context,
    'Your ticket was claimed',
    `Your ticket ${context.ticketCode} has been claimed by an agent.`,
  );
}

export function ticketClosedTemplate(
  context: TicketEmailContext,
): EmailTemplate {
  return ticketTemplate(
    context,
    'Your ticket was closed',
    `Your ticket ${context.ticketCode} has been closed.`,
    context.completionNotes
      ? `Completion notes: ${context.completionNotes}`
      : undefined,
  );
}

export function ticketReopenedTemplate(
  context: TicketEmailContext,
): EmailTemplate {
  return ticketTemplate(
    context,
    'Ticket reopened',
    `Ticket ${context.ticketCode} was reopened and is ready for attention.`,
  );
}

export function handoffRequestedTemplate(
  context: HandoffEmailContext,
): EmailTemplate {
  const message = context.message
    ? `\nMessage from ${context.requesterName}: ${context.message}`
    : '';
  return handoffTemplate(
    context,
    'Pending ticket handoff request',
    `You have a pending handoff request for ticket ${context.ticketCode} from ${context.requesterName}.${message}`,
  );
}

export function handoffAcceptedTemplate(
  context: HandoffEmailContext,
): EmailTemplate {
  return handoffTemplate(
    context,
    'Ticket handoff accepted',
    `The handoff request for ticket ${context.ticketCode} was accepted by ${context.requestedAgentName}.`,
  );
}

export function handoffRejectedTemplate(
  context: HandoffEmailContext,
): EmailTemplate {
  return handoffTemplate(
    context,
    'Ticket handoff rejected',
    `The handoff request for ticket ${context.ticketCode} was rejected by ${context.requestedAgentName}.`,
  );
}

function ticketTemplate(
  context: TicketEmailContext,
  subject: string,
  summary: string,
  extra?: string,
): EmailTemplate {
  const details = [
    `Ticket: ${context.ticketCode}`,
    `Title: ${context.title}`,
    `Department: ${context.departmentName}`,
    `Priority: ${context.priority}`,
    `Status: ${context.status}`,
    ...(extra ? [extra] : []),
  ];
  return createTemplate(subject, summary, details, context.ticketLink);
}

function handoffTemplate(
  context: HandoffEmailContext,
  subject: string,
  summary: string,
): EmailTemplate {
  const details = [
    `Ticket: ${context.ticketCode}`,
    `Title: ${context.ticketTitle}`,
    `Department: ${context.departmentName}`,
    `Requested by: ${context.requesterName}`,
    `Requested to: ${context.requestedAgentName}`,
    ...(context.message ? [`Message: ${context.message}`] : []),
  ];
  return createTemplate(subject, summary, details, context.ticketLink);
}

function createTemplate(
  subject: string,
  summary: string,
  details: string[],
  link?: string,
): EmailTemplate {
  const text = [
    summary,
    '',
    ...details,
    ...(link ? ['', `View in Nexus: ${link}`] : []),
  ].join('\n');
  const htmlDetails = details
    .map((detail) => `<li>${escapeHtml(detail)}</li>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>${escapeHtml(summary)}</p><ul>${htmlDetails}</ul>${link ? `<p><a href="${escapeHtml(link)}">View in Nexus</a></p>` : ''}</div>`;
  return { subject: `[Nexus] ${subject}`, text, html };
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  );
}
