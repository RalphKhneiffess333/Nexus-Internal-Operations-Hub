export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiFailureType = 'response' | 'service';

export interface AiToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AiProviderMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text?: string; toolCalls?: AiToolCall[] }
  | {
      role: 'tool';
      name: string;
      response: unknown;
      toolCallId?: string;
    };

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiProviderRequest {
  systemPrompt: string;
  messages: AiProviderMessage[];
  tools: AiToolDefinition[];
}

export type AiProviderResult =
  { type: 'text'; text: string } | { type: 'tool_call'; calls: AiToolCall[] };

export interface AiProvider {
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly statusCode?: number,
    readonly failureType: AiFailureType = 'service',
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiResponseError extends AiProviderError {
  constructor(message: string) {
    super(message, false, 422, 'response');
    this.name = 'AiResponseError';
  }
}
