import { TicketEventAction, TicketStatus } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import {
  ADMIN_ID,
  AGENT_ID,
  EMPLOYEE_ID,
  expect,
  IT_AGENT_2_ID,
  test,
} from '../../support/api-app';

test('smoke: liveness, anonymous session, and protected access', async ({
  e2e,
}) => {
  const ping = await e2e.api.get('/health/ping');
  expect(ping.status()).toBe(200);
  await expect(ping.json()).resolves.toEqual({ status: 'ok' });

  const me = await e2e.api.get('/authentication/me');
  expect(me.status()).toBe(200);
  await expect(me.json()).resolves.toEqual({ user: null });

  const protectedResponse = await e2e.api.get('/tickets');
  expect(protectedResponse.status()).toBe(401);

  const healthSecret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (healthSecret) {
    const readiness = await e2e.api.get('/health', {
      headers: { Authorization: `Bearer ${healthSecret}` },
    });
    expect([200, 503]).toContain(readiness.status());
    const report = await readiness.json();
    expect(report.services.database.status).toBe('healthy');
    expect(report.services.microsoftAuth.status).not.toBe('down');
  }
});

test('smoke: ticket lifecycle survives a backend restart', async ({ e2e }) => {
  const submittedResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Smoke lifecycle ticket',
      description: 'Exercise the release smoke lifecycle.',
      priority: 'MODERATE',
      departmentId: 'dept-it',
    },
  });
  expect(submittedResponse.status()).toBe(201);
  const submitted = await submittedResponse.json();
  expect(submitted.status).toBe(TicketStatus.OPEN);

  const claimResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/claim`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: {},
    },
  );
  expect(claimResponse.status()).toBe(201);
  expect((await claimResponse.json()).status).toBe(TicketStatus.CLAIMED);

  const closeResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/close`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: { completionNotes: 'Smoke test completed the request.' },
    },
  );
  expect(closeResponse.status()).toBe(201);
  expect((await closeResponse.json()).status).toBe(TicketStatus.CLOSED);

  const reopenResponse = await e2e.api.post(
    `/tickets/${submitted.ticketId}/reopen`,
    {
      headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
      data: { description: 'Smoke test reopened the request.' },
    },
  );
  expect(reopenResponse.status()).toBe(201);
  expect((await reopenResponse.json()).status).toBe(TicketStatus.REOPENED);

  await e2e.restart();

  const persistedResponse = await e2e.api.get(
    `/tickets/${submitted.ticketId}`,
    { headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) } },
  );
  expect(persistedResponse.status()).toBe(200);
  expect((await persistedResponse.json()).status).toBe(TicketStatus.REOPENED);
});

test('smoke: attachments and participant chat work over HTTP', async ({
  e2e,
}) => {
  try {
    const submittedResponse = await e2e.api.post('/tickets', {
      headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
      multipart: {
        title: 'Smoke attachment ticket',
        description: 'Exercise the attachment and chat path.',
        priority: 'HIGH',
        departmentId: 'dept-it',
        files: {
          name: 'smoke.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('smoke attachment'),
        },
      },
    });
    expect(submittedResponse.status()).toBe(201);
    const submitted = await submittedResponse.json();

    const eventsResponse = await e2e.api.get(
      `/tickets/${submitted.ticketId}/events`,
      { headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) } },
    );
    expect(eventsResponse.status()).toBe(200);
    const events = await eventsResponse.json();
    expect(events.items[0]).toMatchObject({
      action: TicketEventAction.SUBMISSION,
      hasAttachments: true,
    });

    const eventResponse = await e2e.api.get(
      `/tickets/${submitted.ticketId}/events/${events.items[0].ticketEventId}`,
      { headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) } },
    );
    expect(eventResponse.status()).toBe(200);
    const event = await eventResponse.json();
    expect(event.attachments).toHaveLength(1);

    const downloadResponse = await e2e.api.get(
      `/tickets/${submitted.ticketId}/events/${event.ticketEventId}/attachments/${event.attachments[0].attachmentId}`,
      { headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) } },
    );
    expect(downloadResponse.status()).toBe(200);
    await expect(downloadResponse.body()).resolves.toEqual(
      Buffer.from('smoke attachment'),
    );

    const claimResponse = await e2e.api.post(
      `/tickets/${submitted.ticketId}/claim`,
      {
        headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
        data: {},
      },
    );
    expect(claimResponse.status()).toBe(201);

    const messageResponse = await e2e.api.post(
      `/tickets/${submitted.ticketId}/chat/messages`,
      {
        headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
        data: { content: 'Smoke chat message.' },
      },
    );
    expect(messageResponse.status()).toBe(201);
    expect((await messageResponse.json()).content).toBe('Smoke chat message.');

    const historyResponse = await e2e.api.get(
      `/tickets/${submitted.ticketId}/chat/messages`,
      { headers: { Cookie: e2e.sessionCookie(AGENT_ID) } },
    );
    expect(historyResponse.status()).toBe(200);
    expect((await historyResponse.json()).items).toHaveLength(1);
  } finally {
    const files = await e2e.prisma.file.findMany({
      select: { storageKey: true },
    });
    await Promise.all(
      files.map((file) =>
        fs.rm(resolve(process.cwd(), 'uploads', file.storageKey), {
          force: true,
        }),
      ),
    );
  }
});

test('smoke: handoff and admin boundaries work', async ({ e2e }) => {
  const submittedResponse = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Smoke handoff ticket',
      description: 'Exercise the handoff path.',
      priority: 'LOW',
      departmentId: 'dept-it',
    },
  });
  expect(submittedResponse.status()).toBe(201);
  const ticket = await submittedResponse.json();

  const claimResponse = await e2e.api.post(
    `/tickets/${ticket.ticketId}/claim`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: {},
    },
  );
  expect(claimResponse.status()).toBe(201);

  const handoffResponse = await e2e.api.post(
    `/tickets/${ticket.ticketId}/handoffs`,
    {
      headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
      data: { requestedAgentId: IT_AGENT_2_ID, message: 'Smoke handoff.' },
    },
  );
  expect(handoffResponse.status()).toBe(201);
  const handoff = await handoffResponse.json();

  const incomingResponse = await e2e.api.get('/handoffs?direction=incoming', {
    headers: { Cookie: e2e.sessionCookie(IT_AGENT_2_ID) },
  });
  expect(incomingResponse.status()).toBe(200);
  expect((await incomingResponse.json()).items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ handoffId: handoff.handoffId }),
    ]),
  );

  const acceptResponse = await e2e.api.post(
    `/handoffs/${handoff.handoffId}/accept`,
    {
      headers: { Cookie: e2e.sessionCookie(IT_AGENT_2_ID) },
      data: {},
    },
  );
  expect(acceptResponse.status()).toBe(201);
  expect((await acceptResponse.json()).status).toBe('ACCEPTED');

  const ticketAfterHandoff = await e2e.api.get(
    `/tickets/${ticket.ticketId}`,
    { headers: { Cookie: e2e.sessionCookie(IT_AGENT_2_ID) } },
  );
  expect(ticketAfterHandoff.status()).toBe(200);
  expect((await ticketAfterHandoff.json()).agent.userId).toBe(IT_AGENT_2_ID);

  const adminUsers = await e2e.api.get('/admin/users', {
    headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
  });
  expect(adminUsers.status()).toBe(200);
  expect((await adminUsers.json()).items.length).toBeGreaterThan(0);

  const adminDepartments = await e2e.api.get('/admin/departments', {
    headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
  });
  expect(adminDepartments.status()).toBe(200);

  const adminPriorities = await e2e.api.get('/admin/priorities', {
    headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
  });
  expect(adminPriorities.status()).toBe(200);

  const activity = await e2e.api.get('/admin/audit-logs/activity', {
    headers: { Cookie: e2e.sessionCookie(ADMIN_ID) },
  });
  expect(activity.status()).toBe(200);

  const forbiddenAdminAccess = await e2e.api.get('/admin/users', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
  });
  expect(forbiddenAdminAccess.status()).toBe(403);
});

test('smoke: AI fallback remains available without Groq', async ({ e2e }) => {
  test.skip(Boolean(process.env.GROQ_API_KEY), 'Run fallback smoke without Groq');

  const response = await e2e.api.post('/ai/messages', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: { message: 'Help me with a laptop issue.' },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.conversationId).toEqual(expect.any(String));
  expect(body.message).toEqual(expect.any(String));
  expect(body.message.length).toBeGreaterThan(0);
});
