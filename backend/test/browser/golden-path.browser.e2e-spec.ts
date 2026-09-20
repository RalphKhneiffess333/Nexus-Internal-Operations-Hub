import { expect, test } from '@playwright/test';
import { TicketStatus } from '@prisma/client';
import { signIn } from '../support/browser-auth';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
  prisma,
} from '../support/test-db';
import { expectStatus, fillTicketForm } from '../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('golden path: employee submits, agent claims and closes, employee sees closure', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets/new');
  await fillTicketForm(page, {
    title: 'Golden path ticket',
    description: 'Track this request across employee and agent workflows.',
    priority: 'MODERATE',
    department: 'Information Technology',
  });
  const submitResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/tickets') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Submit ticket' }).click();
  const submitResponse = await submitResponsePromise;
  expect(submitResponse.ok()).toBeTruthy();
  const ticket = (await submitResponse.json()) as {
    ticketId: string;
    ticketCode: string;
  };
  await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.ticketId}$`));
  await expect(
    page.getByRole('heading', { name: 'Golden path ticket' }),
  ).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, request, AGENT_ID);
  await page.goto('/tickets/pool');
  await page.getByRole('link', { name: /Golden path ticket/ }).click();
  await page.getByRole('button', { name: 'Claim ticket' }).click();
  await page
    .getByRole('alertdialog', { name: 'Claim ticket?' })
    .getByRole('button', { name: 'Claim Ticket', exact: true })
    .click();
  await expectStatus(page, 'Claimed');

  await page.getByRole('button', { name: 'Close ticket' }).click();
  await page.getByLabel('Closing message').fill('Resolved during the E2E run.');
  await page
    .getByRole('alertdialog', { name: 'Close ticket' })
    .getByRole('button', { name: 'Close Ticket', exact: true })
    .click();
  await expectStatus(page, 'Closed');

  await page.context().clearCookies();
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/tickets/${ticket.ticketId}`);
  await expectStatus(page, 'Closed');
  await expect(page.getByText('Resolved during the E2E run.')).toBeVisible();

  const stored = await prisma.ticket.findUniqueOrThrow({
    where: { ticketId: ticket.ticketId },
  });
  expect(stored.status).toBe(TicketStatus.CLOSED);
  expect(stored.submittedBy).toBe(EMPLOYEE_ID);
  expect(stored.agentId).toBeNull();
});
