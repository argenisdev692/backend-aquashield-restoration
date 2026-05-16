import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ClsTransactionManagerAdapter } from './cls-transaction-manager.adapter';
import { TRANSACTION_MANAGER } from './transaction-manager.port';

/**
 * Global database module — registers {@link PrismaService} and the
 * {@link ITransactionManager} port once for the whole app. Repositories
 * inject `PrismaService` directly; use cases inject `TRANSACTION_MANAGER`
 * to wrap multi-step writes in a single transaction.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: TRANSACTION_MANAGER,
      useClass: ClsTransactionManagerAdapter,
    },
  ],
  exports: [PrismaService, TRANSACTION_MANAGER],
})
export class DatabaseModule {}
