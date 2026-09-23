import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';
import {
  AI_PROVIDER,
  AiResponseError,
  type AiProvider,
  type AiProviderMessage,
} from '../providers/ai-provider.interface';
import {
  GET_TICKET_BY_NUMBER,
  GET_TICKET_SUBMISSION_OPTIONS,
  type TicketInformationResult,
  type TicketSubmissionOptions,
  ToolRegistryService,
} from '../tools/tool-registry.service';
import { NEXUS_GENERAL_ASSISTANT_SYSTEM_PROMPT } from './system-prompt';

const MAX_TOOL_CALLS = 5;
const MAX_ASSISTANT_MESSAGE_LENGTH = 6000;
const MAX_PREFILL_TITLE_LENGTH = 200;
const MAX_PREFILL_DESCRIPTION_LENGTH = 10000;

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  message: string;
  action?: {
    type: 'PREFILL_TICKET';
    data: {
      title: string;
      description: string;
      departmentId: string;
      priority: string;
    };
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fence = String.fromCharCode(96).repeat(3);
  const trimmed = text
    .trim()
    .replace(new RegExp('^' + fence + '(?:json)?\\s*', 'i'), '')
    .replace(new RegExp('\\s*' + fence + '$'), '');
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? sanitizePlainText(value) : '';
}

function toAssistantHistoryContent(content: string): string {
  const parsed = parseJsonObject(content);
  if (parsed && typeof parsed.message === 'string') return content;
  return JSON.stringify({ message: content, action: null });
}

function assistantMessageText(content: string): string {
  const parsed = parseJsonObject(content);
  return parsed && typeof parsed.message === 'string'
    ? parsed.message
    : content;
}

function isPrefillOffer(content: string): boolean {
  const message = assistantMessageText(content);
  const mentionsPrefill =
    /\b(?:pre[- ]?fill|fill (?:in|out)|submission form|ticket draft)\b/i.test(
      message,
    );
  const offersNextStep =
    /\b(?:would you like|do you want|shall i|can help|i can|please confirm|once you confirm|ready to prepare|prepare .*form)\b/i.test(
      message,
    );
  return mentionsPrefill && offersNextStep;
}

function hasPrefillConfirmation(message: string): boolean {
  return (
    /^(?:yes|yeah|yep|sure|okay|ok|please|go ahead|do it)\b/i.test(
      message.trim(),
    ) ||
    /\b(?:prefill|fill (?:in|out))\b.*\b(?:form|submission)\b/i.test(message)
  );
}

function hasPrefillPermission(turns: AssistantTurn[], message: string): boolean {
  const offerIndex = [...turns]
    .map((turn, index) => ({ turn, index }))
    .reverse()
    .find(
      ({ turn }) =>
        turn.role === 'assistant' && isPrefillOffer(turn.content),
    )?.index;

  if (offerIndex === undefined) return false;
  if (hasPrefillConfirmation(message)) return true;

  return turns
    .slice(offerIndex + 1)
    .some(
      (turn) =>
        turn.role === 'user' && hasPrefillConfirmation(turn.content),
    );
}

function extractTicketNumbers(message: string): string[] {
  return [
    ...new Set(
      [...message.matchAll(/\bTKT-\d{4,}\b/gi)].map((match) =>
        match[0].toUpperCase(),
      ),
    ),
  ];
}

function latestTicketNumber(turns: AssistantTurn[]): string | null {
  for (const turn of [...turns].reverse()) {
    if (turn.role !== 'user') continue;
    const numbers = extractTicketNumbers(turn.content);
    if (numbers.length === 1) return numbers[0];
  }
  return null;
}

function hasTicketLookupContext(
  turns: AssistantTurn[],
  message: string,
): boolean {
  return (
    extractTicketNumbers(message).length === 1 ||
    latestTicketNumber(turns) !== null
  );
}

function readTicketNumberArgument(args: Record<string, unknown>): string {
  if (
    Object.keys(args).length !== 1 ||
    typeof args.ticketNumber !== 'string'
  ) {
    return '';
  }
  const ticketNumber = args.ticketNumber.trim().toUpperCase();
  return /^TKT-\d{4,}$/.test(ticketNumber) ? ticketNumber : '';
}

function isTicketSubmissionOptions(
  value: TicketSubmissionOptions | TicketInformationResult,
): value is TicketSubmissionOptions {
  return 'departments' in value && 'priorities' in value;
}

@Injectable()
export class AgentService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly tools: ToolRegistryService,
  ) {}

  async respond(
    message: string,
    actor: AuthenticatedRequestUser,
    previousTurns: AssistantTurn[],
  ): Promise<AssistantResponse> {
    const requestedTicketNumbers = extractTicketNumbers(message);
    if (requestedTicketNumbers.length > 1) {
      return {
        message:
          'I can inspect only one ticket at a time. Please choose one ticket number and ask again.',
      };
    }

    const prefillPermissionGranted = hasPrefillPermission(
      previousTurns,
      message,
    );
    const ticketLookupRequested = hasTicketLookupContext(
      previousTurns,
      message,
    );
    const expectedTicketNumber =
      requestedTicketNumbers[0] ?? latestTicketNumber(previousTurns);
    const messages: AiProviderMessage[] = previousTurns.map((turn) => ({
      role: turn.role,
      text:
        turn.role === 'assistant'
          ? toAssistantHistoryContent(turn.content)
          : turn.content,
    }));
    messages.push({ role: 'user', text: message });

    let toolCallCount = 0;
    let ticketLookupCount = 0;
    let options: TicketSubmissionOptions | null = null;
    const toolDefinitions = this.tools.definitions({
      includeSubmissionOptions: prefillPermissionGranted,
      includeTicketByNumber: ticketLookupRequested,
    });

    for (;;) {
      const result = await this.provider.generate({
        systemPrompt: NEXUS_GENERAL_ASSISTANT_SYSTEM_PROMPT,
        messages,
        tools: toolCallCount === 0 ? toolDefinitions : [],
      });

      if (result.type === 'text') {
        return this.normalizeResponse(
          result.text,
          options,
          prefillPermissionGranted,
        );
      }

      if (result.calls.length === 0) {
        throw new AiResponseError('AI returned an empty tool request');
      }
      toolCallCount += result.calls.length;
      if (toolCallCount > MAX_TOOL_CALLS) {
        throw new AiResponseError('AI tool-call limit exceeded');
      }

      messages.push({ role: 'assistant', toolCalls: result.calls });
      for (const call of result.calls) {
        if (call.name === GET_TICKET_SUBMISSION_OPTIONS) {
          if (!prefillPermissionGranted) {
            throw new AiResponseError('AI tool request was rejected');
          }
          if (Object.keys(call.arguments).length > 0) {
            throw new AiResponseError('AI tool request was rejected');
          }
          const toolResult = await this.tools.execute(
            call.name,
            call.arguments,
            actor,
          );
          if (!isTicketSubmissionOptions(toolResult)) {
            throw new AiResponseError('AI returned an invalid tool result');
          }
          options = toolResult;
          messages.push({
            role: 'tool',
            name: call.name,
            response: toolResult,
            toolCallId: call.id,
          });
          continue;
        }

        if (call.name === GET_TICKET_BY_NUMBER) {
          if (!ticketLookupRequested) {
            throw new AiResponseError('AI tool request was rejected');
          }

          let toolResult: TicketInformationResult;
          const requestedTicketNumber = readTicketNumberArgument(
            call.arguments,
          );
          if (ticketLookupCount > 0) {
            toolResult = {
              accessible: false,
              message:
                'I can inspect only one ticket at a time. Please choose one ticket number.',
            };
          } else if (
            !requestedTicketNumber ||
            requestedTicketNumber !== expectedTicketNumber
          ) {
            toolResult = {
              accessible: false,
              message:
                'I can inspect only the ticket number provided in the user request.',
            };
          } else {
            ticketLookupCount += 1;
            const result = await this.tools.execute(
              call.name,
              { ticketNumber: requestedTicketNumber },
              actor,
            );
            if (isTicketSubmissionOptions(result)) {
              throw new AiResponseError('AI returned an invalid tool result');
            }
            toolResult = result;
          }

          messages.push({
            role: 'tool',
            name: call.name,
            response: toolResult,
            toolCallId: call.id,
          });
          continue;
        }

        throw new AiResponseError('Unknown AI tool requested');
      }
    }
  }

  private normalizeResponse(
    rawText: string,
    options: TicketSubmissionOptions | null,
    prefillPermissionGranted: boolean,
  ): AssistantResponse {
    const parsed = parseJsonObject(rawText);
    if (!parsed || typeof parsed.message !== 'string') {
      throw new AiResponseError('AI returned an invalid response message');
    }
    const message = readString(parsed.message);
    if (!message) {
      throw new AiResponseError('AI returned an empty response message');
    }
    const response: AssistantResponse = {
      message: message.slice(0, MAX_ASSISTANT_MESSAGE_LENGTH),
    };

    const action = parsed?.action;
    if (action === null || action === undefined) return response;
    if (!this.isPrefillAction(action)) {
      throw new AiResponseError('AI returned an invalid ticket action');
    }
    if (!options || !prefillPermissionGranted) {
      throw new AiResponseError('AI returned an unexpected ticket action');
    }

    const data = action.data;
    const title = readString(data.title).slice(0, MAX_PREFILL_TITLE_LENGTH);
    const description = readString(data.description).slice(
      0,
      MAX_PREFILL_DESCRIPTION_LENGTH,
    );
    const departmentId = this.resolveDepartmentId(
      readString(data.departmentId),
      options,
    );
    const priority = this.resolvePriorityCode(
      readString(data.priority) || readString(data.priorityId),
      options,
    );

    if (!title || !description || !departmentId || !priority) {
      throw new AiResponseError('AI returned incomplete ticket data');
    }

    return {
      ...response,
      action: {
        type: 'PREFILL_TICKET',
        data: { title, description, departmentId, priority },
      },
    };
  }

  private isPrefillAction(
    value: unknown,
  ): value is { type: 'PREFILL_TICKET'; data: Record<string, unknown> } {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const action = value as Record<string, unknown>;
    return (
      action.type === 'PREFILL_TICKET' &&
      typeof action.data === 'object' &&
      action.data !== null &&
      !Array.isArray(action.data)
    );
  }

  private resolveDepartmentId(
    value: string,
    options: TicketSubmissionOptions,
  ): string {
    return (
      options.departments.find(
        (item) => item.id === value || item.code === value,
      )?.id ?? ''
    );
  }

  private resolvePriorityCode(
    value: string,
    options: TicketSubmissionOptions,
  ): string {
    return (
      options.priorities.find(
        (item) => item.code === value || item.id === value,
      )?.code ?? ''
    );
  }
}
