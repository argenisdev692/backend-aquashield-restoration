/**
 * Minimal company footer/branding snapshot consumed by the appointment email
 * templates (logo name, contact line, social icons, copyright address).
 * Mirrors the blade `$companyData` fields actually referenced by the views.
 */
export interface AppointmentCompanyInfo {
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
 * singleton from the appointments bounded context. The module must NEVER
 * import the companydata internals directly — only through this port.
 */
export interface ICompanyDataLookupPort {
  /** The owner-company singleton, or `null` when none is configured yet. */
  getCompanyInfo(): Promise<AppointmentCompanyInfo | null>;
}

export const COMPANY_DATA_LOOKUP_PORT = Symbol(
  'IAppointmentCompanyDataLookupPort',
);
