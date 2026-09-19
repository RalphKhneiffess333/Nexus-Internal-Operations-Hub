import { promises as fs } from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FileStorage, FileStorageEntry } from './file-storage.interface';
import {
  invalidStorageKey,
  throwFileStorageError,
} from './file-storage-errors';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly rootDirectory: string;

  constructor(config: ConfigService) {
    this.rootDirectory = resolve(
      config.get<string>('FILE_UPLOAD_DIR') ?? join(process.cwd(), 'uploads'),
    );
  }

  async store(storageKey: string, contents: Buffer): Promise<void> {
    const path = this.resolveStoragePath(storageKey);
    try {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, contents, { flag: 'wx' });
    } catch (error) {
      throwFileStorageError(error, 'store');
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    const path = this.resolveStoragePath(storageKey);
    try {
      return await fs.readFile(path);
    } catch (error) {
      throwFileStorageError(error, 'read');
    }
  }

  async delete(storageKey: string): Promise<void> {
    const path = this.resolveStoragePath(storageKey);
    try {
      await fs.unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throwFileStorageError(error, 'delete');
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const path = this.resolveStoragePath(storageKey);
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throwFileStorageError(error, 'exists');
    }
  }

  async list(): Promise<FileStorageEntry[]> {
    if (!(await this.existsDirectory())) return [];
    return this.listDirectory(this.rootDirectory);
  }

  private async existsDirectory(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.rootDirectory);
      if (!stats.isDirectory()) {
        throw new Error('The configured file storage root is not a directory');
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throwFileStorageError(error, 'list');
    }
  }

  private async listDirectory(directory: string): Promise<FileStorageEntry[]> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      throwFileStorageError(error, 'list');
    }
    const files: FileStorageEntry[] = [];

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.listDirectory(absolutePath)));
        continue;
      }
      if (!entry.isFile()) continue;

      let stats: Stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch (error) {
        throwFileStorageError(error, 'list');
      }
      files.push({
        storageKey: relative(this.rootDirectory, absolutePath).replaceAll(
          '\\',
          '/',
        ),
        modifiedAt: stats.mtime,
      });
    }

    return files;
  }

  private resolveStoragePath(storageKey: string): string {
    if (
      typeof storageKey !== 'string' ||
      storageKey.length === 0 ||
      storageKey.includes('\0')
    ) {
      throw invalidStorageKey('Storage key must be a non-empty relative path');
    }

    if (isAbsolute(storageKey)) {
      throw invalidStorageKey('Storage key must be a relative path');
    }

    const path = resolve(this.rootDirectory, storageKey);
    const pathFromRoot = relative(this.rootDirectory, path);
    if (
      pathFromRoot.length === 0 ||
      pathFromRoot.startsWith('..') ||
      isAbsolute(pathFromRoot)
    ) {
      throw invalidStorageKey(
        'Storage key must resolve inside the upload directory',
      );
    }

    return path;
  }
}
