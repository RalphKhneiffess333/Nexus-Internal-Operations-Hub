import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HandoffStatus,
  Prisma,
  PrismaClient,
  TicketEventAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { config, parse } from 'dotenv';
import { ADMINISTRATION_DEPARTMENT_CODE } from '../departments/department.constants';
import { seedDatabase, seedTestDatabase } from './seed';

type BulkProfile = 'normal' | 'test';

interface BulkSeedOptions {
  profile: BulkProfile;
  employees: number;
  agents: number;
  admins: number;
  ticketsPerUserStateDepartment: number;
  chatMessagesPerTicket: number;
  batchSize: number;
}

interface BulkSeedSummary {
  profile: BulkProfile;
  users: number;
  departments: number;
  tickets: number;
  ticketEvents: number;
  handoffs: number;
  chatMessages: number;
}

interface TicketSeedSpec {
  ticketId: string;
  submittedBy: string;
  departmentId: string;
  priority: string;
  status: TicketStatus;
  agentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  unclaimedSince: Date | null;
  lastReminderAt: Date | null;
  title: string;
  description: string;
  completionNotes: string | null;
  historyAgentId: string;
  historyDepartmentName: string;
  historyPriorityName: string;
  chatSenderIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function profilePrefix(profile: BulkProfile): string {
  return `bulk-${profile}`;
}

function readNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = readNonNegativeInteger(name, fallback);
  if (value <= 0) throw new Error(`${name} must be greater than zero.`);
  return value;
}

function optionsFor(profile: BulkProfile): BulkSeedOptions {
  return {
    profile,
    employees: readNonNegativeInteger('BULK_EMPLOYEES', 30),
    agents: readPositiveInteger('BULK_AGENTS', 15),
    admins: readPositiveInteger('BULK_ADMINS', 5),
    ticketsPerUserStateDepartment: readPositiveInteger(
      'BULK_TICKETS_PER_USER_STATE_DEPARTMENT',
      3,
    ),
    chatMessagesPerTicket: readPositiveInteger(
      'BULK_CHAT_MESSAGES_PER_TICKET',
      20,
    ),
    batchSize: readPositiveInteger('BULK_BATCH_SIZE', 500),
  };
}

function databaseTarget(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const protocol =
      parsed.protocol === 'postgres:' ? 'postgresql:' : parsed.protocol;
    const port = parsed.port || (protocol === 'postgresql:' ? '5432' : '');
    const schema = parsed.searchParams.get('schema') ?? 'public';
    return [
      protocol,
      parsed.hostname.toLowerCase(),
      port,
      parsed.pathname,
      schema,
    ].join('|');
  } catch {
    return databaseUrl.trim();
  }
}

function loadEnvironment(profile: BulkProfile): string {
  const backendRoot = resolve(__dirname, '..', '..');
  const envPath = resolve(
    backendRoot,
    profile === 'test' ? '.env.integration' : '.env',
  );

  if (!existsSync(envPath)) {
    throw new Error(
      `Missing ${envPath}. Copy the matching environment example before running the bulk seed.`,
    );
  }

  config({ path: envPath, override: true });
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is missing from ${envPath}.`);
  }

  if (profile === 'test') {
    const normalEnvPath = resolve(backendRoot, '.env');
    if (existsSync(normalEnvPath)) {
      const normalDatabaseUrl = parse(
        readFileSync(normalEnvPath, 'utf8'),
      ).DATABASE_URL?.trim();
      if (
        normalDatabaseUrl &&
        databaseTarget(normalDatabaseUrl) === databaseTarget(databaseUrl)
      ) {
        throw new Error(
          'Bulk test seeding refused because backend/.env.integration points to the normal application database.',
        );
      }
    }
  }

  return backendRoot;
}

function applyMigrations(backendRoot: string): void {
  const prismaCli = resolve(
    backendRoot,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  if (!existsSync(prismaCli)) {
    throw new Error(
      'The Prisma CLI is not installed. Run npm run install before bulk seeding.',
    );
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

function generatedUsers(profile: BulkProfile, options: BulkSeedOptions) {
  const prefix = profilePrefix(profile);
  const users: Array<{
    userId: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    role: UserRole;
  }> = [];

  for (let index = 1; index <= options.employees; index += 1) {
    users.push({
      userId: `${prefix}-employee-${index}`,
      email: `${prefix}.employee.${String(index).padStart(3, '0')}@example.test`,
      fullName: `Bulk ${profile} Employee ${index}`,
      phoneNumber: `+1-555-01${String(index).padStart(3, '0')}`,
      role: UserRole.Employee,
    });
  }

  for (let index = 1; index <= options.agents; index += 1) {
    users.push({
      userId: `${prefix}-agent-${index}`,
      email: `${prefix}.agent.${String(index).padStart(3, '0')}@example.test`,
      fullName: `Bulk ${profile} Agent ${index}`,
      phoneNumber: `+1-555-02${String(index).padStart(3, '0')}`,
      role: UserRole.Agent,
    });
  }

  for (let index = 1; index <= options.admins; index += 1) {
    users.push({
      userId: `${prefix}-admin-${index}`,
      email: `${prefix}.admin.${String(index).padStart(3, '0')}@example.test`,
      fullName: `Bulk ${profile} Admin ${index}`,
      phoneNumber: `+1-555-03${String(index).padStart(3, '0')}`,
      role: UserRole.Admin,
    });
  }

  return users;
}

async function removePreviousBulkData(
  prisma: PrismaClient,
  profile: BulkProfile,
): Promise<void> {
  const prefix = profilePrefix(profile);
  const generatedUsers = await prisma.user.findMany({
    where: { userId: { startsWith: prefix } },
    select: { userId: true },
  });
  const generatedUserIds = generatedUsers.map(({ userId }) => userId);
  const generatedTickets = await prisma.ticket.findMany({
    where: { ticketId: { startsWith: `${prefix}-ticket-` } },
    select: { ticketId: true },
  });
  const generatedTicketIds = generatedTickets.map(({ ticketId }) => ticketId);

  if (generatedTicketIds.length > 0) {
    const generatedEvents = await prisma.ticketEvent.findMany({
      where: { ticketId: { in: generatedTicketIds } },
      select: { ticketEventId: true },
    });
    const generatedMessages = await prisma.chatMessage.findMany({
      where: { ticketId: { in: generatedTicketIds } },
      select: { messageId: true },
    });
    const eventIds = generatedEvents.map(({ ticketEventId }) => ticketEventId);
    const messageIds = generatedMessages.map(({ messageId }) => messageId);

    await prisma.handoffRequest.deleteMany({
      where: { ticketId: { in: generatedTicketIds } },
    });
    await prisma.chatReadReceipt.deleteMany({
      where: { ticketId: { in: generatedTicketIds } },
    });

    if (eventIds.length > 0 || messageIds.length > 0) {
      const attachments = await prisma.attachment.findMany({
        where: {
          OR: [
            ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
            ...(messageIds.length > 0 ? [{ messageId: { in: messageIds } }] : []),
          ],
        },
        select: { attachmentId: true, fileId: true },
      });
      if (attachments.length > 0) {
        await prisma.attachment.deleteMany({
          where: { attachmentId: { in: attachments.map(({ attachmentId }) => attachmentId) } },
        });
        await prisma.file.deleteMany({
          where: { fileId: { in: attachments.map(({ fileId }) => fileId) } },
        });
      }
    }

    await prisma.chatMessage.deleteMany({
      where: { ticketId: { in: generatedTicketIds } },
    });
    await prisma.ticketEvent.deleteMany({
      where: { ticketId: { in: generatedTicketIds } },
    });
    await prisma.ticket.deleteMany({
      where: { ticketId: { in: generatedTicketIds } },
    });
  }

  if (generatedUserIds.length > 0) {
    await prisma.departmentMember.deleteMany({
      where: { userId: { in: generatedUserIds } },
    });
    await prisma.user.deleteMany({
      where: { userId: { in: generatedUserIds } },
    });
  }
}

async function createGeneratedUsers(
  prisma: PrismaClient,
  profile: BulkProfile,
  options: BulkSeedOptions,
  identityProviderId: string,
): Promise<void> {
  for (const user of generatedUsers(profile, options)) {
    await prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: true,
        hasLogged: false,
        identityProviderUserId: null,
      },
      create: {
        ...user,
        isActive: true,
        hasLogged: false,
        identityProviderId,
        identityProviderUserId: null,
      },
    });
  }
}

async function createGeneratedMemberships(
  prisma: PrismaClient,
  profile: BulkProfile,
  departments: Array<{ departmentId: string }>,
): Promise<void> {
  const prefix = profilePrefix(profile);
  const generatedMembers = await prisma.user.findMany({
    where: {
      userId: { startsWith: prefix },
      role: { in: [UserRole.Agent, UserRole.Admin] },
      isActive: true,
    },
    select: { userId: true },
  });

  const memberships = generatedMembers.flatMap(({ userId }) =>
    departments.map((department) => ({
      departmentMemberId: `${prefix}-membership-${userId}-${department.departmentId}`,
      userId,
      departmentId: department.departmentId,
    })),
  );

  if (memberships.length > 0) {
    await prisma.departmentMember.createMany({
      data: memberships,
      skipDuplicates: true,
    });
  }
}

async function reserveTicketCodes(
  prisma: PrismaClient,
  count: number,
): Promise<string[]> {
  if (count === 0) return [];

  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('ticket_code_seq') AS value
    FROM generate_series(1, ${count})
    ORDER BY value
  `;

  return rows.map(({ value }) => `TKT-${String(value).padStart(4, '0')}`);
}

function jsonDetails(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildTicketSpecs(
  users: Array<{
    userId: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
  }>,
  departments: Array<{ departmentId: string; code: string; name: string }>,
  priorities: Array<{ code: string; name: string }>,
  agentsByDepartment: Map<string, string[]>,
  options: BulkSeedOptions,
  ticketCodes: string[],
): {
  tickets: Prisma.TicketCreateManyInput[];
  events: Prisma.TicketEventCreateManyInput[];
  handoffs: Prisma.HandoffRequestCreateManyInput[];
  messages: Prisma.ChatMessageCreateManyInput[];
  receipts: Prisma.ChatReadReceiptCreateManyInput[];
} {
  const activeUsers = users.filter((user) => user.isActive);
  const activeAdmins = activeUsers.filter((user) => user.role === UserRole.Admin);
  const fallbackSubmitter = activeUsers[0];
  if (!fallbackSubmitter || activeAdmins.length === 0) {
    throw new Error('Bulk seeding requires at least one active user and admin.');
  }

  const states = [
    TicketStatus.OPEN,
    TicketStatus.CLAIMED,
    TicketStatus.CLOSED,
    TicketStatus.REOPENED,
  ];
  const tickets: Prisma.TicketCreateManyInput[] = [];
  const events: Prisma.TicketEventCreateManyInput[] = [];
  const handoffs: Prisma.HandoffRequestCreateManyInput[] = [];
  const messages: Prisma.ChatMessageCreateManyInput[] = [];
  const receipts: Prisma.ChatReadReceiptCreateManyInput[] = [];
  let ticketIndex = 0;

  for (const submitterCandidate of activeUsers) {
    for (const department of departments) {
      for (const status of states) {
        for (
          let replica = 0;
          replica < options.ticketsPerUserStateDepartment;
          replica += 1
        ) {
          const ticketId = `${profilePrefix(options.profile)}-ticket-${ticketIndex + 1}`;
          const ticketCode = ticketCodes[ticketIndex];
          const priority = priorities[ticketIndex % priorities.length];
          const departmentAgents = agentsByDepartment.get(department.departmentId) ?? [];
          const historyAgentId = departmentAgents[ticketIndex % departmentAgents.length];
          const submitter =
            department.code === ADMINISTRATION_DEPARTMENT_CODE &&
            submitterCandidate.role === UserRole.Employee
              ? activeAdmins[ticketIndex % activeAdmins.length]
              : submitterCandidate;
          const createdAt = new Date(
            Date.now() - ((ticketIndex * 17) % 240) * DAY_MS - (replica * HOUR_MS),
          );
          const claimAt = new Date(createdAt.getTime() + HOUR_MS);
          const closeAt = new Date(createdAt.getTime() + 2 * HOUR_MS);
          const reopenAt = new Date(createdAt.getTime() + 3 * HOUR_MS);
          const handoffAt = new Date(claimAt.getTime() + 30 * MINUTE_MS);
          const handoffStatus =
            status === TicketStatus.CLAIMED
              ? ([
                  HandoffStatus.PENDING,
                  HandoffStatus.REJECTED,
                  HandoffStatus.CANCELLED,
                  HandoffStatus.ACCEPTED,
                ][ticketIndex % 4] as HandoffStatus)
              : null;
          const requestedAgentId =
            status === TicketStatus.CLAIMED
              ? departmentAgents.find((agentId) => agentId !== historyAgentId) ?? null
              : null;
          if (status === TicketStatus.CLAIMED && !requestedAgentId) {
            throw new Error(
              `Bulk seeding requires at least two active agents in ${department.name} to create handoffs.`,
            );
          }
          const finalUpdatedAt = status === TicketStatus.REOPENED
            ? reopenAt
            : status === TicketStatus.CLOSED
              ? closeAt
              : status === TicketStatus.CLAIMED
                ? handoffStatus === HandoffStatus.ACCEPTED
                  ? handoffAt
                  : claimAt
                : createdAt;
          const finalAgentId =
            status === TicketStatus.CLAIMED && handoffStatus === HandoffStatus.ACCEPTED
              ? requestedAgentId
              : status === TicketStatus.CLAIMED
                ? historyAgentId
                : null;
          const closedAt = status === TicketStatus.CLOSED ? closeAt : null;
          const unclaimedSince =
            status === TicketStatus.OPEN
              ? createdAt
              : status === TicketStatus.REOPENED
                ? reopenAt
                : null;
          const title = `Bulk ${status.toLowerCase()} ticket ${ticketCode}`;
          const description = `Synthetic load-test ticket for ${department.name}, submitted by ${submitter.fullName}.`;
          const completionNotes =
            status === TicketStatus.CLOSED
              ? `Synthetic resolution note for ${ticketCode}.`
              : null;

          tickets.push({
            ticketId,
            ticketCode,
            title,
            description,
            priority: priority.code,
            status,
            departmentId: department.departmentId,
            submittedBy: submitter.userId,
            agentId: finalAgentId,
            active: true,
            completionNotes,
            createdAt,
            updatedAt: finalUpdatedAt,
            closedAt,
            unclaimedSince,
            lastReminderAt: unclaimedSince ? createdAt : null,
          });

          const addEvent = (
            eventNumber: number,
            action: TicketEventAction,
            userId: string,
            at: Date,
            details: Record<string, unknown>,
          ) => {
            events.push({
              ticketEventId: `${profilePrefix(options.profile)}-event-${ticketIndex + 1}-${eventNumber}`,
              ticketId,
              userId,
              action,
              details: jsonDetails(details),
              createdAt: at,
              updatedAt: at,
            });
          };

          addEvent(1, TicketEventAction.SUBMISSION, submitter.userId, createdAt, {
            title,
            departmentId: department.departmentId,
            priority: priority.code,
            description,
            submitterId: submitter.userId,
          });

          if (ticketIndex % 2 === 0) {
            addEvent(2, TicketEventAction.MODIFICATION, submitter.userId, new Date(createdAt.getTime() + 30 * MINUTE_MS), {
              oldTitle: title,
              newTitle: `${title} (updated)`,
              oldDepartmentId: department.departmentId,
              newDepartmentId: department.departmentId,
              oldPriority: priority.code,
              newPriority: priority.code,
              oldDescription: description,
              newDescription: `${description} Synthetic modification history.`,
            });
          }

          let eventNumber = ticketIndex % 2 === 0 ? 3 : 2;
          if (status !== TicketStatus.OPEN) {
            addEvent(eventNumber, TicketEventAction.CLAIM, historyAgentId, claimAt, {
              agentId: historyAgentId,
              timestamp: claimAt.toISOString(),
            });
            eventNumber += 1;
          }
          if (status === TicketStatus.CLOSED || status === TicketStatus.REOPENED) {
            addEvent(eventNumber, TicketEventAction.CLOSE, historyAgentId, closeAt, {
              agentId: historyAgentId,
              completionNotes,
            });
            eventNumber += 1;
          }
          if (status === TicketStatus.REOPENED) {
            addEvent(eventNumber, TicketEventAction.REOPEN, submitter.userId, reopenAt, {
              priority: priority.code,
              description: `${description} Reopened synthetic ticket.`,
              submitterId: submitter.userId,
            });
          }

          if (
            status === TicketStatus.CLAIMED &&
            handoffStatus &&
            requestedAgentId
          ) {
            const handoffActorId =
              handoffStatus === HandoffStatus.ACCEPTED ||
              handoffStatus === HandoffStatus.REJECTED
                ? requestedAgentId
                : historyAgentId;
            const resolvedAt =
              handoffStatus === HandoffStatus.PENDING ? null : handoffAt;
            const handoffId = `${profilePrefix(options.profile)}-handoff-${ticketIndex + 1}`;

            handoffs.push({
              handoffId,
              ticketId,
              requesterId: historyAgentId,
              requestedAgentId,
              status: handoffStatus,
              message: `Synthetic ${handoffStatus.toLowerCase()} handoff for ${ticketCode}.`,
              createdAt: handoffAt,
              updatedAt: handoffAt,
              resolvedAt,
            });
            addEvent(eventNumber, TicketEventAction.HANDOFF, handoffActorId, handoffAt, {
              handoffId,
              requesterId: historyAgentId,
              requestedAgentId,
              action:
                handoffStatus === HandoffStatus.PENDING
                  ? 'REQUESTED'
                  : handoffStatus,
              timestamp: handoffAt.toISOString(),
            });
          }

          const chatAgentId = finalAgentId ?? historyAgentId;
          const chatSenderIds = [submitter.userId, chatAgentId];
          for (let messageIndex = 0; messageIndex < options.chatMessagesPerTicket; messageIndex += 1) {
            const messageAt = new Date(
              createdAt.getTime() + HOUR_MS + messageIndex * MINUTE_MS,
            );
            messages.push({
              messageId: `${profilePrefix(options.profile)}-message-${ticketIndex + 1}-${messageIndex + 1}`,
              ticketId,
              senderId: chatSenderIds[messageIndex % chatSenderIds.length],
              content: `Synthetic chat message ${messageIndex + 1} for ${ticketCode}.`,
              createdAt: messageAt,
              updatedAt: messageAt,
            });
          }

          const latestMessageAt = new Date(
            createdAt.getTime() + HOUR_MS + options.chatMessagesPerTicket * MINUTE_MS,
          );
          for (const userId of new Set(chatSenderIds)) {
            receipts.push({
              ticketId,
              userId,
              lastReadAt: latestMessageAt,
              updatedAt: latestMessageAt,
            });
          }

          ticketIndex += 1;
        }
      }
    }
  }

  return { tickets, events, handoffs, messages, receipts };
}

async function insertInBatches<T>(
  rows: T[],
  batchSize: number,
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += batchSize) {
    await insert(rows.slice(index, index + batchSize));
  }
}

export async function seedBulkData(
  prisma: PrismaClient,
  profile: BulkProfile,
): Promise<BulkSeedSummary> {
  const options = optionsFor(profile);
  if (profile === 'test') await seedTestDatabase(prisma);
  else await seedDatabase(prisma);

  await removePreviousBulkData(prisma, profile);

  const identityProvider = await prisma.identityProvider.findFirst({
    where: { code: 'MICROSOFT_ENTRA_ID', active: true },
    select: { identityProviderId: true },
  });
  if (!identityProvider) throw new Error('The Microsoft Entra identity provider was not seeded.');

  await createGeneratedUsers(
    prisma,
    profile,
    options,
    identityProvider.identityProviderId,
  );

  const departments = await prisma.department.findMany({
    where: { active: true },
    select: { departmentId: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  const priorities = await prisma.priority.findMany({
    where: { active: true },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  });
  if (departments.length === 0) throw new Error('No active departments are available for bulk seeding.');
  if (priorities.length === 0) throw new Error('No active priorities are available for bulk seeding.');

  await createGeneratedMemberships(prisma, profile, departments);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { userId: true, fullName: true, role: true, isActive: true },
    orderBy: { userId: 'asc' },
  });
  const userMap = new Map(users.map((user) => [user.userId, user]));
  const agentsByDepartment = new Map<string, string[]>();
  for (const department of departments) {
    const memberships = await prisma.departmentMember.findMany({
      where: { departmentId: department.departmentId },
      select: { userId: true },
    });
    const agents = memberships.flatMap(({ userId }) => {
      const user = userMap.get(userId);
      return user &&
        user.isActive &&
        (user.role === UserRole.Agent || user.role === UserRole.Admin)
        ? [user.userId]
        : [];
    });
    if (agents.length === 0) {
      throw new Error(`No active agents are assigned to ${department.name}.`);
    }
    agentsByDepartment.set(department.departmentId, agents);
  }

  const estimatedTicketCount =
    users.length *
    departments.length *
    4 *
    options.ticketsPerUserStateDepartment;
  const ticketCodes = await reserveTicketCodes(prisma, estimatedTicketCount);
  const generated = buildTicketSpecs(
    users,
    departments,
    priorities,
    agentsByDepartment,
    options,
    ticketCodes,
  );

  await insertInBatches(generated.tickets, options.batchSize, (batch) =>
    prisma.ticket.createMany({ data: batch }),
  );
  await insertInBatches(generated.events, options.batchSize * 4, (batch) =>
    prisma.ticketEvent.createMany({ data: batch }),
  );
  await insertInBatches(generated.handoffs, options.batchSize * 4, (batch) =>
    prisma.handoffRequest.createMany({ data: batch }),
  );
  await insertInBatches(generated.messages, options.batchSize * 4, (batch) =>
    prisma.chatMessage.createMany({ data: batch }),
  );
  await insertInBatches(generated.receipts, options.batchSize * 4, (batch) =>
    prisma.chatReadReceipt.createMany({ data: batch }),
  );

  return {
    profile,
    users: users.length,
    departments: departments.length,
    tickets: generated.tickets.length,
    ticketEvents: generated.events.length,
    handoffs: generated.handoffs.length,
    chatMessages: generated.messages.length,
  };
}

async function main(): Promise<void> {
  const profile = process.argv[2] as BulkProfile | undefined;
  if (profile !== 'normal' && profile !== 'test') {
    throw new Error('Usage: ts-node src/database/bulk-seed.ts <normal|test>');
  }

  const backendRoot = loadEnvironment(profile);
  applyMigrations(backendRoot);

  const prisma = new PrismaClient();
  try {
    console.log(`Preparing ${profile} database for bulk data...`);
    const summary = await seedBulkData(prisma, profile);
    console.log('\nBulk seed completed successfully.');
    console.table(summary);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\nBulk seed failed. No application server was started.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
