/**
 * HTML escaping helpers for templated emails (OWASP #3 Injection).
 *
 * Use `escapeHtml` for short, structured fields (names, subjects, ids).
 * For long, multi-line user content prefer the existing `sanitize-html`
 * dependency inside the calling module — this module stays dependency-free.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes the 5 OWASP-recommended HTML metacharacters. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

/**
 * `example.com` (and its subdomains) is reserved by RFC 2606 for documentation
 * and tests. The shared mailer skips delivery to these addresses so seed data,
 * fixtures, and E2E runs never accidentally email a real human.
 */
export function isExampleDomain(email: string): boolean {
  const domain = email.toLowerCase().split('@').at(1) ?? '';
  return domain === 'example.com' || domain.endsWith('.example.com');
}

/** Filters out reserved/test addresses and de-duplicates the recipient list. */
export function sanitizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  const cleaned = list
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0 && !isExampleDomain(addr));
  return Array.from(new Set(cleaned));
}
