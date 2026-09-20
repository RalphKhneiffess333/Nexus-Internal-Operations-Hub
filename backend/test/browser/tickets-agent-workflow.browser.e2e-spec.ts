import { expect, test } from '@playwright/test';
import { TicketStatus } from '@prisma/client';
import { signIn } from '../support/browser-auth';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
  IT_DEPARTMENT_ID,
  prisma,
} from '../support/test-db';
import {
  claimTicketViaApi,
  createTicketViaApi,
  expectStatus,
} from '../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('agents claim an open ticket from the pool and the database reflects ownership', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'VPN access needed',
    description: 'Cannot connect from home.',
    priority: 'HIGH',
    departmentId: IT_DEPARTMENT_ID,
  });

  await signIn(page, request, AGENT_ID);
  await page.goto('/tickets/pool');
  await page.getByRole('link', { name: /VPN access needed/ }).click();
  await page.getByRole('button', { name: 'Claim ticket' }).click();
  await page
    .getByRole('alertdialog', { name: 'Claim ticket?' })
    .getByRole('button', { name: 'Claim Ticket', exact: true })
    .click();

  await expect(page.getByText('Ticket claimed.')).toBeVisible();
  await expectStatus(page, 'Claimed');

  const stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.status).toBe(TicketStatus.CLAIMED);
  expect(stored.agentId).toBe(AGENT_ID);
});

test('agents close claimed tickets with completion notes', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Printer jam',
    description: 'Printer keeps jamming on floor two.',
    priority: 'LOW',
    departmentId: IT_DEPARTMENT_ID,
  });
  await claimTicketViaApi(request, AGENT_ID, ticket.ticketId);

  await signIn(page, request, AGENT_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await page.getByRole('button', { name: 'Close ticket' }).click();
  const closeDialog = page.getByRole('alertdialog', { name: 'Close ticket' });
  await closeDialog
    .getByRole('button', { name: 'Close Ticket', exact: true })
    .click();
  await expect(
    page.getByText('Please add a message before continuing.'),
  ).toBeVisible();
  await page
    .getByLabel('Closing message')
    .fill('Cleared the jam and tested printing.');
  await closeDialog
    .getByRole('button', { name: 'Close Ticket', exact: true })
    .click();

  await expect(page.getByText('Ticket closed.')).toBeVisible();
  await expectStatus(page, 'Closed');
  await expect(
    page.getByText('Cleared the jam and tested printing.'),
  ).toBeVisible();

  const stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.status).toBe(TicketStatus.CLOSED);
  expect(stored.agentId).toBeNull();
  expect(stored.completionNotes).toBe('Cleared the jam and tested printing.');
  expect(stored.closedAt).not.toBeNull();
});
