import { UserRole } from '@prisma/client';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { AgentService, type AssistantTurn } from './agent.service';
import {
  AiResponseError,
  type AiProvider,
  type AiProviderResult,
} from '../providers/ai-provider.interface';
import {
  GET_TICKET_BY_NUMBER,
  GET_TICKET_SUBMISSION_OPTIONS,
  type TicketInformationResult,
  type TicketSubmissionOptions,
  ToolRegistryService,
} from '../tools/tool-registry.service';

describe('AgentService', () => {
  let provider: jest.Mocked<Pick<AiProvider, 'generate'>>;
  let tools: jest.Mocked<Pick<ToolRegistryService, 'definitions' | 'execute'>>;
  let service: AgentService;

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

  const submissionOptions: TicketSubmissionOptions = {
    departments: [
      { id: 'department-it', code: 'IT', name: 'Information Technology' },
      { id: 'department-hr', code: 'HR', name: 'Human Resources' },
    ],
    priorities: [
      { id: 'priority-high', code: 'HIGH', name: 'High' },
      { id: 'priority-low', code: 'LOW', name: 'Low' },
    ],
  };

  beforeEach(() => {
    provider = {
      generate: jest.fn<AiProvider['generate']>(),
    };
    tools = {
      definitions: jest.fn<ToolRegistryService['definitions']>(),
      execute: jest.fn<ToolRegistryService['execute']>(),
    };
    tools.definitions.mockReturnValue([]);
    service = new AgentService(
      provider,
      tools as unknown as ToolRegistryService,
    );
  });

  it('returns ordinary structured guidance without exposing prefill tools', async () => {
    provider.generate.mockResolvedValue(
      textResult({
        message: 'Try restarting the network adapter.',
        action: null,
      }),
    );

    await expect(
      service.respond('My laptop cannot connect to Wi-Fi.', actor, []),
    ).resolves.toEqual({
      message: 'Try restarting the network adapter.',
    });

    expect(tools.definitions).toHaveBeenCalledWith({
      includeSubmissionOptions: false,
      includeTicketByNumber: false,
    });
  });

  it('does not reject a submission-options tool call while the model decides confirmation', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message:
            'Would you like me to prefill a submission form with these details?',
          action: null,
        }),
      );

    await expect(
      service.respond(
        'Please prepare the ticket form.',
        actor,
        [
          {
            role: 'assistant',
            content:
              'Would you like me to prefill a submission form with these details?',
          },
        ],
      ),
    ).resolves.toEqual({
      message:
        'Would you like me to prefill a submission form with these details?',
    });

    expect(tools.execute).toHaveBeenCalledWith(
      GET_TICKET_SUBMISSION_OPTIONS,
      {},
      actor,
    );
    expect(tools.definitions).toHaveBeenCalledWith({
      includeSubmissionOptions: true,
      includeTicketByNumber: false,
    });
  });

  it('turns a prefill action without prior context into a confirmation instead of an error', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'I prepared a draft.',
          action: {
            type: 'PREFILL_TICKET',
            data: {
              title: 'Laptop issue',
              description: 'The laptop has a network problem.',
              departmentId: 'HR',
              priority: 'HIGH',
            },
          },
        }),
      );

    await expect(
      service.respond('Prepare a ticket for HR.', actor, []),
    ).resolves.toEqual({
      message:
        'I can prepare that request for your review. Would you like me to prefill a submission form with these details?',
    });
  });

  it('explains when the requested department is unavailable instead of repeating confirmation', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'I cannot prepare this for Administration.',
          action: {
            type: 'PREFILL_TICKET',
            data: {
              title: 'Laptop issue',
              description: 'The laptop has a network problem.',
              departmentId: 'Administration',
              priority: 'HIGH',
            },
          },
        }),
      );

    await expect(
      service.respond('Sure, prepare the same request for Administration.', actor, [
        {
          role: 'assistant',
          content:
            'Would you like me to prefill a submission form with these details for Administration?',
        },
      ]),
    ).resolves.toEqual({
      message:
        'I can’t prepare this for Administration because that department is not available for your account. Available departments are Information Technology (IT), Human Resources (HR). Would you like me to prepare it for one of those instead?',
    });
  });

  it('supports a natural department change when the model returns a validated action', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'I prepared the same request for HR to review.',
          action: {
            type: 'PREFILL_TICKET',
            data: {
              title: 'Laptop Wi-Fi failure',
              description: 'The laptop cannot connect to office Wi-Fi.',
              departmentId: 'HR',
              priority: 'HIGH',
            },
          },
        }),
      );

    await expect(
      service.respond(
        'No, prefill the same information but send it to HR instead.',
        actor,
        [
          {
            role: 'assistant',
            content:
              'Would you like me to prefill a submission form with these details?',
          },
        ],
      ),
    ).resolves.toMatchObject({
      action: {
        type: 'PREFILL_TICKET',
        data: {
          departmentId: 'department-hr',
          priority: 'HIGH',
        },
      },
    });
  });

  it('returns a validated prefill action using product-owned identifiers', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'I prepared a draft for your review.',
          action: {
            type: 'PREFILL_TICKET',
            data: {
              title: 'Laptop Wi-Fi failure',
              description: 'The laptop cannot connect to office Wi-Fi.',
              departmentId: 'IT',
              priority: 'priority-high',
            },
          },
        }),
      );

    const previousTurns: AssistantTurn[] = [
      {
        role: 'assistant',
        content:
          'Would you like me to prefill a submission form with these details?',
      },
    ];

    await expect(
      service.respond('Yes, please.', actor, previousTurns),
    ).resolves.toEqual({
      message: 'I prepared a draft for your review.',
      action: {
        type: 'PREFILL_TICKET',
        data: {
          title: 'Laptop Wi-Fi failure',
          description: 'The laptop cannot connect to office Wi-Fi.',
          departmentId: 'department-it',
          priority: 'HIGH',
        },
      },
    });

    expect(tools.execute).toHaveBeenCalledWith(
      GET_TICKET_SUBMISSION_OPTIONS,
      {},
      actor,
    );
    expect(tools.definitions).toHaveBeenCalledWith({
      includeSubmissionOptions: true,
      includeTicketByNumber: false,
    });
  });

  it('does not fail when a prefill action contains values outside trusted options', async () => {
    tools.execute.mockResolvedValue(submissionOptions);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_SUBMISSION_OPTIONS,
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'Draft ready.',
          action: {
            type: 'PREFILL_TICKET',
            data: {
              title: 'Unknown request',
              description: 'Description',
              departmentId: 'FINANCE',
              priority: 'URGENT',
            },
          },
        }),
      );

    await expect(
      service.respond('Yes, please.', actor, [
        {
          role: 'assistant',
          content:
            'Would you like me to prefill a submission form with these details?',
        },
      ]),
    ).resolves.toEqual({
      message:
        'I can’t prepare this for FINANCE because that department is not available for your account. Available departments are Information Technology (IT), Human Resources (HR). Would you like me to prepare it for one of those instead?',
    });
  });

  it('preserves a readable provider response when structured output is malformed', async () => {
    provider.generate.mockResolvedValue({ type: 'text', text: 'not JSON' });

    await expect(
      service.respond('Give me some help.', actor, []),
    ).resolves.toEqual({ message: 'not JSON' });
  });

  it('limits ticket inspection to one explicitly requested ticket', async () => {
    const inaccessible: TicketInformationResult = {
      accessible: false,
      message:
        "I couldn't access that ticket. Check the ticket number or your permissions.",
    };
    tools.execute.mockResolvedValue(inaccessible);
    provider.generate
      .mockResolvedValueOnce({
        type: 'tool_call',
        calls: [
          {
            id: 'call-1',
            name: GET_TICKET_BY_NUMBER,
            arguments: { ticketNumber: 'TKT-0042' },
          },
        ],
      })
      .mockResolvedValueOnce(
        textResult({
          message: 'I could not access that ticket.',
          action: null,
        }),
      );

    await expect(
      service.respond('What happened to TKT-0042?', actor, []),
    ).resolves.toEqual({ message: 'I could not access that ticket.' });

    expect(tools.definitions).toHaveBeenCalledWith({
      includeSubmissionOptions: false,
      includeTicketByNumber: true,
    });
    expect(tools.execute).toHaveBeenCalledWith(
      GET_TICKET_BY_NUMBER,
      { ticketNumber: 'TKT-0042' },
      actor,
    );
  });

  it('rejects an unbounded tool response', async () => {
    provider.generate.mockResolvedValue({
      type: 'tool_call',
      calls: Array.from({ length: 6 }, (_, index) => ({
        id: `call-${index + 1}`,
        name: GET_TICKET_SUBMISSION_OPTIONS,
        arguments: {},
      })),
    });

    await expect(
      service.respond('Yes, prefill the form.', actor, [
        {
          role: 'assistant',
          content:
            'Would you like me to prefill a submission form with these details?',
        },
      ]),
    ).rejects.toBeInstanceOf(AiResponseError);
    expect(tools.execute).not.toHaveBeenCalled();
  });

  it('refuses a request containing multiple ticket numbers before calling the provider', async () => {
    await expect(
      service.respond('Compare TKT-0042 with TKT-0043.', actor, []),
    ).resolves.toEqual({
      message:
        'I can inspect only one ticket at a time. Please choose one ticket number and ask again.',
    });

    expect(provider.generate).not.toHaveBeenCalled();
  });

  function textResult(value: Record<string, unknown>): AiProviderResult {
    return { type: 'text', text: JSON.stringify(value) };
  }
});
