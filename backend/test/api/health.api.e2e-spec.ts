import { expect, test } from '../support/api-app';

test('returns a public liveness response while the backend is running', async ({
  e2e,
}) => {
  const response = await e2e.api.get('/health/ping');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});

test('requires the health bearer secret for the detailed report', async ({
  e2e,
}) => {
  const response = await e2e.api.get('/health');

  expect(response.status()).toBe(401);
});
