import { Email } from '../../../domain/value-objects/email.vo';

describe('Email', () => {
  it('should create a valid Email', () => {
    const email = Email.create('test@example.com');
    expect(email.value).toBe('test@example.com');
  });

  it('should create null Email when value is null', () => {
    const email = Email.create(null);
    expect(email.value).toBe(null);
  });

  it('should create null Email when value is undefined', () => {
    const email = Email.create(undefined);
    expect(email.value).toBe(null);
  });

  it('should throw error for invalid email format', () => {
    expect(() => Email.create('invalid-email')).toThrow('Invalid email format');
  });

  it('should throw error when email exceeds 255 characters', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(() => Email.create(longEmail)).toThrow(
      'Email cannot exceed 255 characters',
    );
  });

  it('should trim whitespace', () => {
    const email = Email.create('  test@example.com  ');
    expect(email.value).toBe('test@example.com');
  });
});
