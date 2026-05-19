/**
 * Masks an email for logs so PII is not written in plaintext while keeping
 * just enough signal to correlate (OWASP Logging Failures / "never log PII").
 *
 * `john.doe@example.com` → `jo***@e***.com`
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const maskedLocal =
    local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`;

  const dot = domain.lastIndexOf('.');
  if (dot <= 0) return `${maskedLocal}@***`;

  const host = domain.slice(0, dot);
  const tld = domain.slice(dot);
  const maskedHost = host.length <= 1 ? '*' : `${host[0]}***`;

  return `${maskedLocal}@${maskedHost}${tld}`;
}
