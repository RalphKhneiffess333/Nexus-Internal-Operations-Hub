import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  AiResponseError,
} from './providers/ai-provider.interface';

const MAX_TURNS = 8;
const MAX_CONVERSATIONS_PER_USER = 20;

interface ConversationState {
  turns: AssistantTurn[];
  lastUsedAt: number;
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

    try {
      const response = await this.agent.respond(
        dto.message,
        actor,
        conversation.turns,
      );
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
    } catch (error) {
      if (error instanceof AiProviderError) {
        this.logger.warn('AI request was unavailable: ' + error.message);
        if (error.statusCode === 429) {
          throw new HttpException(
            'The assistant has reached its AI request limit. Please try again shortly.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (
          error instanceof AiResponseError ||
          error.failureType === 'response'
        ) {
          throw new HttpException(
            'I’m having difficulty processing the request. Please try again.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
      throw new ServiceUnavailableException(
        'The assistant is temporarily unavailable. Please try again.',
      );
    }
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
