/**
 * Outbound Port (Anti-Corruption Layer) for looking up CompanyData from another bounded context.
 *
 * The campaigns module must NEVER import directly from the companydata module's internals.
 * All access to CompanyData must go through this port.
 */
export interface ICompanyDataLookupPort {
  /**
   * Returns the company name for a given CompanyData id, scoped to the owner user.
   * Returns null if the record does not exist or does not belong to the user.
   */
  getCompanyNameByIdForUser(companyDataId: string, userId: string): Promise<string | null>;
}

export const COMPANY_DATA_LOOKUP_PORT = Symbol('ICompanyDataLookupPort');
