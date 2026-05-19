import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { LoggerService } from '../../logger/logger.service';
import type { ICachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import type { IBreachedPasswordPort } from './breached-password.port';

/** Range responses are immutable for a given prefix; cache a full day. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * HaveIBeenPwned "Pwned Passwords" adapter using the k-anonymity range API:
 * only the first 5 chars of the SHA-1 are sent, never the password. No API
 * key required. `Add-Padding` defeats response-size analysis (padded rows
 * arrive with count 0 and are ignored).
 *
 * Fail-open by contract: any error/timeout → `false` (do not block the user).
 */
@Injectable()
export class HibpPasswordAdapter implements IBreachedPasswordPort {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private readonly rangeUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
  ) {
    this.logger.setContext(HibpPasswordAdapter.name);
    this.enabled = this.config.get<boolean>('HIBP_ENABLED') ?? true;
    this.timeoutMs = this.config.get<number>('HIBP_TIMEOUT_MS') ?? 1000;
    // Default lives in the env schema (single source of truth); never
    // hardcoded here. getOrThrow makes a missing value fail fast.
    const url = this.config.getOrThrow<string>('HIBP_RANGE_URL');
    // The prefix is appended directly, so a trailing slash is required.
    this.rangeUrl = url.endsWith('/') ? url : `${url}/`;
  }

  async isBreached(password: string): Promise<boolean> {
    if (!this.enabled) return false;

    const sha1 = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const suffixes = await this.fetchRange(prefix);
      return suffixes.includes(suffix);
    } catch (err) {
      // Fail-open: a HIBP outage must never block a password change.
      this.logger.warn('HIBP check failed — allowing password (fail-open)', {
        layer: 'security',
        error: err instanceof Error ? err.message : 'unknown',
      });
      return false;
    }
  }

  private async fetchRange(prefix: string): Promise<string[]> {
    const cacheKey = `hibp:range:${prefix}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.rangeUrl}${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HIBP responded ${response.status}`);
      }
      const body = await response.text();
      const suffixes = this.parse(body);
      await this.cache.set(cacheKey, suffixes, CACHE_TTL_SECONDS);
      return suffixes;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Keeps only suffixes with a real breach count (>0); drops padding rows. */
  private parse(body: string): string[] {
    const result: string[] = [];
    for (const line of body.split(/\r?\n/)) {
      const [hashSuffix, countRaw] = line.split(':');
      if (hashSuffix && Number(countRaw) > 0) {
        result.push(hashSuffix.toUpperCase());
      }
    }
    return result;
  }
}
