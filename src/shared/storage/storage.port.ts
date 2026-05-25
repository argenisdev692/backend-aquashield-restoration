/**
 * Port for R2 storage operations with circuit breaker protection.
 * This isolates external storage failures from the core application.
 */
export interface IStoragePort {
  /**
   * Uploads a file to R2 with circuit breaker protection.
   * Throws if the circuit is open or after max retries.
   */
  upload(key: string, body: Buffer, contentType: string): Promise<void>;

  /**
   * Deletes a file from R2 with circuit breaker protection.
   * Throws if the circuit is open or after max retries.
   */
  delete(key: string): Promise<void>;

  /**
   * Returns the public URL for a stored object key.
   * This is a pure function and does not hit the network.
   */
  publicUrl(key: string): string;

  /**
   * Extracts the object key from a full public URL.
   * This is a pure function and does not hit the network.
   */
  keyFromUrl(url: string): string;
}

export const STORAGE_PORT = Symbol('IStoragePort');
