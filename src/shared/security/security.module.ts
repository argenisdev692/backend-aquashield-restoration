import { Global, Module } from '@nestjs/common';
import { HibpPasswordAdapter } from './hibp-password.adapter';
import { BREACHED_PASSWORD_PORT } from './breached-password.port';
import { BcryptPasswordHasherAdapter } from './bcrypt-password-hasher.adapter';
import { PASSWORD_HASHER_PORT } from './password-hasher.port';

/**
 * Global security module — exposes:
 * - {@link BREACHED_PASSWORD_PORT} for HIBP-style breached-password screening
 * - {@link PASSWORD_HASHER_PORT} (+ the concrete `BcryptPasswordHasherAdapter`)
 *   for bcrypt hash/compare. Both the symbol and the class are exported so
 *   modules that already inject the concrete class don't break.
 */
@Global()
@Module({
  providers: [
    HibpPasswordAdapter,
    { provide: BREACHED_PASSWORD_PORT, useExisting: HibpPasswordAdapter },
    BcryptPasswordHasherAdapter,
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptPasswordHasherAdapter },
  ],
  exports: [
    BREACHED_PASSWORD_PORT,
    PASSWORD_HASHER_PORT,
    BcryptPasswordHasherAdapter,
  ],
})
export class SecurityModule {}
