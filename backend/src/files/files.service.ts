import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FileStorage } from './file-storage.interface';
import { FILE_STORAGE } from './file-storage.interface';
import {
  UploadedFileInput,
  validateUploadedFiles,
} from './file-validation';
import { StoredFileMetadata } from './file-attachments.repository';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async storeForUser(
    files: UploadedFileInput[] | undefined,
    uploadedBy: string,
  ): Promise<StoredFileMetadata[]> {
    const validatedFiles = validateUploadedFiles(files);
    const stored: StoredFileMetadata[] = [];

    try {
      for (const file of validatedFiles) {
        const originalName = this.safeOriginalName(file.originalname);
        const metadata: StoredFileMetadata = {
          originalName,
          storageKey: randomUUID(),
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy,
        };
        await this.storage.store(metadata.storageKey, file.buffer);
        stored.push(metadata);
      }
      return stored;
    } catch (error) {
      await this.cleanup(stored);
      throw error;
    }
  }

  async cleanup(files: StoredFileMetadata[]): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        try {
          await this.storage.delete(file.storageKey);
        } catch (error) {
          this.logger.error(
            `Unable to clean up stored upload ${file.storageKey}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }

  read(storageKey: string): Promise<Buffer> {
    return this.storage.read(storageKey);
  }

  private safeOriginalName(originalName: string): string {
    const basename = originalName.replace(/\\/g, '/').split('/').pop() ?? '';
    const cleaned = Array.from(basename)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('');
    return cleaned.slice(0, 255) || 'download';
  }
}
