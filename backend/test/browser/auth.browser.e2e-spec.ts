import { expect, test } from '@playwright/test';
import { signIn } from '../support/browser-auth';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  installSeededDatabaseHooks,
} from '../support/test-db';

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

test('authenticated users enter the dashboard from the root route', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Employee 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Live updates connected')).toBeVisible();
});

test('signing out clears the protected URL before another user signs in', async ({
  page,
  request,
}) => {
  await signIn(page, request, EMPLOYEE_ID);
  await page.goto('/tickets/user-one-ticket');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('button', { name: 'Login with Microsoft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'My tickets' }),
  ).not.toBeVisible();

  await signIn(page, request, AGENT_ID);
  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
});
