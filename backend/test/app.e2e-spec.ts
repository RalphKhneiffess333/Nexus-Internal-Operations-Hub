import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { SESSION_COOKIE_NAME } from '../src/authentication/authentication.constants';
import { SessionService } from '../src/authentication/sessions/session.service';
import { PrismaService } from '../src/database/prisma.service';
import {
  ADMIN_ID,
  AGENT_ID,
  EMPLOYEE_ID,
  EMPLOYEE_2_ID,
  resetTicketData,
  seedDatabase,
} from '../src/database/seed';

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionService: SessionService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    sessionService = app.get(SessionService);
    await prisma.$connect();
    await seedDatabase(prisma);
    await resetTicketData(prisma);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('submits, claims, closes, and reopens a ticket over HTTP', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Badge access',
        description: 'Need building access',
        priority: TicketPriority.MODERATE,
        departmentId: 'dept-it',
      })
      .expect(201);

    const ticketId = submitResponse.body.ticketId;
    expect(submitResponse.body.status).toBe(TicketStatus.OPEN);

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/claim`)
      .set('Cookie', sessionCookie(AGENT_ID))
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.CLAIMED);
        expect(res.body.agentId).toBe(AGENT_ID);
      });

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/close`)
      .set('Cookie', sessionCookie(AGENT_ID))
      .send({ completionNotes: 'Access granted' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.CLOSED);
        expect(res.body.agentId).toBeNull();
      });

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/reopen`)
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({ description: 'Still cannot enter after hours' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.REOPENED);
      });
  });

  it('keeps tickets after the application restarts', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Persistent ticket',
        description: 'Must survive a restart',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
      })
      .expect(201);

    const ticketId = submitResponse.body.ticketId as string;
    await app.close();

    const restarted = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = restarted.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    sessionService = app.get(SessionService);
    await app.init();

    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .expect(200)
      .expect((res) => {
        expect(res.body.ticketId).toBe(ticketId);
        expect(res.body.title).toBe('Persistent ticket');
      });
  });

  it('lists active departments over HTTP', async () => {
    const response = await request(app.getHttpServer())
      .get('/departments')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .expect(200);

    expect(response.body).toEqual(
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
    expect(response.body).toHaveLength(2);
  });

  it('rejects closing an OPEN ticket over HTTP', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Email issue',
        description: 'Cannot send mail',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${submitResponse.body.ticketId}/close`)
      .set('Cookie', sessionCookie(AGENT_ID))
      .send({})
      .expect(400);
  });

  it('allows only one concurrent claim to succeed', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Concurrent claim',
        description: 'Two agents try to claim at once',
        priority: TicketPriority.HIGH,
        departmentId: 'dept-it',
      })
      .expect(201);

    const ticketId = submitResponse.body.ticketId as string;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/tickets/${ticketId}/claim`)
        .set('Cookie', sessionCookie(AGENT_ID))
        .send({}),
      request(app.getHttpServer())
        .post(`/tickets/${ticketId}/claim`)
        .set('Cookie', sessionCookie(ADMIN_ID))
        .send({}),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    const winner = first.status === 201 ? first.body : second.body;
    const stored = await prisma.ticket.findUnique({ where: { ticketId } });
    expect(stored?.status).toBe(TicketStatus.CLAIMED);
    expect(stored?.agentId).toBe(winner.agentId);
  });

  it('rejects protected ticket endpoints without a session', async () => {
    await request(app.getHttpServer()).get('/tickets').expect(401);
  });

  it('rejects disallowed endpoint roles before reaching ticket policies', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Cannot claim this',
        description: 'Employees cannot claim tickets',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${submitResponse.body.ticketId}/claim`)
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({})
      .expect(403);
  });

  it('does not trust frontend supplied submitter identity', async () => {
    const response = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Tampered owner',
        description: 'The submittedBy field should be ignored',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
        submittedBy: EMPLOYEE_2_ID,
        createdById: EMPLOYEE_2_ID,
        ownerId: EMPLOYEE_2_ID,
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property createdById should not exist',
        'property ownerId should not exist',
      ]),
    );

    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', sessionCookie(EMPLOYEE_ID))
      .send({
        title: 'Ignored submitter',
        description:
          'Only submittedBy is currently tolerated for compatibility',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
        submittedBy: EMPLOYEE_2_ID,
      })
      .expect(201);

    expect(created.body.submittedBy).toBe(EMPLOYEE_ID);
  });

  function sessionCookie(userId: string): string {
    const session = sessionService.createSession(userId, {
      userAgent: 'supertest',
      ip: '127.0.0.1',
    });
    return `${SESSION_COOKIE_NAME}=${session.sessionId}`;
  }
});
