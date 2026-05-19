import { Email } from './email.vo';

describe('Email (domain VO)', () => {
  it('creates a valid email (lowercased, trimmed)', () => {
    const email = Email.create('  User@Example.COM  ');
    expect(email.value).toBe('user@example.com');
  });

  it('rejects an empty string', () => {
    expect(() => Email.create('')).toThrow(
      'Email must be between 1 and 255 characters',
    );
  });

  it('rejects a string exceeding 255 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(() => Email.create(long)).toThrow(
      'Email must be between 1 and 255 characters',
    );
  });

  it('rejects an invalid email format', () => {
    expect(() => Email.create('not-an-email')).toThrow('Invalid email format');
  });

  it('reconstitutes without validation', () => {
    const email = Email.reconstitute('raw-value');
    expect(email.value).toBe('raw-value');
  });
});
