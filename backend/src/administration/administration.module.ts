import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuditModule } from '../audit/audit.module';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { AdministrationRepository } from './administration.repository';
import { PrioritiesModule } from '../priorities/priorities.module';

@Module({
  imports: [AuthenticationModule, AuditModule, PrioritiesModule],
  controllers: [AdministrationController],
  providers: [AdministrationService, AdministrationRepository],
})
export class AdministrationModule {}
