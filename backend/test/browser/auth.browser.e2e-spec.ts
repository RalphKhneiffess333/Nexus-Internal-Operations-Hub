import { expect, test } from '@playwright/test';
import { signIn } from '../support/browser-auth';
import { EMPLOYEE_ID, installSeededDatabaseHooks } from '../support/test-db';

installSeededDatabaseHooks(test);

test('unauthenticated users see the Microsoft login landing page', async ({
  page,
}) => {
  await page.goto('/tickets');

  await expect(page.getByRole('heading', { name: 'Nexus' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Login with Microsoft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'My tickets' }),
  ).not.toBeVisible();
});

test('authenticated users enter the ticket workspace from the root route', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/');

  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByText('Alex Employee')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My tickets' })).toBeVisible();
});

test('signing out removes access to the workspace', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(
    page.getByRole('button', { name: 'Login with Microsoft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'My tickets' }),
  ).not.toBeVisible();
});
