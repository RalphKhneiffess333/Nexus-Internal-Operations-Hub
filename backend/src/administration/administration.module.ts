import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';

@Module({ imports: [AuthenticationModule], controllers: [AdministrationController], providers: [AdministrationService] })
export class AdministrationModule {}
