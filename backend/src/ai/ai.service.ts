import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import {
  AgentService,
  type AssistantResponse,
  type AssistantTurn,
} from './agent/agent.service';
import {
  AiProviderError,
} from './providers/ai-provider.interface';

const MAX_TURNS = 8;
const MAX_CONVERSATIONS_PER_USER = 20;

interface ConversationState {
  turns: AssistantTurn[];
  lastUsedAt: number;
}

function fallbackAssistantMessage(message: string): string {
  if (
    /\b(?:sad|divorc|grief|heartbroken|overwhelmed|crying|upset|depressed)\b/i.test(
      message,
    )
  ) {
    return 'That sounds like a lot to carry at once—conflict with a coworker and the pain of a recent divorce. We can take this one step at a time. Would you like help drafting an honest message to your coworker, or would you rather talk about how you are feeling first?';
  }

  return 'I’m here to help. Tell me what feels most urgent, and we can work through it one small step at a time.';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly conversations = new Map<
    string,
    Map<string, ConversationState>
  >();

  constructor(private readonly agent: AgentService) {}

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

    let response: AssistantResponse;
    try {
      response = await this.agent.respond(
        dto.message,
        actor,
        conversation.turns,
      );
    } catch (error) {
      if (error instanceof AiProviderError) {
        this.logger.warn(
          `AI request failed [status=${error.statusCode ?? 'unknown'}, failure=${error.failureType}]: ${error.message}`,
        );
      } else {
        this.logger.error(
          'AI request failed unexpectedly',
          error instanceof Error ? error.stack : String(error),
        );
      }
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
