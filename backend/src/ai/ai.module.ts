import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { GroqProvider } from './providers/groq.provider';
import { AgentService } from './agent/agent.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SubmissionContextService } from './submission-context.service';

@Module({
  imports: [DepartmentsModule, PrioritiesModule, TicketsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AgentService,
    SubmissionContextService,
    ToolRegistryService,
    GroqProvider,
    { provide: AI_PROVIDER, useExisting: GroqProvider },
  ],
})
export class AiModule {}
