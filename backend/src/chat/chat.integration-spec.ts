import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { TicketStatus } from '@prisma/client';
import { ChatModule } from './chat.module';
import { ChatService } from './chat.service';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { TicketsModule } from '../tickets/tickets.module';
import {
  AGENT_ID,
  EMPLOYEE_2_ID,
  IT_AGENT_2_ID,
  agentUser,
  claimTicket,
  closeTicket,
  requestUser,
  submitOpenTicket,
} from '../tickets/tickets.test-utils';
import { TicketsService } from '../tickets/tickets.service';
import { RealtimeInternalEvent } from '../realtime/realtime-events';
import { resetTicketData, seedTestDatabase } from '../database/seed';

describe('Chat integration', () => {
  let chat: ChatService;
  let tickets: TicketsService;
  let prisma: PrismaService;
  let events: EventEmitter2;
  let moduleRef: Awaited<ReturnType<typeof createModule>>;

  beforeEach(async () => {
    moduleRef = await createModule();
    chat = moduleRef.get(ChatService);
    tickets = moduleRef.get(TicketsService);
    prisma = moduleRef.get(PrismaService);
    events = moduleRef.get(EventEmitter2);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('persists chronological messages with server-derived sender identity', async () => {
    const open = await submitOpenTicket(tickets);
    await claimTicket(tickets, open.ticketId);
    const emitted = jest.spyOn(events, 'emit');

    const first = await chat.createMessage(
      open.ticketId,
      { content: 'Could you help with this?' },
      requestUser(),
    );
    const second = await chat.createMessage(
      open.ticketId,
      { content: 'I am looking into it now.' },
      agentUser(),
    );

    const history = await chat.listMessages(open.ticketId, requestUser());
    expect(history.map((message) => message.messageId)).toEqual([
      first.messageId,
      second.messageId,
    ]);
    expect(first.sender.userId).toBe(requestUser().userId);
    expect(second.sender.userId).toBe(AGENT_ID);
    expect(emitted).toHaveBeenCalledWith(
      RealtimeInternalEvent.ChatMessageCreated,
      expect.objectContaining({ eventId: first.messageId, ticketId: open.ticketId }),
    );
  });

  it('lists accessible ticket conversations with a last-message preview and read state', async () => {
    const open = await submitOpenTicket(tickets);
    await claimTicket(tickets, open.ticketId);
    await chat.createMessage(
      open.ticketId,
      { content: 'Could you share the device serial number?' },
      agentUser(),
    );

    const employeeInbox = await chat.listConversations(requestUser());
    expect(employeeInbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticketId: open.ticketId,
          ticketCode: open.ticketCode,
          unread: true,
          lastMessage: expect.objectContaining({
            content: 'Could you share the device serial number?',
            sender: expect.objectContaining({ userId: AGENT_ID }),
          }),
        }),
      ]),
    );

    await chat.markConversationRead(open.ticketId, requestUser());
    const readConversation = (await chat.listConversations(requestUser())).find(
      (conversation) => conversation.ticketId === open.ticketId,
    );
    expect(readConversation?.unread).toBe(false);

    const unrelatedEmployee = requestUser({
      userId: EMPLOYEE_2_ID,
      email: 'sam@company.com',
      identityProviderUserId: EMPLOYEE_2_ID,
    });
    expect(await chat.listConversations(unrelatedEmployee)).toEqual([]);
  });

  it('searches conversations by ticket metadata and latest message context', async () => {
    const matching = await submitOpenTicket(tickets, {
      title: 'VPN access request',
    });
    await claimTicket(tickets, matching.ticketId);
    await chat.createMessage(
      matching.ticketId,
      { content: 'The secure network access details are ready.' },
      agentUser(),
    );

    const unrelated = await submitOpenTicket(tickets, {
      title: 'Printer replacement',
    });
    await claimTicket(tickets, unrelated.ticketId);
    await chat.createMessage(
      unrelated.ticketId,
      { content: 'The replacement printer is on its way.' },
      agentUser(),
    );

    await expect(
      chat.listConversations(requestUser(), { search: matching.ticketCode }),
    ).resolves.toEqual([
      expect.objectContaining({ ticketId: matching.ticketId }),
    ]);
    await expect(
      chat.listConversations(requestUser(), { search: 'VPN access request' }),
    ).resolves.toEqual([
      expect.objectContaining({ ticketId: matching.ticketId }),
    ]);
    await expect(
      chat.listConversations(requestUser(), { search: 'secure network access' }),
    ).resolves.toEqual([
      expect.objectContaining({ ticketId: matching.ticketId }),
    ]);
    await expect(
      chat.listConversations(requestUser(), { search: 'IT Agent 1' }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ticketId: matching.ticketId }),
        expect.objectContaining({ ticketId: unrelated.ticketId }),
      ]),
    );
    await expect(
      chat.listConversations(requestUser(), { search: 'does-not-exist' }),
    ).resolves.toEqual([]);
  });

  it('allows ticket viewers to read, but only the submitter and assigned agent to send', async () => {
    const open = await submitOpenTicket(tickets);
    await claimTicket(tickets, open.ticketId);
    const unrelatedEmployee = requestUser({
      userId: EMPLOYEE_2_ID,
      email: 'sam@company.com',
      identityProviderUserId: EMPLOYEE_2_ID,
    });

    await expect(chat.listMessages(open.ticketId, unrelatedEmployee)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      chat.createMessage(open.ticketId, { content: 'I should not send this' }, unrelatedEmployee),
    ).rejects.toThrow(ForbiddenException);

    await expect(chat.listMessages(open.ticketId, requestUser())).resolves.toEqual([]);
    await expect(chat.listMessages(open.ticketId, agentUser())).resolves.toEqual([]);
    await expect(
      chat.listMessages(open.ticketId, agentUser(IT_AGENT_2_ID)),
    ).resolves.toEqual([]);
    await expect(
      chat.createMessage(
        open.ticketId,
        { content: 'I can see this ticket, but do not own it.' },
        agentUser(IT_AGENT_2_ID),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('keeps non-claimed chats read-only and never emits rejected messages', async () => {
    const open = await submitOpenTicket(tickets);
    const emitted = jest.spyOn(events, 'emit');

    await expect(
      chat.createMessage(open.ticketId, { content: 'Too early' }, requestUser()),
    ).rejects.toThrow(BadRequestException);

    const claimed = await claimTicket(tickets, open.ticketId);
    await closeTicket(tickets, claimed.ticketId);
    await expect(
      chat.createMessage(claimed.ticketId, { content: 'Too late' }, requestUser()),
    ).rejects.toThrow(BadRequestException);
    expect(
      emitted.mock.calls.some(([event]) => event === RealtimeInternalEvent.ChatMessageCreated),
    ).toBe(false);
    expect(
      await prisma.chatMessage.count({ where: { ticketId: open.ticketId } }),
    ).toBe(0);
  });

  it('creates attachment-only messages through the shared file and attachment records', async () => {
    const open = await submitOpenTicket(tickets);
    await claimTicket(tickets, open.ticketId);
    const message = await chat.createMessage(
      open.ticketId,
      {},
      requestUser(),
      [
        {
          originalname: 'screenshot.png',
          mimetype: 'image/png',
          size: 4,
          buffer: Buffer.from([1, 2, 3, 4]),
        },
      ],
    );

    expect(message.content).toBeNull();
    expect(message.attachments).toHaveLength(1);
    const attachment = await prisma.attachment.findUnique({
      where: { attachmentId: message.attachments[0].attachmentId },
    });
    expect(attachment?.messageId).toBe(message.messageId);
    expect(attachment?.eventId).toBeNull();
  });

  async function createModule() {
    const result = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), DatabaseModule, TicketsModule, ChatModule],
    }).compile();
    const database = result.get(PrismaService);
    await database.$connect();
    await seedTestDatabase(database);
    await resetTicketData(database);
    return result;
  }
});
