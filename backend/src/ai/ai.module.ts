import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { GroqProvider } from './providers/groq.provider';
import { AgentService } from './agent/agent.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [DepartmentsModule, PrioritiesModule],
  controllers: [AiController],
  providers: [
    AiService,
    AgentService,
    ToolRegistryService,
    GroqProvider,
    { provide: AI_PROVIDER, useExisting: GroqProvider },
  ],
})
export class AiModule {}
