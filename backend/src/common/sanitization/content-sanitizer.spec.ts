import { describe, expect, it } from '@jest/globals';
import { sanitizePlainText } from './content-sanitizer';

describe('sanitizePlainText', () => {
  it('removes HTML markup, comments, and control characters while preserving text', () => {
    expect(
      sanitizePlainText('  Hello <strong>world</strong><!-- hidden -->\u0000!  '),
    ).toBe('Hello world!');
  });
});
