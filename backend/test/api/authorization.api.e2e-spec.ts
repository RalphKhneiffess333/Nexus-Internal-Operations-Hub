import { EMPLOYEE_2_ID, EMPLOYEE_ID, expect, test } from '../support/api-app';

test('rejects protected ticket endpoints without a session', async ({
  e2e,
}) => {
  const response = await e2e.api.get('/tickets');

  expect(response.status()).toBe(401);
});

test('rejects AI messages without a session', async ({ e2e }) => {
  const response = await e2e.api.post('/ai/messages', {
    data: { message: 'Help me with my laptop.' },
  });

  expect(response.status()).toBe(401);
});

test('rejects disallowed endpoint roles before reaching ticket policies', async ({
  e2e,
}) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Cannot claim this',
      description: 'Employees cannot claim tickets',
      priority: 'LOW',
      departmentId: 'dept-it',
    },
  });
  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();

  const claimResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/claim`,
    {
      headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
      data: {},
    },
  );
  expect(claimResponse.status()).toBe(403);
});

test('rejects frontend supplied ticket ownership fields', async ({ e2e }) => {
  const tamperedResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Tampered owner',
      description: 'Ownership and assignment fields should be rejected',
      priority: 'LOW',
      departmentId: 'dept-it',
      submittedBy: EMPLOYEE_2_ID,
      agentId: EMPLOYEE_2_ID,
      createdById: EMPLOYEE_2_ID,
      ownerId: EMPLOYEE_2_ID,
    },
  });
  expect(tamperedResponse.status()).toBe(400);
  const tampered = await tamperedResponse.json();
  expect(tampered.message).toEqual(
    expect.arrayContaining([
      'property submittedBy should not exist',
      'property agentId should not exist',
      'property createdById should not exist',
      'property ownerId should not exist',
    ]),
  );
});
