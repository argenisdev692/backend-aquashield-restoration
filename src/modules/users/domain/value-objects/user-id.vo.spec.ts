import { UserId } from './user-id.vo';

describe('UserId (domain VO)', () => {
  it('creates from a valid UUID', () => {
    const id = UserId.create('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(id.value).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('rejects an invalid UUID', () => {
    expect(() => UserId.create('not-a-uuid')).toThrow('Invalid UUID format');
  });

  it('reconstitutes without validation', () => {
    const id = UserId.reconstitute('anything');
    expect(id.value).toBe('anything');
  });
});
