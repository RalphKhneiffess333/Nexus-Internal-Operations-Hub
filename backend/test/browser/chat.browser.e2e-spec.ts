import { expect, test } from '@playwright/test';
import { TicketPriority } from '@prisma/client';
import { signIn } from '../support/browser-auth';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
  IT_DEPARTMENT_ID,
} from '../support/test-db';
import {
  claimTicketViaApi,
  closeTicketViaApi,
  createTicketViaApi,
  expectStatus,
} from '../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('participants send a ticket chat message and closed tickets become read-only', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Chat panel workflow',
    description: 'Verify the ticket conversation.',
    priority: TicketPriority.LOW,
    departmentId: IT_DEPARTMENT_ID,
  });
  await claimTicketViaApi(request, AGENT_ID, ticket.ticketId);

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await expect(page.getByRole('heading', { name: 'Ticket chat' })).toBeVisible();
  await page.getByLabel('New message').fill('Here is the information you requested.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Here is the information you requested.')).toBeVisible();
  await closeTicketViaApi(request, AGENT_ID, ticket.ticketId, 'Work completed.');
  await page.reload();
  await expect(page.getByText('This chat is read-only until the ticket is claimed by an agent.')).toBeVisible();
  await expect(page.getByLabel('New message')).toHaveCount(0);
});

test('a claim immediately makes the visible employee chat writable', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Claim chat synchronization',
    description: 'The chat should become available without a refresh.',
    priority: TicketPriority.MODERATE,
    departmentId: IT_DEPARTMENT_ID,
  });

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await expect(
    page.getByText('This chat is read-only while the ticket is unclaimed.'),
  ).toBeVisible();

  await claimTicketViaApi(request, AGENT_ID, ticket.ticketId);

  await expectStatus(page, 'Claimed');
  await expect(page.getByLabel('New message')).toBeVisible();
});
