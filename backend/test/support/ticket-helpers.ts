import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { backendUrl, createSessionCookie } from './browser-auth';

export async function createTicketViaApi(
  request: APIRequestContext,
  userId: string,
  data: {
    title: string;
    description: string;
    priority: string;
    departmentId: string;
  },
) {
  const cookie = await createSessionCookie(request, userId);
  const response = await request.post(`${backendUrl}/tickets`, {
    headers: { Cookie: cookie },
    data,
  });
  expect(response.ok()).toBeTruthy();

  return (await response.json()) as {
    ticketId: string;
    ticketCode: string;
  };
}

export async function claimTicketViaApi(
  request: APIRequestContext,
  userId: string,
  ticketId: string,
): Promise<void> {
  const cookie = await createSessionCookie(request, userId);
  const response = await request.post(
    `${backendUrl}/tickets/${ticketId}/claim`,
    {
      headers: { Cookie: cookie },
      data: {},
    },
  );
  expect(response.ok()).toBeTruthy();
}

export async function closeTicketViaApi(
  request: APIRequestContext,
  userId: string,
  ticketId: string,
  completionNotes: string,
): Promise<void> {
  const cookie = await createSessionCookie(request, userId);
  const response = await request.post(
    `${backendUrl}/tickets/${ticketId}/close`,
    {
      headers: { Cookie: cookie },
      data: { completionNotes },
    },
  );
  expect(response.ok()).toBeTruthy();
}

export async function expectStatus(page: Page, label: string): Promise<void> {
  await expect(
    page.locator('.status-badge').filter({ hasText: new RegExp(`^${label}$`) }),
  ).toBeVisible();
}

export async function fillTicketForm(
  page: Page,
  values: {
    title: string;
    description: string;
    priority: string;
    department: string;
  },
): Promise<void> {
  await page.getByLabel('Title').fill(values.title);
  await page.getByLabel('Description').fill(values.description);
  const priorityLabels: Record<string, string> = {
    LOW: 'Low',
    MODERATE: 'Moderate',
    HIGH: 'High',
  };
  const priority = page.getByRole('combobox', { name: 'Priority' });
  await priority.click();
  await page
    .getByRole('option', {
      name: priorityLabels[values.priority] ?? values.priority,
      exact: true,
    })
    .click();

  const department = page.getByRole('combobox', { name: 'Department' });
  await department.click();
  await page
    .getByRole('option', { name: values.department, exact: true })
    .click();
}
