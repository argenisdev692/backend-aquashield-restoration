/**
 * Input for audio generation (ElevenLabs).
 */
export interface GenerateAudioInput {
  text: string;
  voiceId?: string; // defaults to Rachel / env
  language?: string; // influences model choice if needed
}

/**
 * Port: Text-to-Speech generator.
 * Must be injected with @Optional() because the feature is module-level optional.
 * When ELEVENLABS_API_KEY is absent, the adapter should gracefully return null/empty.
 */
export interface IAudioGeneratorPort {
  /**
   * Generate MP3 audio for the given text.
   * Returns Buffer or null if ElevenLabs is not configured or generation fails gracefully.
   */
  generate(input: GenerateAudioInput): Promise<Buffer | null>;

  /**
   * Returns true if the adapter is enabled (API key present and client initialized).
   */
  isEnabled(): boolean;
}

export const AUDIO_GENERATOR_PORT = Symbol('IAudioGeneratorPort');
