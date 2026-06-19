import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_CLIENT } from './ai-client.port';
import { GeminiAiClient } from './gemini.adapter';
import { AnthropicAiClient } from './anthropic.adapter';
import { OpenAiClient } from './openai.adapter';

@Global()
@Module({
  providers: [
    {
      provide: AI_CLIENT,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER', 'gemini');

        switch (provider) {
          case 'anthropic':
            return new AnthropicAiClient(config);
          case 'openai':
            return new OpenAiClient(config);
          case 'gemini':
          default:
            return new GeminiAiClient(config);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [AI_CLIENT],
})
export class AiModule {}
