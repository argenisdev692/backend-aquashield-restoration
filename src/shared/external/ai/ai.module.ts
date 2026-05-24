import { Global, Module } from '@nestjs/common';
import { AI_CLIENT } from './ai-client.port';
import { GeminiAiClient } from './gemini.adapter';

@Global()
@Module({
  providers: [
    {
      provide: AI_CLIENT,
      useClass: GeminiAiClient,
    },
  ],
  exports: [AI_CLIENT],
})
export class AiModule {}
