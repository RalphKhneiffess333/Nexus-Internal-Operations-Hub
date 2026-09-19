import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuditModule } from '../audit/audit.module';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { AdministrationRepository } from './administration.repository';

@Module({
  imports: [AuthenticationModule, AuditModule],
  controllers: [AdministrationController],
  providers: [AdministrationService, AdministrationRepository],
})
export class AdministrationModule {}
