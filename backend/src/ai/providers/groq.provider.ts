import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProviderError,
  AiResponseError,
  type AiProvider,
  type AiProviderMessage,
  type AiProviderRequest,
  type AiProviderResult,
  type AiToolCall,
} from './ai-provider.interface';

const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, key: string): JsonRecord | undefined {
  const record = isRecord(value) ? value[key] : undefined;
  return isRecord(record) ? record : undefined;
}

function readArray(value: unknown, key: string): unknown[] {
  const result = isRecord(value) ? value[key] : undefined;
  return Array.isArray(result) ? result : [];
}

function toGroqMessages(
  systemPrompt: string,
  messages: AiProviderMessage[],
): JsonRecord[] {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.map((message) => {
      if (message.role === 'user') {
        return { role: 'user', content: message.text };
      }

      if (message.role === 'assistant') {
        const toolCalls = (message.toolCalls ?? []).map((toolCall, index) => ({
          id: toolCall.id ?? `tool-call-${index}`,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        }));
        return {
          role: 'assistant',
          content: message.text ?? null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        };
      }

      return {
        role: 'tool',
        tool_call_id: message.toolCallId ?? message.name,
        content: JSON.stringify(message.response),
      };
    }),
  ];
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') {
    throw new AiResponseError('Groq returned invalid tool arguments');
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isRecord(parsed)) return parsed;
  } catch {
    // Fall through to the provider error below.
  }
  throw new AiResponseError('Groq returned invalid tool arguments');
}

function parseProviderResult(payload: unknown): AiProviderResult {
  const choice = readArray(payload, 'choices')[0];
  const message = readRecord(choice, 'message');
  const toolCalls = readArray(message, 'tool_calls');
  const calls: AiToolCall[] = [];

  for (const item of toolCalls) {
    const toolCall = isRecord(item) ? item : undefined;
    const functionData = readRecord(toolCall, 'function');
    if (!functionData || typeof functionData.name !== 'string') {
      throw new AiResponseError('Groq returned an invalid tool call');
    }
    const id = typeof toolCall?.id === 'string' ? toolCall.id : undefined;
    calls.push({
      ...(id ? { id } : {}),
      name: functionData.name,
      arguments: parseToolArguments(functionData.arguments),
    });
  }

  if (calls.length > 0) return { type: 'tool_call', calls };

  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiResponseError('Groq returned an empty response');
  }
  return { type: 'text', text: content.trim() };
}

@Injectable()
export class GroqProvider implements AiProvider {
  private readonly logger = new Logger(GroqProvider.name);
  private readonly model: string;
  private readonly retryDelayMs: number;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('GROQ_MODEL')?.trim() || DEFAULT_MODEL;
    this.retryDelayMs = this.readPositiveInteger(
      'AI_RETRY_DELAY_MS',
      DEFAULT_RETRY_DELAY_MS,
    );
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const apiKey = this.config.get<string>('GROQ_API_KEY')?.trim();
    if (!apiKey) {
      throw new AiProviderError('Groq is not configured');
    }

    const tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    const body = {
      model: this.model,
      messages: toGroqMessages(request.systemPrompt, request.messages),
      temperature: 0.2,
      reasoning_format: 'hidden',
      ...(tools.length > 0
        ? { tools }
        : { response_format: { type: 'json_object' } }),
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) {
          if (response.status === 429) {
            throw new AiProviderError(
              'Groq request rate limit exceeded',
              false,
              429,
            );
          }
          const retryable = response.status === 408 || response.status >= 500;
          if (retryable && attempt < MAX_ATTEMPTS) {
            await this.delay(attempt);
            continue;
          }
          throw new AiProviderError(
            'Groq request failed with status ' + response.status,
            retryable,
            response.status,
            retryable ? 'service' : 'response',
          );
        }

        return parseProviderResult(await response.json());
      } catch (error) {
        if (error instanceof AiProviderError && !error.retryable) throw error;
        if (attempt >= MAX_ATTEMPTS) {
          this.logger.warn('Groq request failed after retries');
          throw new AiProviderError('Groq is temporarily unavailable', true);
        }
        await this.delay(attempt);
      }
    }

    throw new AiProviderError('Groq is temporarily unavailable', true);
  }

  private async delay(attempt: number): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.retryDelayMs * 2 ** (attempt - 1)),
    );
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
