import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAudioGeneratorPort, GenerateAudioInput } from '../../../domain/ports/audio-generator.port';
import { LoggerService } from '../../../../../logger/logger.service';

/**
 * STUB ElevenLabs audio generator.
 *
 * In a real implementation:
 * - Reads ELEVENLABS_API_KEY from ConfigService
 * - If missing → isEnabled() returns false, generate() returns null
 * - Otherwise initializes ElevenLabsClient and calls textToSpeech.convert
 * - Converts the returned stream to Buffer using stream-to-buffer.util
 * - Wraps the client call with cockatiel resilience policy
 *
 * This stub always returns a tiny silent MP3-like buffer when "enabled".
 */
@Injectable()
export class StubAudioGeneratorAdapter implements IAudioGeneratorPort {
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StubAudioGeneratorAdapter.name);
    const key = this.config.get<string>('ELEVENLABS_API_KEY');
    this.enabled = !!key && key.length > 5;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(input: GenerateAudioInput): Promise<Buffer | null> {
    if (!this.enabled) {
      return null;
    }

    // Return a minimal valid MP3 header (stub audio)
    // Real version would call ElevenLabs and convert the ReadableStream
    const fakeMp3Header = Buffer.from([
      0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00,
    ]);

    this.logger.debug('StubAudioGeneratorAdapter.generate (stub)', {
      voiceId: input.voiceId ?? 'Rachel',
      textLength: input.text.length,
    });

    return fakeMp3Header;
  }
}
