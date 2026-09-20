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
  closeTicketViaApi,
  createTicketViaApi,
  expectStatus,
  fillTicketForm,
} from '../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('employees reopen closed tickets with an updated description', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Door access',
    description: 'Cannot enter the office.',
    priority: 'MODERATE',
    departmentId: IT_DEPARTMENT_ID,
  });
  await claimTicketViaApi(request, AGENT_ID, ticket.ticketId);
  await closeTicketViaApi(
    request,
    AGENT_ID,
    ticket.ticketId,
    'Access card reset.',
  );

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await page.getByRole('button', { name: 'Reopen ticket' }).click();
  const reopenDialog = page.getByRole('alertdialog', { name: 'Reopen ticket' });
  await page
    .getByLabel('Updated description')
    .fill('The card works during the day but still fails after hours.');
  await reopenDialog
    .getByRole('button', { name: 'Reopen Ticket', exact: true })
    .click();

  await expect(page.getByText('Ticket reopened.')).toBeVisible();
  await expectStatus(page, 'Reopened');
  await expect(
    page.getByText(
      'The card works during the day but still fails after hours.',
    ),
  ).toBeVisible();

  const stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.status).toBe(TicketStatus.REOPENED);
  expect(stored.agentId).toBeNull();
  expect(stored.closedAt).toBeNull();
});

test('employees edit a modifiable ticket and the saved values persist', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Old monitor request',
    description: 'The display flickers.',
    priority: 'LOW',
    departmentId: IT_DEPARTMENT_ID,
  });

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  await fillTicketForm(page, {
    title: 'Updated monitor request',
    description: 'The display flickers and has color banding.',
    priority: 'HIGH',
    department: 'Information Technology',
  });
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Ticket updated.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Updated monitor request' }),
  ).toBeVisible();
  await expect(page.getByText('High')).toBeVisible();

  const stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.title).toBe('Updated monitor request');
  expect(stored.description).toBe(
    'The display flickers and has color banding.',
  );
  expect(stored.priority).toBe('HIGH');
});

test('employees can dismiss and then confirm ticket cancellation', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Cancel this request',
    description: 'This request is no longer needed.',
    priority: 'LOW',
    departmentId: IT_DEPARTMENT_ID,
  });

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await page.getByRole('button', { name: 'Cancel ticket' }).click();
  await page.getByRole('button', { name: 'Keep Ticket' }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel ticket' }),
  ).toBeVisible();

  let stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.active).toBe(true);

  await page.getByRole('button', { name: 'Cancel ticket' }).click();
  await page
    .getByRole('alertdialog', { name: 'Cancel ticket?' })
    .getByRole('button', { name: 'Cancel Ticket' })
    .click();

  await expect(page.getByText('This ticket has been cancelled.')).toBeVisible();
  await expect(
    page.getByText('This ticket can no longer be edited or cancelled.'),
  ).toBeVisible();

  stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.active).toBe(false);
});
