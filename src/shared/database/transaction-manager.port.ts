/**
 * Application-facing transactional boundary. Use cases inject this port and
 * call `runInTx()` to wrap multi-step writes inside a single DB transaction.
 *
 * The concrete adapter (`ClsTransactionManagerAdapter`) delegates to
 * `@nestjs-cls/transactional`'s `TransactionHost`, but the use case layer
 * never references that infrastructure type — it stays testable with a
 * trivial mock that just invokes the callback.
 */
export interface ITransactionManager {
  /**
   * Run `fn` inside a database transaction. The returned value is the
   * value returned by `fn`. If `fn` throws, the transaction is rolled
   * back and the error is re-thrown.
   */
  runInTx<T>(fn: () => Promise<T>): Promise<T>;
}

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');
