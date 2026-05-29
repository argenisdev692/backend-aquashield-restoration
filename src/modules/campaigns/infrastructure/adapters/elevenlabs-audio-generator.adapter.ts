import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import { LoggerService } from '../../../../logger/logger.service';
import {
  IAudioGeneratorPort,
  GenerateAudioInput,
} from '../../domain/ports/audio-generator.port';

/**
 * ElevenLabs Text-to-Speech adapter.
 *
 * Module-level optional: when `ELEVENLABS_API_KEY` is absent the adapter is
 * disabled and `generate()` returns null so the pipeline simply ships ZIPs
 * without audio. All network calls go through the shared circuit breaker.
 */
@Injectable()
export class ElevenLabsAudioGeneratorAdapter
  implements IAudioGeneratorPort, OnModuleInit
{
  private readonly apiKey: string | undefined;
  private readonly defaultVoiceId: string;
  private readonly modelId: string;
  private readonly baseUrl: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ElevenLabsAudioGeneratorAdapter.name);
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    // Env may hold a friendly name ("Rachel"); fall back to Rachel's canonical id.
    const configured = this.config.get<string>('ELEVENLABS_VOICE_ID', 'Rachel');
    this.defaultVoiceId =
      configured === 'Rachel' ? '21m00Tcm4TlvDq8ikWAM' : configured;
    this.modelId = this.config.get<string>(
      'ELEVENLABS_MODEL_ID',
      'eleven_multilingual_v2',
    );
    this.baseUrl = this.config.get<string>(
      'ELEVENLABS_API_URL',
      'https://api.elevenlabs.io/v1/text-to-speech',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('elevenlabs', 'ai');
  }

  isEnabled(): boolean {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  async generate(input: GenerateAudioInput): Promise<Buffer | null> {
    if (!this.isEnabled()) return null;
    const traceId = this.cls.get<string>('traceId');
    const voiceId = input.voiceId ?? this.defaultVoiceId;

    try {
      const buffer = await this.resilience.execute(async () => {
        const resp = await fetch(`${this.baseUrl}/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey!,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: input.text,
            model_id: this.modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });

        if (!resp.ok) {
          throw new Error(`ElevenLabs HTTP ${resp.status}`);
        }
        const arrayBuffer = await resp.arrayBuffer();
        return Buffer.from(arrayBuffer);
      });

      this.logger.info('ElevenLabsAudioGeneratorAdapter.generate done', {
        traceId,
        bytes: buffer.length,
      });
      return buffer;
    } catch (error) {
      // Audio is optional — never abort the export because TTS failed.
      this.logger.warn('ElevenLabs TTS failed, continuing without audio', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
