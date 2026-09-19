import { describe, expect, it } from '@jest/globals';
import { validateUploadedFiles } from './file-validation';

describe('validateUploadedFiles', () => {
  it.each([
    ['notes.md', 'text/markdown'],
    ['notes.md', 'text/plain'],
    ['image.avif', 'image/avif'],
    ['archive.7z', 'application/x-7z-compressed'],
    ['recording.webm', 'video/webm'],
  ])('accepts %s with MIME type %s', (originalname, mimetype) => {
    expect(
      validateUploadedFiles([
        { originalname, mimetype, size: 1, buffer: Buffer.from('x') },
      ]),
    ).toHaveLength(1);
  });

  it('continues rejecting executable uploads', () => {
    expect(() =>
      validateUploadedFiles([
        {
          originalname: 'installer.exe',
          mimetype: 'application/octet-stream',
          size: 1,
          buffer: Buffer.from('x'),
        },
      ]),
    ).toThrow('not an allowed file type');
  });
});
