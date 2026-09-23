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
  GET_TICKET_SUBMISSION_OPTIONS,
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
    const prefillPermissionGranted = hasPrefillPermission(
      previousTurns,
      message,
    );
    const messages: AiProviderMessage[] = previousTurns.map((turn) => ({
      role: turn.role,
      text:
        turn.role === 'assistant'
          ? toAssistantHistoryContent(turn.content)
          : turn.content,
    }));
    messages.push({ role: 'user', text: message });

    let toolCallCount = 0;
    let options: TicketSubmissionOptions | null = null;

    for (;;) {
      const result = await this.provider.generate({
        systemPrompt: NEXUS_GENERAL_ASSISTANT_SYSTEM_PROMPT,
        messages,
        tools:
          prefillPermissionGranted && toolCallCount === 0
            ? this.tools.definitions()
            : [],
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
        if (call.name !== GET_TICKET_SUBMISSION_OPTIONS) {
          throw new AiResponseError('Unknown AI tool requested');
        }
        if (Object.keys(call.arguments).length > 0) {
          throw new AiResponseError('AI tool request was rejected');
        }
        const toolResult = await this.tools.execute(
          call.name,
          call.arguments,
          actor,
        );
        options = toolResult;
        messages.push({
          role: 'tool',
          name: call.name,
          response: toolResult,
          toolCallId: call.id,
        });
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
