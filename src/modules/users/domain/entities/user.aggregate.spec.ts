import { User } from './user.aggregate';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';

const ID = UserId.reconstitute('00000000-0000-0000-0000-000000000001');
const EMAIL = Email.reconstitute('test@example.com');

describe('User (domain aggregate)', () => {
  describe('create()', () => {
    it('creates a user with null password and dates', () => {
      const user = User.create({
        id: ID,
        email: EMAIL,
        name: 'John',
        lastName: 'Doe',
      phone: null,
      });

      expect(user.id).toBe(ID);
      expect(user.email).toBe(EMAIL);
      expect(user.name).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.password).toBeNull();
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.passwordConfirmedAt).toBeNull();
      expect(user.deletedAt).toBeNull();
    });

    it('allows null lastName', () => {
      const user = User.create({
        id: ID,
        email: EMAIL,
        name: 'Jane',
        lastName: null,
      phone: null,
      });
      expect(user.lastName).toBeNull();
    });
  });

  describe('setPassword()', () => {
    it('sets the password and updates passwordConfirmedAt', () => {
      const user = User.create({
        id: ID,
        email: EMAIL,
        name: 'John',
        lastName: null,
      phone: null,
      });

      expect(user.password).toBeNull();
      expect(user.passwordConfirmedAt).toBeNull();

      user.setPassword('hashed-password');

      expect(user.password).toBe('hashed-password');
      expect(user.passwordConfirmedAt).toBeInstanceOf(Date);
    });
  });

  describe('changePassword()', () => {
    it('changes password without touching passwordConfirmedAt', () => {
      const user = User.reconstitute({
        id: ID,
        email: EMAIL,
        name: 'John',
        lastName: null,
        phone: null,
        password: 'old-hash',
        emailVerifiedAt: null,
        passwordConfirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      user.changePassword('new-hash');

      expect(user.password).toBe('new-hash');
      expect(user.passwordConfirmedAt).toBeNull();
    });
  });

  describe('reconstitute()', () => {
    it('restores a full aggregate from persistence data', () => {
      const now = new Date();
      const user = User.reconstitute({
        id: ID,
        email: EMAIL,
        name: 'Jane',
        lastName: 'Smith',
        phone: null,
        password: 'hashed',
        emailVerifiedAt: now,
        passwordConfirmedAt: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      expect(user.id.value).toBe(ID.value);
      expect(user.name).toBe('Jane');
      expect(user.password).toBe('hashed');
      expect(user.emailVerifiedAt).toBe(now);
    });
  });
});
