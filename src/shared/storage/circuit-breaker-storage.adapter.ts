import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { LoggerService } from '../../logger/logger.service';
import { IStoragePort } from './storage.port';

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject calls immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  resetTimeout: number; // ms to wait before trying again
  requestTimeout: number; // ms to abort individual requests
  maxRetries: number; // Retry attempts before giving up
  retryDelay: number; // ms between retries
}

/**
 * Storage adapter with circuit breaker protection for R2 operations.
 * Prevents cascading failures when R2 is down or slow.
 */
@Injectable()
export class CircuitBreakerStorageAdapter implements IStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;
  private readonly config: CircuitBreakerConfig;

  // Circuit breaker state
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private readonly cfg: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CircuitBreakerStorageAdapter.name);

    this.client = new S3Client({
      region: this.cfg.get<string>('R2_DEFAULT_REGION', 'auto'),
      endpoint: this.cfg.get<string | undefined>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.cfg.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.cfg.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: this.cfg.get<boolean>(
        'R2_USE_PATH_STYLE_ENDPOINT',
        false,
      ),
    });

    this.bucket = this.cfg.getOrThrow<string>('R2_BUCKET_NAME');
    this.baseUrl = this.cfg
      .getOrThrow<string>('R2_PUBLIC_BASE_URL')
      .replace(/\/$/, '');

    this.config = {
      failureThreshold: this.cfg.get<number>('STORAGE_CB_FAILURE_THRESHOLD', 5),
      resetTimeout: this.cfg.get<number>('STORAGE_CB_RESET_TIMEOUT', 60000), // 1 minute
      requestTimeout: this.cfg.get<number>('STORAGE_CB_REQUEST_TIMEOUT', 30000), // 30 seconds
      maxRetries: this.cfg.get<number>('STORAGE_CB_MAX_RETRIES', 3),
      retryDelay: this.cfg.get<number>('STORAGE_CB_RETRY_DELAY', 1000), // 1 second
    };
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          'Circuit breaker is OPEN - R2 storage is temporarily unavailable',
        );
      }
      // Try to transition to half-open
      this.state = CircuitState.HALF_OPEN;
      this.logger.warn('Circuit breaker transitioning to HALF_OPEN', { key });
    }

    try {
      await this.withRetry(
        () =>
          this.withTimeout(
            this.client.send(
              new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable',
              }),
            ),
            this.config.requestTimeout,
          ),
        this.config.maxRetries,
        this.config.retryDelay,
      );

      // Success - reset circuit
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.logger.info('Circuit breaker reset to CLOSED', { key });
      }
    } catch (error) {
      this.handleFailure(error, key);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          'Circuit breaker is OPEN - R2 storage is temporarily unavailable',
        );
      }
      this.state = CircuitState.HALF_OPEN;
      this.logger.warn('Circuit breaker transitioning to HALF_OPEN', { key });
    }

    try {
      await this.withRetry(
        () =>
          this.withTimeout(
            this.client.send(
              new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
              }),
            ),
            this.config.requestTimeout,
          ),
        this.config.maxRetries,
        this.config.retryDelay,
      );

      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.logger.info('Circuit breaker reset to CLOSED', { key });
      }
    } catch (error) {
      this.handleFailure(error, key);
      throw error;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  keyFromUrl(url: string): string {
    const prefix = `${this.baseUrl}/`;
    if (!url.startsWith(prefix)) {
      throw new Error(`URL does not belong to this storage bucket: ${url}`);
    }
    return url.slice(prefix.length);
  }

  private handleFailure(error: unknown, key: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      this.logger.error('Circuit breaker opened due to failures', {
        key,
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
        nextAttemptAt: new Date(this.nextAttemptTime).toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      this.logger.warn('Storage operation failed', {
        key,
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    delay: number,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const backoff = delay * Math.pow(2, attempt); // Exponential backoff
          this.logger.warn(
            `Storage operation failed, retrying in ${backoff}ms`,
            {
              attempt: attempt + 1,
              maxRetries,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
    throw lastError;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    return Promise.race([promise, timeout]);
  }

  /**
   * Get current circuit breaker state (for monitoring/health checks)
   */
  getCircuitState(): {
    state: CircuitState;
    failureCount: number;
    nextAttemptTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset circuit breaker (for admin/health recovery)
   */
  resetCircuit(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    this.logger.info('Circuit breaker manually reset');
  }
}
