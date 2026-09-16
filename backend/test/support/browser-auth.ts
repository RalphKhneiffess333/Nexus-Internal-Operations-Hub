import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { SESSION_COOKIE_NAME } from '../../src/authentication/authentication.constants';

export const backendUrl = 'http://localhost:3000';
export const frontendUrl = 'http://localhost:5173';

export async function signIn(
  page: Page,
  request: APIRequestContext,
  userId: string,
): Promise<void> {
  const response = await request.post(`${backendUrl}/__e2e/sessions`, {
    data: { userId },
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { sessionId: string };
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: body.sessionId,
      url: frontendUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function createSessionCookie(
  request: APIRequestContext,
  userId: string,
): Promise<string> {
  const response = await request.post(`${backendUrl}/__e2e/sessions`, {
    data: { userId },
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { sessionId: string };
  return `${SESSION_COOKIE_NAME}=${body.sessionId}`;
}
