import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('keeps omitted optional settings so feature defaults remain in effect', () => {
    expect(validateEnvironment({})).toEqual({});
  });

  it('rejects invalid numeric, boolean, and URL settings at startup', () => {
    expect(() => validateEnvironment({ PORT: '0' })).toThrow(
      BadRequestException,
    );
    expect(() => validateEnvironment({ SMTP_ENABLED: 'sometimes' })).toThrow(
      BadRequestException,
    );
    expect(() => validateEnvironment({ FRONTEND_URL: 'not-a-url' })).toThrow(
      BadRequestException,
    );
  });
});
