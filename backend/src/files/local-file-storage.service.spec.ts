import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { LocalFileStorageService } from './local-file-storage.service';

describe('LocalFileStorageService', () => {
  let rootDirectory: string;
  let storage: LocalFileStorageService;

  beforeEach(async () => {
    rootDirectory = await fs.mkdtemp(join(tmpdir(), 'nexus-file-storage-'));
    const config = {
      get: jest.fn().mockReturnValue(rootDirectory),
    } as unknown as ConfigService;
    storage = new LocalFileStorageService(config);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(rootDirectory, { recursive: true, force: true });
  });

  it('rejects absolute and traversal storage keys as bad requests', async () => {
    await expect(storage.read('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(storage.read('../outside')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(storage.read(rootDirectory)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns a not-found exception when a stored file is missing', async () => {
    await expect(storage.read('missing.txt')).rejects.toThrow(
      'Attachment file was not found',
    );
  });

  it('keeps missing deletes idempotent and missing existence checks false', async () => {
    await expect(storage.delete('missing.txt')).resolves.toBeUndefined();
    await expect(storage.exists('missing.txt')).resolves.toBe(false);
  });

  it('stores and reads files using relative storage keys', async () => {
    const contents = Buffer.from('file contents');

    await storage.store('nested/file.txt', contents);

    await expect(storage.read('nested/file.txt')).resolves.toEqual(contents);
    await expect(storage.exists('nested/file.txt')).resolves.toBe(true);
  });

  it('converts unexpected filesystem failures to a safe internal error', async () => {
    const filesystemError = Object.assign(
      new Error('EACCES: sensitive path details'),
      { code: 'EACCES' },
    );
    jest.spyOn(fs, 'readFile').mockRejectedValue(filesystemError);

    await expect(storage.read('file.txt')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(storage.read('file.txt')).rejects.toThrow(
      'File storage operation failed',
    );
  });
});
