import { AGENT_ID, EMPLOYEE_2_ID, EMPLOYEE_ID, expect, test } from '../support/api-app';

test('persists chat messages only for claimed-ticket participants over HTTP', async ({ e2e }) => {
  const submitted = await e2e.api.post('/tickets', {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: {
      title: 'Chat API ticket',
      description: 'Need a message thread.',
      priority: 'MODERATE',
      departmentId: 'dept-it',
    },
  });
  const ticket = await submitted.json();

  const rejected = await e2e.api.post(`/tickets/${ticket.ticketId}/chat/messages`, {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: { content: 'This is not claimed yet.' },
  });
  expect(rejected.status()).toBe(400);

  const claim = await e2e.api.post(`/tickets/${ticket.ticketId}/claim`, {
    headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
    data: {},
  });
  expect(claim.status()).toBe(201);

  const forgedSender = await e2e.api.post(`/tickets/${ticket.ticketId}/chat/messages`, {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: { content: 'Can you help me today?', senderId: AGENT_ID },
  });
  expect(forgedSender.status()).toBe(400);

  const created = await e2e.api.post(`/tickets/${ticket.ticketId}/chat/messages`, {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_ID) },
    data: { content: 'Can you help me today?' },
  });
  expect(created.status()).toBe(201);
  const message = await created.json();
  expect(message).toMatchObject({
    ticketId: ticket.ticketId,
    content: 'Can you help me today?',
    sender: { userId: EMPLOYEE_ID },
  });

  const history = await e2e.api.get(`/tickets/${ticket.ticketId}/chat/messages`, {
    headers: { Cookie: e2e.sessionCookie(AGENT_ID) },
  });
  expect(history.status()).toBe(200);
  const historyPayload = await history.json();
  expect(historyPayload).toMatchObject({
    page: 1,
    pageSize: 50,
    hasMore: false,
  });
  expect(historyPayload.items).toEqual([
    expect.objectContaining({ messageId: message.messageId }),
  ]);

  const unrelated = await e2e.api.get(`/tickets/${ticket.ticketId}/chat/messages`, {
    headers: { Cookie: e2e.sessionCookie(EMPLOYEE_2_ID) },
  });
  expect(unrelated.status()).toBe(403);
});
