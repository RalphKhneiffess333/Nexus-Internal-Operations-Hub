import { TicketPriority } from '@prisma/client';
import { EMPLOYEE_2_ID, EMPLOYEE_ID, expect, test } from '../support/api-app';

test('rejects protected ticket endpoints without a session', async ({
  e2e,
}) => {
  const response = await e2e.api.get('/tickets');

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
      priority: TicketPriority.LOW,
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

test('does not trust frontend supplied submitter identity', async ({ e2e }) => {
  const tamperedResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Tampered owner',
      description: 'The submittedBy field should be ignored',
      priority: TicketPriority.LOW,
      departmentId: 'dept-it',
      submittedBy: EMPLOYEE_2_ID,
      createdById: EMPLOYEE_2_ID,
      ownerId: EMPLOYEE_2_ID,
    },
  });
  expect(tamperedResponse.status()).toBe(400);
  const tampered = await tamperedResponse.json();
  expect(tampered.message).toEqual(
    expect.arrayContaining([
      'property createdById should not exist',
      'property ownerId should not exist',
    ]),
  );

  const createdResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Ignored submitter',
      description: 'Only submittedBy is currently tolerated for compatibility',
      priority: TicketPriority.LOW,
      departmentId: 'dept-it',
      submittedBy: EMPLOYEE_2_ID,
    },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  expect(created.submittedBy).toBe(EMPLOYEE_ID);
});
