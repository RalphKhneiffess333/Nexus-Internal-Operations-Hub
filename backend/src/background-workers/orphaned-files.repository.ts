import { Injectable } from '@nestjs/common';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

export interface OrphanedDatabaseFile {
  fileId: string;
  storageKey: string;
  createdAt: Date;
  attachment: { attachmentId: string } | null;
}

@Injectable()
export class OrphanedFilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDatabaseFiles(cutoff: Date): Promise<OrphanedDatabaseFile[]> {
    try {
      return await this.prisma.file.findMany({
        where: { createdAt: { lt: cutoff } },
        select: {
          fileId: true,
          storageKey: true,
          createdAt: true,
          attachment: { select: { attachmentId: true } },
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteDatabaseFile(fileId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.attachment.deleteMany({ where: { fileId } });
        await tx.file.delete({ where: { fileId } });
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
