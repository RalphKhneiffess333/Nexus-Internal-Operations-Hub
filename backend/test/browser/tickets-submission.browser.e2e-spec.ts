import { expect, test } from '@playwright/test';
import { TicketStatus } from '@prisma/client';
import { signIn } from '../support/browser-auth';
import {
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
  IT_DEPARTMENT_ID,
  prisma,
} from '../support/test-db';
import {
  createTicketViaApi,
  expectStatus,
  fillTicketForm,
} from '../support/ticket-helpers';

installSeededDatabaseHooks(test);

test('employees submit a ticket through the browser and it is persisted', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets/new');

  await fillTicketForm(page, {
    title: 'Badge access from browser',
    description: 'Need building access from the west entrance.',
    priority: 'HIGH',
    department: 'Information Technology',
  });
  await page.getByRole('button', { name: 'Submit ticket' }).click();

  await expect(page).toHaveURL(/\/tickets\/(?!new$)[^/]+$/);
  await expect(
    page.getByRole('heading', { name: 'Badge access from browser' }),
  ).toBeVisible();
  await expectStatus(page, 'Open');

  const stored = await prisma.ticket.findFirstOrThrow({
    where: { title: 'Badge access from browser' },
  });
  expect(stored.status).toBe(TicketStatus.OPEN);
  expect(stored.submittedBy).toBe(EMPLOYEE_ID);
  expect(stored.departmentId).toBe(IT_DEPARTMENT_ID);
  expect(stored.agentId).toBeNull();
});

test('required ticket fields block submission before any ticket is created', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets/new');

  await page.getByRole('button', { name: 'Submit ticket' }).click();

  await expect(page).toHaveURL(/\/tickets\/new$/);
  await expect(page.getByLabel('Title')).toBeFocused();
  await expect.poll(() => prisma.ticket.count()).toBe(0);
});

test('submitted ticket lists render persisted ticket data', async ({
  page,
  request,
}) => {
  const ticket = await createTicketViaApi(request, EMPLOYEE_ID, {
    title: 'Laptop battery replacement',
    description: 'Battery no longer lasts through meetings.',
    priority: 'MODERATE',
    departmentId: IT_DEPARTMENT_ID,
  });

  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets');

  const ticketCard = page
    .getByRole('article')
    .filter({ hasText: ticket.ticketCode });
  await expect(ticketCard).toBeVisible();
  await expect(
    ticketCard.getByText('Laptop battery replacement'),
  ).toBeVisible();
  await expect(ticketCard.getByText('Moderate', { exact: true })).toBeVisible();
  await expect(
    ticketCard.getByText('Information Technology', { exact: true }),
  ).toBeVisible();
  await expectStatus(page, 'Open');
});
