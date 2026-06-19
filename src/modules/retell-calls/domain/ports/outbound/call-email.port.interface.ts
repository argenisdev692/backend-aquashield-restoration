import type { RetellCallReadModel } from '../../repositories/retell-call-repository.interface';
import type { RetellCallCompanyInfo } from './company-data-lookup.port.interface';

export interface NewCallEmailData {
  /** Company inbox that receives the "new call" alert. */
  recipientEmail: string;
  call: RetellCallReadModel;
  company: RetellCallCompanyInfo | null;
}

/**
 * Outbound port for the "new call recorded" admin notification. The adapter
 * renders the HTML (port of `new-call.blade.php`) and delegates delivery to
 * the shared `IMailer`.
 */
export interface ICallEmailPort {
  notifyNewCall(data: NewCallEmailData): Promise<void>;
}

export const CALL_EMAIL_PORT = Symbol('ICallEmailPort');
