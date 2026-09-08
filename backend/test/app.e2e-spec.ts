import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TicketPriority } from '../src/common/enums/ticket-priority.enum';
import { TicketStatus } from '../src/common/enums/ticket-status.enum';

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;

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
});
