import { EMPLOYEE_ID, expect, test } from '../support/api-app';

test('lists active departments over HTTP', async ({ e2e }) => {
  const response = await e2e.api.get('/departments', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
  });

  expect(response.status()).toBe(200);
  const departments = await response.json();
  expect(departments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        departmentId: 'dept-hr',
        code: 'HR',
        name: 'Human Resources',
        active: true,
      }),
      expect.objectContaining({
        departmentId: 'dept-it',
        code: 'IT',
        name: 'Information Technology',
        active: true,
      }),
    ]),
  );
  expect(departments).toHaveLength(2);
});
