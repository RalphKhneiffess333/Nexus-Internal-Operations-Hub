import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EMAIL_PROVIDER } from './email-provider';
import { EmailNotificationsService } from './email-notifications.service';
import { NodemailerEmailProvider } from './nodemailer-email.provider';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

@Module({
  imports: [ConfigModule],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EmailNotificationsService,
    NodemailerEmailProvider,
    { provide: EMAIL_PROVIDER, useExisting: NodemailerEmailProvider },
  ],
  exports: [NotificationsService, EmailNotificationsService],
})
export class NotificationsModule {}
