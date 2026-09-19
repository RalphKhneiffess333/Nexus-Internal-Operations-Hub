import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';
import type { TicketPersistenceClient } from '../tickets/repositories/tickets.repository';

const attachmentFileSelect = {
  fileId: true,
  originalName: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
  storageKey: true,
} satisfies Prisma.FileSelect;

export interface StoredFileMetadata {
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
}

export interface TicketEventAttachment {
  attachmentId: string;
  fileId: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileAttachmentRecord extends TicketEventAttachment {
  storageKey: string;
}

export interface ChatMessageAttachment extends TicketEventAttachment {}

const storedFileSelect = {
  uploadedBy: true,
  originalName: true,
  storageKey: true,
  fileSize: true,
  mimeType: true,
} satisfies Prisma.FileSelect;

@Injectable()
export class FileAttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createForEvent(
    eventId: string,
    file: StoredFileMetadata,
    client: TicketPersistenceClient,
  ): Promise<void> {
    try {
      const createdFile = await client.file.create({
        data: {
          fileId: randomUUID(),
          uploadedBy: file.uploadedBy,
          originalName: file.originalName,
          storageKey: file.storageKey,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        },
      });

      await client.attachment.create({
        data: {
          attachmentId: randomUUID(),
          fileId: createdFile.fileId,
          eventId,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async createForMessage(
    messageId: string,
    file: StoredFileMetadata,
    client: TicketPersistenceClient,
  ): Promise<void> {
    try {
      const createdFile = await client.file.create({
        data: {
          fileId: randomUUID(),
          uploadedBy: file.uploadedBy,
          originalName: file.originalName,
          storageKey: file.storageKey,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        },
      });

      await client.attachment.create({
        data: {
          attachmentId: randomUUID(),
          fileId: createdFile.fileId,
          messageId,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findForTicketEvent(
    ticketId: string,
    eventId: string,
    attachmentId: string,
  ): Promise<FileAttachmentRecord | null> {
    try {
      const attachment = await this.prisma.attachment.findFirst({
        where: {
          attachmentId,
          eventId,
          event: { ticketId },
        },
        include: { file: { select: attachmentFileSelect } },
      });

      if (!attachment) {
        return null;
      }

      return {
        attachmentId: attachment.attachmentId,
        fileId: attachment.file.fileId,
        originalName: attachment.file.originalName,
        fileSize: attachment.file.fileSize,
        mimeType: attachment.file.mimeType,
        createdAt: attachment.file.createdAt,
        updatedAt: attachment.file.updatedAt,
        storageKey: attachment.file.storageKey,
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByEventIds(eventIds: string[]): Promise<TicketEventAttachment[]> {
    if (eventIds.length === 0) {
      return [];
    }

    try {
      const attachments = await this.prisma.attachment.findMany({
        where: { eventId: { in: eventIds } },
        include: { file: { select: attachmentFileSelect } },
        orderBy: { createdAt: 'asc' },
      });

      return attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        fileId: attachment.file.fileId,
        originalName: attachment.file.originalName,
        fileSize: attachment.file.fileSize,
        mimeType: attachment.file.mimeType,
        createdAt: attachment.file.createdAt,
        updatedAt: attachment.file.updatedAt,
      }));
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findForChatMessage(
    ticketId: string,
    messageId: string,
    attachmentId: string,
  ): Promise<FileAttachmentRecord | null> {
    try {
      const attachment = await this.prisma.attachment.findFirst({
        where: {
          attachmentId,
          messageId,
          message: { ticketId },
        },
        include: { file: { select: attachmentFileSelect } },
      });
      if (!attachment) return null;

      return {
        attachmentId: attachment.attachmentId,
        fileId: attachment.file.fileId,
        originalName: attachment.file.originalName,
        fileSize: attachment.file.fileSize,
        mimeType: attachment.file.mimeType,
        createdAt: attachment.file.createdAt,
        updatedAt: attachment.file.updatedAt,
        storageKey: attachment.file.storageKey,
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findForTicket(
    ticketId: string,
    attachmentIds: string[],
  ): Promise<StoredFileMetadata[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    try {
      const attachments = await this.prisma.attachment.findMany({
        where: {
          attachmentId: { in: attachmentIds },
          event: { ticketId },
        },
        include: { file: { select: storedFileSelect } },
      });

      return attachments.map((attachment) => ({
        uploadedBy: attachment.file.uploadedBy,
        originalName: attachment.file.originalName,
        storageKey: attachment.file.storageKey,
        fileSize: attachment.file.fileSize,
        mimeType: attachment.file.mimeType,
      }));
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteForTicket(
    ticketId: string,
    attachmentIds: string[],
    client: TicketPersistenceClient,
  ): Promise<void> {
    if (attachmentIds.length === 0) {
      return;
    }

    try {
      const attachments = await client.attachment.findMany({
        where: {
          attachmentId: { in: attachmentIds },
          event: { ticketId },
        },
        select: { attachmentId: true, fileId: true },
      });
      if (attachments.length === 0) {
        return;
      }

      const validAttachmentIds = attachments.map(
        (attachment) => attachment.attachmentId,
      );
      const fileIds = attachments.map((attachment) => attachment.fileId);
      await client.attachment.deleteMany({
        where: { attachmentId: { in: validAttachmentIds } },
      });
      await client.file.deleteMany({ where: { fileId: { in: fileIds } } });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
