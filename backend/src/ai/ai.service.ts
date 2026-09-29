import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import {
  AgentService,
  type AssistantResponse,
  type AssistantTurn,
  hasExplicitPrefillRequest,
  hasPendingPrefillOffer,
} from './agent/agent.service';
import { AiProviderError } from './providers/ai-provider.interface';
import { logSystemError } from '../common/logging/system-error.logger';
import {
  SubmissionContextService,
  type TicketSubmissionOptions,
} from './submission-context.service';

const MAX_TURNS = 8;
const MAX_CONVERSATIONS_PER_USER = 20;
const DEFAULT_FALLBACK_MESSAGE =
  'I’m having trouble processing this request right now. Please try again in a moment.';

interface ConversationState {
  turns: AssistantTurn[];
  submissionOptions?: TicketSubmissionOptions;
  lastUsedAt: number;
}

function fallbackAssistantMessage(message: string): string {
  if (
    /\b(?:sad|divorc|grief|heartbroken|overwhelmed|crying|upset|depressed)\b/i.test(
      message,
    )
  ) {
    return 'I’m having trouble processing this request right now. That sounds like a lot to carry at once—conflict with a coworker and the pain of a recent divorce. Please try again in a moment.';
  }

  return DEFAULT_FALLBACK_MESSAGE;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly conversations = new Map<
    string,
    Map<string, ConversationState>
  >();

  constructor(
    private readonly agent: AgentService,
    private readonly submissionContext: SubmissionContextService,
  ) {}

  async respond(
    dto: AssistantMessageDto,
    actor: AuthenticatedRequestUser,
  ): Promise<AssistantResponse & { conversationId: string }> {
    const conversationId = dto.conversationId ?? randomUUID();
    const userConversations: Map<string, ConversationState> =
      this.conversations.get(actor.userId) ??
      new Map<string, ConversationState>();
    const conversation: ConversationState = userConversations.get(
      conversationId,
    ) ?? {
      turns: [],
      lastUsedAt: Date.now(),
    };

    const prefillTurn =
      hasPendingPrefillOffer(conversation.turns) ||
      hasExplicitPrefillRequest(dto.message);
    let submissionOptions = conversation.submissionOptions ?? null;
    const shouldLoadOptions = !conversation.submissionOptions || prefillTurn;

    if (shouldLoadOptions) {
      try {
        submissionOptions = await this.submissionContext.load(actor);
        conversation.submissionOptions = submissionOptions;
      } catch (error) {
        logSystemError(this.logger, error, {
          operation: 'ai.submission-options.load',
          object: { type: 'assistant-conversation', id: conversationId },
          context: { userId: actor.userId, prefillTurn },
        });
        delete conversation.submissionOptions;
        submissionOptions = null;
      }
    }

    let response: AssistantResponse;
    try {
      response = await this.agent.respond(
        dto.message,
        actor,
        conversation.turns,
        submissionOptions,
      );
    } catch (error) {
      logSystemError(this.logger, error, {
        operation: 'ai.respond',
        object: { type: 'assistant-conversation', id: conversationId },
        context: {
          userId: actor.userId,
          ...(error instanceof AiProviderError
            ? {
                providerStatus: error.statusCode ?? 'unknown',
                failureType: error.failureType,
              }
            : {}),
        },
      });
      response = { message: fallbackAssistantMessage(dto.message) };
    }

    conversation.turns.push(
      { role: 'user', content: dto.message },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: response.message,
          action: response.action ?? null,
        }),
      },
    );
    conversation.turns = conversation.turns.slice(-MAX_TURNS * 2);
    conversation.lastUsedAt = Date.now();
    userConversations.set(conversationId, conversation);
    this.conversations.set(actor.userId, userConversations);
    this.pruneConversations(userConversations);
    return { ...response, conversationId };
  }

  private pruneConversations(
    conversations: Map<string, ConversationState>,
  ): void {
    while (conversations.size > MAX_CONVERSATIONS_PER_USER) {
      const oldest = [...conversations.entries()].sort(
        ([, left], [, right]) => left.lastUsedAt - right.lastUsedAt,
      )[0];
      if (!oldest) return;
      conversations.delete(oldest[0]);
    }
  }
}
