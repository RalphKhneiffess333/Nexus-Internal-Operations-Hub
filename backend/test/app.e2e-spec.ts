import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { resetTicketData, seedDatabase } from '../src/database/seed';

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
      .send({
        title: 'Badge access',
        description: 'Need building access',
        priority: TicketPriority.MODERATE,
        departmentId: 'dept-hr',
        submittedBy: 'user-employee-1',
      })
      .expect(201);

    const ticketId = submitResponse.body.ticketId;
    expect(submitResponse.body.status).toBe(TicketStatus.OPEN);

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/claim`)
      .send({ agentId: 'user-agent-1' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.CLAIMED);
      });

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/close`)
      .send({ completionNotes: 'Access granted' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.CLOSED);
        expect(res.body.agentId).toBeNull();
      });

    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/reopen`)
      .send({ description: 'Still cannot enter after hours' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(TicketStatus.REOPENED);
      });
  });

  it('keeps tickets after the application restarts', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .send({
        title: 'Persistent ticket',
        description: 'Must survive a restart',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
        submittedBy: 'user-employee-1',
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
    await app.init();

    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.ticketId).toBe(ticketId);
        expect(res.body.title).toBe('Persistent ticket');
      });
  });

  it('lists active departments over HTTP', async () => {
    const response = await request(app.getHttpServer())
      .get('/departments')
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
      .send({
        title: 'Email issue',
        description: 'Cannot send mail',
        priority: TicketPriority.LOW,
        departmentId: 'dept-it',
        submittedBy: 'user-employee-1',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${submitResponse.body.ticketId}/close`)
      .send({})
      .expect(400);
  });

  it('allows only one concurrent claim to succeed', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/tickets')
      .send({
        title: 'Concurrent claim',
        description: 'Two agents try to claim at once',
        priority: TicketPriority.HIGH,
        departmentId: 'dept-it',
        submittedBy: 'user-employee-1',
      })
      .expect(201);

    const ticketId = submitResponse.body.ticketId as string;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/tickets/${ticketId}/claim`)
        .send({ agentId: 'user-agent-1' }),
      request(app.getHttpServer())
        .post(`/tickets/${ticketId}/claim`)
        .send({ agentId: 'user-agent-2' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    const winner = first.status === 201 ? first.body : second.body;
    const stored = await prisma.ticket.findUnique({ where: { ticketId } });
    expect(stored?.status).toBe(TicketStatus.CLAIMED);
    expect(stored?.agentId).toBe(winner.agentId);
  });
});
