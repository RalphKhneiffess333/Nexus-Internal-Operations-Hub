import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { FileStorage, FileStorageEntry } from './file-storage.interface';

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

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolveStoragePath(storageKey));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async list(): Promise<FileStorageEntry[]> {
    if (!(await this.existsDirectory())) return [];
    return this.listDirectory(this.rootDirectory);
  }

  private async existsDirectory(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.rootDirectory);
      return stats.isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  private async listDirectory(directory: string): Promise<FileStorageEntry[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: FileStorageEntry[] = [];

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.listDirectory(absolutePath)));
        continue;
      }
      if (!entry.isFile()) continue;

      const stats = await fs.stat(absolutePath);
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
