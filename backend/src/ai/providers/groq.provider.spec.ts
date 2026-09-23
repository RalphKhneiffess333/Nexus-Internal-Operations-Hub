import { ConfigService } from '@nestjs/config';
import {
  describe,
  afterEach,
  beforeEach,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  AiProviderError,
  AiResponseError,
  type AiProviderRequest,
} from './ai-provider.interface';
import { GroqProvider } from './groq.provider';

type FetchMock = jest.MockedFunction<typeof fetch>;

describe('GroqProvider', () => {
  let fetchMock: FetchMock;
  let provider: GroqProvider;
  const configValues: Record<string, string | undefined> = {
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'test-model',
    AI_RETRY_DELAY_MS: '1',
  };

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    provider = new GroqProvider(config as unknown as ConfigService);
    fetchMock = jest.spyOn(globalThis, 'fetch') as unknown as FetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a parsed provider response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          { message: { content: '{"message":"Ready.","action":null}' } },
        ],
      }),
    );

    await expect(provider.generate(request())).resolves.toEqual({
      type: 'text',
      text: '{"message":"Ready.","action":null}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('retries transient provider failures and succeeds on a later attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            { message: { content: '{"message":"Recovered.","action":null}' } },
          ],
        }),
      );

    await expect(provider.generate(request())).resolves.toEqual({
      type: 'text',
      text: '{"message":"Recovered.","action":null}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient provider response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 400));

    await expect(provider.generate(request())).rejects.toMatchObject({
      statusCode: 400,
      failureType: 'response',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed provider output as an AI response error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '' } }] }),
    );

    await expect(provider.generate(request())).rejects.toBeInstanceOf(
      AiResponseError,
    );
  });

  it('fails safely when no provider key is configured', async () => {
    configValues.GROQ_API_KEY = undefined;
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const unconfiguredProvider = new GroqProvider(
      config as unknown as ConfigService,
    );

    await expect(
      unconfiguredProvider.generate(request()),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  function request(): AiProviderRequest {
    return {
      systemPrompt: 'You are a test assistant.',
      messages: [{ role: 'user', text: 'Hello.' }],
      tools: [],
    };
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
});
