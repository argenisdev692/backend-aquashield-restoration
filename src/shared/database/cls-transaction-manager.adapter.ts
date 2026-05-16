import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { ITransactionManager } from './transaction-manager.port';

/**
 * `ITransactionManager` adapter on top of `@nestjs-cls/transactional`.
 *
 * Inside `runInTx()`, all writes that go through `PrismaService` are
 * automatically routed to the active transaction (enabled by
 * `enableTransactionProxy: true` in AppModule).
 */
@Injectable()
export class ClsTransactionManagerAdapter implements ITransactionManager {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async runInTx<T>(fn: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(fn);
  }
}
