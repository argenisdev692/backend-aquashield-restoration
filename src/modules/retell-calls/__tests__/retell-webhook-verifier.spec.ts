import { createHmac } from 'node:crypto';
import { verifyRetellSignature } from '../infrastructure/external-services/retell-signature.util';

const API_KEY = 'key_test_secret';

function sign(body: string): string {
  return createHmac('sha256', API_KEY).update(body, 'utf8').digest('hex');
}

describe('verifyRetellSignature', () => {
  const body = JSON.stringify({
    event: 'call_analyzed',
    call: { call_id: 'c1' },
  });

  it('accepts a valid HMAC-SHA256 signature', () => {
    expect(verifyRetellSignature(body, sign(body), API_KEY)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyRetellSignature(body + 'x', sign(body), API_KEY)).toBe(false);
  });

  it('rejects a wrong signature', () => {
    expect(verifyRetellSignature(body, 'deadbeef', API_KEY)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyRetellSignature(body, undefined, API_KEY)).toBe(false);
  });

  it('handles non-ASCII payloads (accents) without false negatives', () => {
    const accented = JSON.stringify({
      event: 'call_analyzed',
      call: { call_id: 'c1', transcript: 'Hola, ¿cómo estás? Adiós señor.' },
    });
    expect(verifyRetellSignature(accented, sign(accented), API_KEY)).toBe(true);
  });
});
