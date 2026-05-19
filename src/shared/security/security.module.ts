import { Global, Module } from '@nestjs/common';
import { HibpPasswordAdapter } from './hibp-password.adapter';
import { BREACHED_PASSWORD_PORT } from './breached-password.port';

/**
 * Global security module — exposes {@link BREACHED_PASSWORD_PORT} (breached
 * password screening) so any module can inject it without re-providing it.
 */
@Global()
@Module({
  providers: [
    HibpPasswordAdapter,
    { provide: BREACHED_PASSWORD_PORT, useExisting: HibpPasswordAdapter },
  ],
  exports: [BREACHED_PASSWORD_PORT],
})
export class SecurityModule {}
