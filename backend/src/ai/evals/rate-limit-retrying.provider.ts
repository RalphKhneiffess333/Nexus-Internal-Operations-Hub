import {
  AiProviderError,
  type AiProvider,
  type AiProviderRequest,
  type AiProviderResult,
} from '../providers/ai-provider.interface';

export interface EvalRateLimitRetryOptions {
  maxRetries: number;
  maxWaitMs: number;
  onRetry?: (retry: {
    attempt: number;
    maxRetries: number;
    waitMs: number;
  }) => void;
}

export class EvalRateLimitRetryingProvider implements AiProvider {
  constructor(
    private readonly provider: AiProvider,
    private readonly options: EvalRateLimitRetryOptions,
  ) {}

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    for (let retryCount = 0; ; retryCount += 1) {
      try {
        return await this.provider.generate(request);
      } catch (error) {
        if (
          !(error instanceof AiProviderError) ||
          error.statusCode !== 429 ||
          retryCount >= this.options.maxRetries
        ) {
          throw error;
        }

        const waitMs = error.retryAfterMs ?? this.options.maxWaitMs;
        if (waitMs > this.options.maxWaitMs) {
          throw new AiProviderError(
            `${error.message}; Groq requested a ${formatDuration(waitMs)} wait, which exceeds the eval maximum of ${formatDuration(this.options.maxWaitMs)}`,
            false,
            429,
            error.failureType,
            waitMs,
          );
        }

        const attempt = retryCount + 1;
        this.options.onRetry?.({
          attempt,
          maxRetries: this.options.maxRetries,
          waitMs,
        });
        await delay(waitMs);
      }
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatDuration(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)}s`;
}
