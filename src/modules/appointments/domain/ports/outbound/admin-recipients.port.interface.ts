/**
 * ACL port to the users/RBAC context.
 *
 * Resolves the e-mail addresses notified when a new lead arrives — every
 * active super-admin AND admin user. The appointments context never reaches
 * into the users tables directly; the adapter lives in `infrastructure/acl/`.
 */
export interface IAdminRecipientsPort {
  getAdminRecipientEmails(): Promise<string[]>;
}

export const ADMIN_RECIPIENTS_PORT = Symbol('IAdminRecipientsPort');
