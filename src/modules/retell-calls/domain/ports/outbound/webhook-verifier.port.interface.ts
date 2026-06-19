/**
 * Verifies the authenticity of an inbound Retell webhook.
 *
 * Retell signs the EXACT raw request bytes with your API key (HMAC-SHA256,
 * hex) and sends the digest in the `x-retell-signature` header. The verifier
 * must compare against the raw body — re-serializing parsed JSON breaks the
 * signature on non-ASCII transcripts.
 */
export interface IRetellWebhookVerifier {
  verify(rawBody: string, signature: string | undefined): boolean;
}

export const RETELL_WEBHOOK_VERIFIER = Symbol('IRetellWebhookVerifier');
