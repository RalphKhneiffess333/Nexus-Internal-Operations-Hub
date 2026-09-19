import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileAttachmentsRepository } from './file-attachments.repository';
import { FILE_STORAGE } from './file-storage.interface';
import { FilesService } from './files.service';
import { LocalFileStorageService } from './local-file-storage.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    FileAttachmentsRepository,
    FilesService,
    LocalFileStorageService,
    { provide: FILE_STORAGE, useExisting: LocalFileStorageService },
  ],
  exports: [FileAttachmentsRepository, FilesService, FILE_STORAGE],
})
export class FilesModule {}
