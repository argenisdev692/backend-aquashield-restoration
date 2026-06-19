/**
 * Company footer/branding + notification inbox snapshot consumed by the
 * "new call" email template. Mirrors the blade `$companyData` fields the
 * `new-call` view references, plus `email` (the recipient inbox).
 */
export interface RetellCallCompanyInfo {
  companyName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  facebookLink: string | null;
  instagramLink: string | null;
  linkedinLink: string | null;
  twitterLink: string | null;
}

/**
 * Outbound Port (Anti-Corruption Layer) for reading the platform CompanyData
 * singleton from the retell-calls bounded context. Never import companydata
 * internals directly — only through this port.
 */
export interface ICompanyDataLookupPort {
  getCompanyInfo(): Promise<RetellCallCompanyInfo | null>;
}

export const COMPANY_DATA_LOOKUP_PORT = Symbol(
  'IRetellCallCompanyDataLookupPort',
);
