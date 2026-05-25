import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CircuitBreakerStorageAdapter } from './circuit-breaker-storage.adapter';
import { STORAGE_PORT } from './storage.port';

@Module({
  providers: [
    StorageService,
    {
      provide: STORAGE_PORT,
      useClass: CircuitBreakerStorageAdapter,
    },
  ],
  exports: [StorageService, STORAGE_PORT],
})
export class StorageModule {}
