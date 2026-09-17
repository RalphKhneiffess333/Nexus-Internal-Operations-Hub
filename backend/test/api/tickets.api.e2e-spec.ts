import { TicketPriority, TicketStatus } from '@prisma/client';
import {
  ADMIN_ID,
  AGENT_ID,
  EMPLOYEE_ID,
  expect,
  test,
} from '../support/api-app';

test('submits, claims, closes, and reopens a ticket over HTTP', async ({
  e2e,
}) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Badge access',
      description: 'Need building access',
      priority: TicketPriority.MODERATE,
      departmentId: 'dept-it',
    },
  });

  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();
  expect(submitted.status).toBe(TicketStatus.OPEN);
  expect(submitted.submittedBy).toMatchObject({
    userId: EMPLOYEE_ID,
    fullName: 'Alex Employee',
    email: 'alex@company.com',
  });
  expect(submitted.agent).toBeNull();
  expect(submitted.submittedByName).toBeUndefined();
  expect(submitted.agentId).toBeUndefined();

  const claimResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/claim`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: {},
    },
  );
  expect(claimResponse.status()).toBe(201);
  const claimed = await claimResponse.json();
  expect(claimed.status).toBe(TicketStatus.CLAIMED);
  expect(claimed.agent.userId).toBe(AGENT_ID);

  const closeResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/close`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: { completionNotes: 'Access granted' },
    },
  );
  expect(closeResponse.status()).toBe(201);
  const closed = await closeResponse.json();
  expect(closed.status).toBe(TicketStatus.CLOSED);
  expect(closed.agent).toBeNull();

  const reopenResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/reopen`,
    {
      headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
      data: { description: 'Still cannot enter after hours' },
    },
  );
  expect(reopenResponse.status()).toBe(201);
  const reopened = await reopenResponse.json();
  expect(reopened.status).toBe(TicketStatus.REOPENED);
});

test('keeps tickets after the application restarts', async ({ e2e }) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Persistent ticket',
      description: 'Must survive a restart',
      priority: TicketPriority.LOW,
      departmentId: 'dept-it',
    },
  });
  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();
  const ticketId = submitted.ticketId as string;

  await e2e.restart();

  const persistedResponse = await e2e.api.get(`/tickets/${ticketId}`, {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
  });
  expect(persistedResponse.status()).toBe(200);
  const persisted = await persistedResponse.json();
  expect(persisted.ticketId).toBe(ticketId);
  expect(persisted.title).toBe('Persistent ticket');
});

test('rejects closing an OPEN ticket over HTTP', async ({ e2e }) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Email issue',
      description: 'Cannot send mail',
      priority: TicketPriority.LOW,
      departmentId: 'dept-it',
    },
  });
  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();

  const closeResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/close`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: {},
    },
  );
  expect(closeResponse.status()).toBe(400);
});

test('rejects an admin claiming outside their department over HTTP', async ({
  e2e,
}) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Benefits question',
      description: 'Need help with enrollment',
      priority: TicketPriority.LOW,
      departmentId: 'dept-hr',
    },
  });
  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();

  const viewResponse = await e2e.api.get(`/tickets/${submitted.ticketId}`, {
    headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
  });
  expect(viewResponse.status()).toBe(200);

  const claimResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/claim`,
    {
      headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
      data: {},
    },
  );
  expect(claimResponse.status()).toBe(403);
});

test('allows only one concurrent claim to succeed', async ({ e2e }) => {
  const submitResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Concurrent claim',
      description: 'Two agents try to claim at once',
      priority: TicketPriority.HIGH,
      departmentId: 'dept-it',
    },
  });
  expect(submitResponse.status()).toBe(201);
  const submitted = await submitResponse.json();
  const ticketId = submitted.ticketId as string;

  const [first, second] = await Promise.all([
    e2e.api.post(`/tickets/${ticketId}/claim`, {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: {},
    }),
    e2e.api.post(`/tickets/${ticketId}/claim`, {
      headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
      data: {},
    }),
  ]);

  const statuses = [first.status(), second.status()].sort();
  expect(statuses).toEqual([201, 400]);

  const winner =
    first.status() === 201 ? await first.json() : await second.json();
  const stored = await e2e.prisma.ticket.findUnique({ where: { ticketId } });
  expect(stored?.status).toBe(TicketStatus.CLAIMED);
  expect(stored?.agentId).toBe(winner.agent.userId);
});
