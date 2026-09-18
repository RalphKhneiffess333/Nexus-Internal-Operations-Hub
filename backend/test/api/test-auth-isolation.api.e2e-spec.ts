import { expect, test } from '../support/api-app';

test('does not register manual test-authentication endpoints in the normal app', async ({
  e2e,
}) => {
  const configuration = await e2e.api.get('/__test/auth');
  const login = await e2e.api.post('/__test/auth/login', {
    data: { userId: 'user-employee-1' },
  });

  expect(configuration.status()).toBe(404);
  expect(login.status()).toBe(404);
});
