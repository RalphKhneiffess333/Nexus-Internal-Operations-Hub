import { expect, test } from '@playwright/test';
import { signIn } from '../../support/browser-auth';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
} from '../../support/test-db';
import { expectStatus, fillTicketForm } from '../../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('smoke: employee and agent complete a ticket with live updates', async ({
  browser,
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets/new');
  await fillTicketForm(page, {
    title: 'Smoke realtime ticket',
    description: 'Exercise the employee and agent release path.',
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
  const ticket = (await submitResponse.json()) as { ticketId: string };

  await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.ticketId}$`));
  await expectStatus(page, 'Open');
  await expect(
    page.getByRole('heading', { name: 'Smoke realtime ticket' }),
  ).toBeVisible();

  const agentContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
  });
  try {
    const agentPage = await agentContext.newPage();
    await signIn(agentPage, request, AGENT_ID);
    await agentPage.goto('/tickets/pool');
    await agentPage.getByRole('link', { name: /Smoke realtime ticket/ }).click();

    await agentPage.getByRole('button', { name: 'Claim ticket' }).click();
    await agentPage
      .getByRole('alertdialog', { name: 'Claim ticket?' })
      .getByRole('button', { name: 'Claim Ticket', exact: true })
      .click();

    await expectStatus(agentPage, 'Claimed');
    await expectStatus(page, 'Claimed');

    await agentPage.getByRole('button', { name: 'Close ticket' }).click();
    const closeDialog = agentPage.getByRole('alertdialog', {
      name: 'Close ticket',
    });
    await closeDialog.getByLabel('Closing message').fill('Smoke closure.');
    await closeDialog
      .getByRole('button', { name: 'Close Ticket', exact: true })
      .click();

    await expectStatus(agentPage, 'Closed');
    await expectStatus(page, 'Closed');
    await expect(page.getByText('Smoke closure.')).toBeVisible();
  } finally {
    await agentContext.close();
  }
});
