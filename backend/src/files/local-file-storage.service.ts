import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { FileStorage } from './file-storage.interface';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly rootDirectory = resolve(
    process.env.FILE_UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
  );

  async store(storageKey: string, contents: Buffer): Promise<void> {
    const path = this.resolveStoragePath(storageKey);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, contents, { flag: 'wx' });
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolveStoragePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolveStoragePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveStoragePath(storageKey: string): string {
    if (isAbsolute(storageKey)) {
      throw new Error('Storage keys must be relative');
    }

    const path = resolve(this.rootDirectory, storageKey);
    const pathFromRoot = relative(this.rootDirectory, path);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      throw new Error('Storage key resolves outside the upload directory');
    }

    return path;
  }
}
