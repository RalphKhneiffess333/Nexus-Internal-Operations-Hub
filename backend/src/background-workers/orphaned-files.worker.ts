import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../files/file-storage.interface';

@Injectable()
export class OrphanedFilesWorker {
  private readonly logger = new Logger(OrphanedFilesWorker.name);
  private readonly gracePeriodMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {
    this.gracePeriodMs = this.readPositiveInteger(
      config.get<string>('FILE_ORPHAN_GRACE_PERIOD_MS'),
      60 * 60 * 1000,
    );
  }

  async runOnce(now = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - this.gracePeriodMs);
    const [databaseFiles, physicalFiles] = await Promise.all([
      this.prisma.file.findMany({
        where: { createdAt: { lt: cutoff } },
        select: {
          fileId: true,
          storageKey: true,
          createdAt: true,
          attachment: { select: { attachmentId: true } },
        },
      }),
      this.storage.list(),
    ]);

    const knownStorageKeys = new Set(
      databaseFiles.map((file) => file.storageKey),
    );
    let removedDatabaseFiles = 0;
    let removedPhysicalFiles = 0;

    for (const file of databaseFiles) {
      const exists = await this.storage.exists(file.storageKey);
      if (file.attachment && exists) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.attachment.deleteMany({ where: { fileId: file.fileId } });
        await tx.file.delete({ where: { fileId: file.fileId } });
      });
      removedDatabaseFiles += 1;

      if (exists) {
        await this.storage.delete(file.storageKey);
        removedPhysicalFiles += 1;
      }
    }

    for (const physicalFile of physicalFiles) {
      if (
        knownStorageKeys.has(physicalFile.storageKey) ||
        physicalFile.modifiedAt >= cutoff
      ) {
        continue;
      }

      await this.storage.delete(physicalFile.storageKey);
      removedPhysicalFiles += 1;
    }

    if (removedDatabaseFiles || removedPhysicalFiles) {
      this.logger.log(
        `Removed ${removedDatabaseFiles} orphaned database file record(s) and ${removedPhysicalFiles} orphaned physical file(s).`,
      );
    }
  }

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
