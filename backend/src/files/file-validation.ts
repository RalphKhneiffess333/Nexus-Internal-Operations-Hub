import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES_PER_EVENT = 5;

const allowedTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain'],
  ['.csv', 'text/csv'],
  ['.json', 'application/json'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.doc', 'application/msword'],
  [
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['.xls', 'application/vnd.ms-excel'],
  [
    '.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  [
    '.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  ['.zip', 'application/zip'],
]);

const rejectedExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.js',
  '.msi',
  '.ps1',
  '.sh',
  '.vbs',
]);

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function validateUploadedFiles(
  files: UploadedFileInput[] | undefined,
): UploadedFileInput[] {
  const uploads = files ?? [];
  if (uploads.length > MAX_FILES_PER_EVENT) {
    throw new BadRequestException(
      `A maximum of ${MAX_FILES_PER_EVENT} files may be attached`,
    );
  }

  for (const file of uploads) {
    const filename = file.originalname.replace(/\\/g, '/').split('/').pop() ?? '';
    const displayFilename = filename || 'unnamed file';

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File "${displayFilename}" must be smaller than ${MAX_FILE_SIZE} bytes`,
      );
    }

    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!filename || !extension || rejectedExtensions.has(extension)) {
      throw new BadRequestException(
        `File "${displayFilename}" is not an allowed file type`,
      );
    }

    const expectedMimeType = allowedTypes.get(extension);
    if (!expectedMimeType || file.mimetype !== expectedMimeType) {
      throw new BadRequestException(
        `File "${displayFilename}": the file extension and MIME type do not match an allowed file type`,
      );
    }
  }

  return uploads;
}
