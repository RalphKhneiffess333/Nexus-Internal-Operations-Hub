import { HttpStatus } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AiService } from './ai.service';
import {
  AiProviderError,
  AiResponseError,
} from './providers/ai-provider.interface';
import { AgentService, type AssistantResponse } from './agent/agent.service';

describe('AiService', () => {
  let agent: jest.Mocked<Pick<AgentService, 'respond'>>;
  let service: AiService;

  const actor: AuthenticatedRequestUser = {
    userId: 'user-1',
    email: 'employee@example.com',
    fullName: 'Employee One',
    phoneNumber: null,
    role: UserRole.Employee,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'idp-1',
    identityProviderUserId: 'external-user-1',
  };

  beforeEach(() => {
    agent = {
      respond: jest.fn<AgentService['respond']>(),
    };
    service = new AiService(agent as unknown as AgentService);
  });

  it('creates and preserves conversation context for the same user', async () => {
    const receivedTurns: Array<unknown[]> = [];
    agent.respond
      .mockImplementationOnce((_message, _actor, turns) => {
        receivedTurns.push(turns.map((turn) => ({ ...turn })));
        return Promise.resolve({ message: 'First answer.' });
      })
      .mockImplementationOnce((_message, _actor, turns) => {
        receivedTurns.push(turns.map((turn) => ({ ...turn })));
        return Promise.resolve({ message: 'Second answer.' });
      });

    const first = await service.respond({ message: 'First question.' }, actor);
    await service.respond(
      { message: 'Follow-up question.', conversationId: first.conversationId },
      actor,
    );

    expect(receivedTurns).toEqual([
      [],
      [
        { role: 'user', content: 'First question.' },
        {
          role: 'assistant',
          content: JSON.stringify({ message: 'First answer.', action: null }),
        },
      ],
    ]);
  });

  it('does not share a conversation id between users', async () => {
    const receivedTurns: Array<unknown[]> = [];
    agent.respond
      .mockImplementationOnce((_message, _actor, turns) => {
        receivedTurns.push(turns.map((turn) => ({ ...turn })));
        return Promise.resolve({ message: 'Private answer.' });
      })
      .mockImplementationOnce((_message, _actor, turns) => {
        receivedTurns.push(turns.map((turn) => ({ ...turn })));
        return Promise.resolve({ message: 'Other answer.' });
      });
    const otherActor = { ...actor, userId: 'user-2' };

    const first = await service.respond(
      { message: 'Private question.' },
      actor,
    );
    await service.respond(
      {
        message: 'Question from another user.',
        conversationId: first.conversationId,
      },
      otherActor,
    );

    expect(receivedTurns).toEqual([[], []]);
  });

  it('maps provider rate limits to a controlled 429 response', async () => {
    agent.respond.mockRejectedValue(
      new AiProviderError('rate limited', false, HttpStatus.TOO_MANY_REQUESTS),
    );

    await expect(
      service.respond({ message: 'Hello.' }, actor),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('maps invalid provider output to a controlled 422 response', async () => {
    agent.respond.mockRejectedValue(new AiResponseError('invalid JSON'));

    await expect(
      service.respond({ message: 'Hello.' }, actor),
    ).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('maps provider availability failures to a controlled 503 response', async () => {
    agent.respond.mockRejectedValue(
      new AiProviderError('provider unavailable', true),
    );

    await expect(
      service.respond({ message: 'Hello.' }, actor),
    ).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('returns the agent response together with its conversation id', async () => {
    const response: AssistantResponse = {
      message: 'Draft ready.',
      action: {
        type: 'PREFILL_TICKET',
        data: {
          title: 'Wi-Fi issue',
          description: 'Cannot connect.',
          departmentId: 'department-it',
          priority: 'MODERATE',
        },
      },
    };
    agent.respond.mockResolvedValue(response);

    await expect(
      service.respond(
        { message: 'Yes, prefill it.', conversationId: 'conversation-1' },
        actor,
      ),
    ).resolves.toEqual({ ...response, conversationId: 'conversation-1' });
  });
});
