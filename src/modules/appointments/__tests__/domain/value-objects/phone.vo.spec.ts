import { Phone } from '../../../domain/value-objects/phone.vo';

describe('Phone', () => {
  it('should create a valid Phone', () => {
    const phone = Phone.create('+1234567890');
    expect(phone.value).toBe('+1234567890');
  });

  it('should throw error when creating with empty string', () => {
    expect(() => Phone.create('')).toThrow('Phone cannot be empty');
  });

  it('should throw error when phone exceeds 20 characters', () => {
    expect(() => Phone.create('a'.repeat(21))).toThrow(
      'Phone cannot exceed 20 characters',
    );
  });

  it('should trim whitespace', () => {
    const phone = Phone.create('  1234567890  ');
    expect(phone.value).toBe('1234567890');
  });
});
