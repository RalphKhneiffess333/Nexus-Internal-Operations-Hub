import { expect, test } from '@playwright/test';
import { createSessionCookie, signIn } from '../../support/browser-auth';
import {
  ADMIN_ID,
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
  IT_DEPARTMENT_ID,
} from '../../support/test-db';
import {
  claimTicketViaApi,
  createTicketViaApi,
} from '../../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('smoke: participants can chat and closed tickets become read-only', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Smoke chat ticket',
    description: 'Exercise the participant chat path.',
    priority: 'LOW',
    departmentId: IT_DEPARTMENT_ID,
  });
  await claimTicketViaApi(request, AGENT_ID, ticket.ticketId);

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto(`/chats/${ticket.ticketId}`);
  await expect(
    page.getByRole('heading', { name: 'Smoke chat ticket' }),
  ).toBeVisible();
  await page.getByLabel('New message').fill('Smoke chat message.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Smoke chat message.')).toBeVisible();

  const closeCookie = await createSessionCookie(request, AGENT_ID);
  const closeResponse = await request.post(
    `http://localhost:3000/api/tickets/${ticket.ticketId}/close`,
    {
      headers: { Cookie: closeCookie },
      data: { completionNotes: 'Smoke chat closure.' },
    },
  );
  expect(closeResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(
    page.getByText(
      'This chat is read-only because the ticket is not currently claimed.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('New message')).toHaveCount(0);
});

test('smoke: administrators can open management and logs', async ({
  page,
  request,
}) => {
  await signIn(page, request, ADMIN_ID);
  await page.goto('/admin/management');

  await expect(
    page.getByRole('heading', { name: 'Management' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Departments' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Priorities' })).toBeVisible();

  await page.getByRole('tab', { name: 'Priorities' }).click();
  await expect(page.getByText('Low', { exact: true })).toBeVisible();

  await page.goto('/admin/logs');
  await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'All system events' }),
  ).toBeVisible();
});

test('smoke: assistant responds when explicitly enabled', async ({
  page,
  request,
}) => {
  test.skip(
    process.env.SMOKE_AI !== 'true',
    'Set SMOKE_AI=true to run the external Groq assistant smoke test',
  );

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/assistant');
  await page.getByLabel('New message').fill('Help me submit an IT request.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Nexus assistant')).toBeVisible();
  await expect(page.locator('.ticket-chat-message').nth(1)).toContainText(
    /.+/,
  );
});
