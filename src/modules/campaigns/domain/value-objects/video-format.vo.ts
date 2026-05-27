import { z } from 'zod';

/**
 * Supported video aspect ratios for campaign exports.
 * '9:16' = vertical (stories/reels), '16:9' = horizontal (YouTube), 'both' = generate both.
 */
export type VideoFormat = '9:16' | '16:9' | 'both';

export const VIDEO_FORMATS = ['9:16', '16:9', 'both'] as const;

export const VideoFormatSchema = z.enum(VIDEO_FORMATS);

export class InvalidVideoFormatException extends Error {
  constructor(value: unknown) {
    super(
      `Invalid video format: ${String(value)}. Allowed: ${VIDEO_FORMATS.join(', ')}`,
    );
    this.name = 'InvalidVideoFormatException';
  }
}

export class VideoFormatVO {
  private constructor(public readonly value: VideoFormat) {}

  static create(value: unknown): VideoFormatVO {
    const parsed = VideoFormatSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidVideoFormatException(value);
    }
    return new VideoFormatVO(parsed.data);
  }

  static fromString(value: string): VideoFormatVO {
    return VideoFormatVO.create(value);
  }

  isBoth(): boolean {
    return this.value === 'both';
  }

  requiresVertical(): boolean {
    return this.value === '9:16' || this.value === 'both';
  }

  requiresHorizontal(): boolean {
    return this.value === '16:9' || this.value === 'both';
  }

  equals(other: VideoFormatVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
