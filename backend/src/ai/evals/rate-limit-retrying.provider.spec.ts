import { describe, expect, it, jest } from '@jest/globals';
import {
  AiProviderError,
  type AiProvider,
  type AiProviderRequest,
} from '../providers/ai-provider.interface';
import { EvalRateLimitRetryingProvider } from './rate-limit-retrying.provider';

describe('EvalRateLimitRetryingProvider', () => {
  const request: AiProviderRequest = {
    systemPrompt: 'Test prompt',
    messages: [{ role: 'user', text: 'Hello.' }],
    tools: [],
  };

  it('waits for retry-after and retries a rate-limited request', async () => {
    const generate = jest
      .fn<AiProvider['generate']>()
      .mockRejectedValueOnce(
        new AiProviderError(
          'Groq request rate limit exceeded',
          false,
          429,
          'service',
          0,
        ),
      )
      .mockResolvedValueOnce({ type: 'text', text: 'Recovered.' });
    const onRetry = jest.fn();
    const provider = new EvalRateLimitRetryingProvider(
      { generate },
      {
        maxRetries: 3,
        maxWaitMs: 60_000,
        onRetry,
      },
    );

    await expect(provider.generate(request)).resolves.toEqual({
      type: 'text',
      text: 'Recovered.',
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      maxRetries: 3,
      waitMs: 0,
    });
  });

  it('does not retry a non-rate-limit provider error', async () => {
    const generate = jest
      .fn<AiProvider['generate']>()
      .mockRejectedValue(new AiProviderError('invalid request', false, 400));
    const provider = new EvalRateLimitRetryingProvider(
      { generate },
      {
        maxRetries: 3,
        maxWaitMs: 60_000,
      },
    );

    await expect(provider.generate(request)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not wait beyond the configured eval maximum', async () => {
    const generate = jest
      .fn<AiProvider['generate']>()
      .mockRejectedValue(
        new AiProviderError(
          'Groq request rate limit exceeded',
          false,
          429,
          'service',
          61_000,
        ),
      );
    const provider = new EvalRateLimitRetryingProvider(
      { generate },
      {
        maxRetries: 3,
        maxWaitMs: 60_000,
      },
    );

    await expect(provider.generate(request)).rejects.toThrow(
      'exceeds the eval maximum of 60s',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
