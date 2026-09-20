import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { IdentifierValidationPipe } from './identifier-validation.pipe';

describe('IdentifierValidationPipe', () => {
  const pipe = new IdentifierValidationPipe();
  const metadata = {
    type: 'param' as const,
    data: 'ticketId',
    metatype: String,
  };

  it('trims and returns supported seeded or generated identifiers', () => {
    expect(pipe.transform(' user-agent-1 ', metadata)).toBe('user-agent-1');
    expect(
      pipe.transform('550e8400-e29b-41d4-a716-446655440000', metadata),
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it.each(['', '   ', 'invalid identifier', 'bad/value'])(
    'rejects %j',
    (value) => {
      expect(() => pipe.transform(value, metadata)).toThrow(
        BadRequestException,
      );
    },
  );
});
