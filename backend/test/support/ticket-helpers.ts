import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { TicketPriority } from '@prisma/client';
import { backendUrl, createSessionCookie } from './browser-auth';

export async function createTicketViaApi(
  request: APIRequestContext,
  userId: string,
  data: {
    title: string;
    description: string;
    priority: TicketPriority;
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
    priority: TicketPriority;
    department: string;
  },
): Promise<void> {
  await page.getByLabel('Title').fill(values.title);
  await page.getByLabel('Description').fill(values.description);
  await page.getByLabel('Priority').selectOption(values.priority);
  await page
    .getByLabel('Department')
    .selectOption({ label: values.department });
}
