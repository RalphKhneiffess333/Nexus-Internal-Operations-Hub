import { UserRole } from '@prisma/client';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AiService } from './ai.service';
import { AiProviderError } from './providers/ai-provider.interface';
import { AgentService, type AssistantResponse } from './agent/agent.service';
import {
  SubmissionContextService,
  type TicketSubmissionOptions,
} from './submission-context.service';

describe('AiService', () => {
  let agent: jest.Mocked<Pick<AgentService, 'respond'>>;
  let submissionContext: jest.Mocked<Pick<SubmissionContextService, 'load'>>;
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
    submissionContext = {
      load: jest.fn<SubmissionContextService['load']>(),
    };
    submissionContext.load.mockResolvedValue({
      departments: [
        { id: 'department-it', code: 'IT', name: 'Information Technology' },
      ],
      priorities: [{ id: 'priority-high', code: 'HIGH', name: 'High' }],
    });
    service = new AiService(
      agent as unknown as AgentService,
      submissionContext as unknown as SubmissionContextService,
    );
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
    expect(submissionContext.load).toHaveBeenCalledTimes(1);
    expect(agent.respond).toHaveBeenNthCalledWith(
      1,
      'First question.',
      actor,
      expect.any(Array),
      expect.objectContaining({
        departments: expect.any(Array),
        priorities: expect.any(Array),
      }),
    );
  });

  it('refreshes submission options before a prefill turn', async () => {
    const firstOptions: TicketSubmissionOptions = {
      departments: [
        { id: 'department-it', code: 'IT', name: 'Information Technology' },
      ],
      priorities: [{ id: 'priority-low', code: 'LOW', name: 'Low' }],
    };
    const refreshedOptions: TicketSubmissionOptions = {
      departments: [
        { id: 'department-hr', code: 'HR', name: 'Human Resources' },
      ],
      priorities: [{ id: 'priority-high', code: 'HIGH', name: 'High' }],
    };
    submissionContext.load
      .mockResolvedValueOnce(firstOptions)
      .mockResolvedValueOnce(refreshedOptions);
    agent.respond
      .mockResolvedValueOnce({
        message:
          'Would you like me to prefill a submission form with these details?',
      })
      .mockResolvedValueOnce({ message: 'I prepared a draft.' });

    const first = await service.respond({ message: 'I need help.' }, actor);
    await service.respond(
      { message: 'Yes, please.', conversationId: first.conversationId },
      actor,
    );

    expect(submissionContext.load).toHaveBeenCalledTimes(2);
    expect(agent.respond).toHaveBeenNthCalledWith(
      2,
      'Yes, please.',
      actor,
      expect.any(Array),
      refreshedOptions,
    );
  });

  it('refreshes submission options before a direct ticket request', async () => {
    const firstOptions: TicketSubmissionOptions = {
      departments: [
        { id: 'department-it', code: 'IT', name: 'Information Technology' },
      ],
      priorities: [{ id: 'priority-low', code: 'LOW', name: 'Low' }],
    };
    const refreshedOptions: TicketSubmissionOptions = {
      departments: [
        { id: 'department-hr', code: 'HR', name: 'Human Resources' },
      ],
      priorities: [{ id: 'priority-high', code: 'HIGH', name: 'High' }],
    };
    submissionContext.load
      .mockResolvedValueOnce(firstOptions)
      .mockResolvedValueOnce(refreshedOptions);
    agent.respond
      .mockResolvedValueOnce({ message: 'I can help with that issue.' })
      .mockResolvedValueOnce({ message: 'I prepared a draft.' });

    const first = await service.respond(
      { message: 'My laptop has a network problem.' },
      actor,
    );
    await service.respond(
      {
        message: 'Please prepare a ticket for this issue.',
        conversationId: first.conversationId,
      },
      actor,
    );

    expect(submissionContext.load).toHaveBeenCalledTimes(2);
    expect(agent.respond).toHaveBeenNthCalledWith(
      2,
      'Please prepare a ticket for this issue.',
      actor,
      expect.any(Array),
      refreshedOptions,
    );
  });

  it('continues without options when loading fails and retries on a later turn', async () => {
    const options: TicketSubmissionOptions = {
      departments: [
        { id: 'department-it', code: 'IT', name: 'Information Technology' },
      ],
      priorities: [{ id: 'priority-high', code: 'HIGH', name: 'High' }],
    };
    submissionContext.load
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(options);
    agent.respond.mockResolvedValue({ message: 'General guidance.' });

    const first = await service.respond({ message: 'Hello.' }, actor);
    await service.respond(
      { message: 'Can you help?', conversationId: first.conversationId },
      actor,
    );

    expect(agent.respond).toHaveBeenNthCalledWith(
      1,
      'Hello.',
      actor,
      expect.any(Array),
      null,
    );
    expect(agent.respond).toHaveBeenNthCalledWith(
      2,
      'Can you help?',
      actor,
      expect.any(Array),
      options,
    );
    expect(submissionContext.load).toHaveBeenCalledTimes(2);
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

  it('returns an assistant fallback when the provider is rate limited', async () => {
    agent.respond.mockRejectedValue(
      new AiProviderError('rate limited', false, 429),
    );

    await expect(
      service.respond({ message: 'Hello.' }, actor),
    ).resolves.toMatchObject({
      message:
        'I’m here to help. Tell me what feels most urgent, and we can work through it one small step at a time.',
    });
  });

  it('returns an empathetic assistant fallback for personal distress', async () => {
    agent.respond.mockRejectedValue(
      new AiProviderError('invalid JSON', false, 422, 'response'),
    );

    await expect(
      service.respond(
        {
          message:
            'im so sad my coworker is mad at me because i ruined her work and i just divorced',
        },
        actor,
      ),
    ).resolves.toMatchObject({
      message: expect.stringContaining('That sounds like a lot to carry'),
    });
  });

  it('returns an assistant fallback when the provider is unavailable', async () => {
    agent.respond.mockRejectedValue(
      new AiProviderError('provider unavailable', true),
    );

    await expect(
      service.respond({ message: 'Hello.' }, actor),
    ).resolves.toMatchObject({
      message:
        'I’m here to help. Tell me what feels most urgent, and we can work through it one small step at a time.',
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
