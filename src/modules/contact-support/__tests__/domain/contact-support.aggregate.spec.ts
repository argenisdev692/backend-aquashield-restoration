import { ContactSupport } from '../../domain/entities/contact-support.aggregate';
import { ContactSupportDomainException } from '../../domain/exceptions/contact-support-domain.exception';

const BASE = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@acme.com',
  phone: '+1-555-0100',
  subject: 'Cannot log in',
  message: 'I cannot log in to my account.',
  smsConsent: true,
};

function make(): ContactSupport {
  return ContactSupport.create(
    BASE.id,
    BASE.firstName,
    BASE.lastName,
    BASE.email,
    BASE.phone,
    BASE.subject,
    BASE.message,
    BASE.smsConsent,
  );
}

describe('ContactSupport aggregate', () => {
  describe('create()', () => {
    it('creates with isRead=false, not deleted, all fields stored', () => {
      const c = make();
      expect(c.id).toBe(BASE.id);
      expect(c.firstName).toBe(BASE.firstName);
      expect(c.lastName).toBe(BASE.lastName);
      expect(c.email).toBe(BASE.email);
      expect(c.phone).toBe(BASE.phone);
      expect(c.subject).toBe(BASE.subject);
      expect(c.message).toBe(BASE.message);
      expect(c.smsConsent).toBe(true);
      expect(c.isRead).toBe(false);
      expect(c.isDeleted).toBe(false);
      expect(c.deletedAt).toBeNull();
    });

    it.each([
      [
        'empty first name',
        '',
        BASE.lastName,
        BASE.email,
        BASE.phone,
        BASE.subject,
        BASE.message,
      ],
      [
        'empty last name',
        BASE.firstName,
        '',
        BASE.email,
        BASE.phone,
        BASE.subject,
        BASE.message,
      ],
      [
        'invalid email',
        BASE.firstName,
        BASE.lastName,
        'not-an-email',
        BASE.phone,
        BASE.subject,
        BASE.message,
      ],
      [
        'empty phone',
        BASE.firstName,
        BASE.lastName,
        BASE.email,
        '',
        BASE.subject,
        BASE.message,
      ],
      [
        'blank subject',
        BASE.firstName,
        BASE.lastName,
        BASE.email,
        BASE.phone,
        '   ',
        BASE.message,
      ],
      [
        'blank message',
        BASE.firstName,
        BASE.lastName,
        BASE.email,
        BASE.phone,
        BASE.subject,
        '   ',
      ],
    ])(
      'throws on %s',
      (_label, first, last, email, phone, subject, message) => {
        expect(() =>
          ContactSupport.create(
            BASE.id,
            first,
            last,
            email,
            phone,
            subject,
            message,
            false,
          ),
        ).toThrow(ContactSupportDomainException);
      },
    );
  });

  describe('markAsRead()', () => {
    it('sets isRead=true and is idempotent', () => {
      const c = make();
      c.markAsRead();
      c.markAsRead();
      expect(c.isRead).toBe(true);
    });
  });

  describe('softDelete() / restore()', () => {
    it('soft-deletes then restores', () => {
      const c = make();
      c.softDelete();
      expect(c.isDeleted).toBe(true);
      expect(c.deletedAt).toBeInstanceOf(Date);
      c.restore();
      expect(c.isDeleted).toBe(false);
      expect(c.deletedAt).toBeNull();
    });

    it('throws when deleting twice', () => {
      const c = make();
      c.softDelete();
      expect(() => c.softDelete()).toThrow(ContactSupportDomainException);
    });

    it('throws when restoring a non-deleted entry', () => {
      const c = make();
      expect(() => c.restore()).toThrow(ContactSupportDomainException);
    });
  });

  describe('reconstitute()', () => {
    it('rehydrates state including isRead + deletedAt', () => {
      const when = new Date('2026-01-02T03:04:05.000Z');
      const c = ContactSupport.reconstitute(
        BASE.id,
        BASE.firstName,
        BASE.lastName,
        BASE.email,
        BASE.phone,
        BASE.subject,
        BASE.message,
        false,
        true,
        when,
      );
      expect(c.isRead).toBe(true);
      expect(c.smsConsent).toBe(false);
      expect(c.isDeleted).toBe(true);
      expect(c.deletedAt).toEqual(when);
    });
  });
});
