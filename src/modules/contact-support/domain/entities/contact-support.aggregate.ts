import { ContactSupportDomainException } from '../exceptions/contact-support-domain.exception';

/**
 * ContactSupport aggregate — a public contact-form submission.
 *
 * Rich domain object (private state + invariants). Pure TypeScript: no
 * NestJS / Prisma imports. Maps 1:1 with the `contact_supports` table.
 */
export class ContactSupport {
  private constructor(
    public readonly id: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly subject: string,
    public readonly message: string,
    public readonly smsConsent: boolean,
    private _isRead: boolean,
    private _deletedAt: Date | null,
  ) {}

  static create(
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    subject: string,
    message: string,
    smsConsent: boolean,
  ): ContactSupport {
    if (!firstName || firstName.trim().length === 0) {
      throw new ContactSupportDomainException('First name cannot be empty');
    }
    if (!lastName || lastName.trim().length === 0) {
      throw new ContactSupportDomainException('Last name cannot be empty');
    }
    if (!email || !email.includes('@')) {
      throw new ContactSupportDomainException('Invalid email address');
    }
    if (!phone || phone.trim().length === 0) {
      throw new ContactSupportDomainException('Phone cannot be empty');
    }
    if (!subject || subject.trim().length === 0) {
      throw new ContactSupportDomainException('Subject cannot be empty');
    }
    if (!message || message.trim().length === 0) {
      throw new ContactSupportDomainException('Message cannot be empty');
    }

    return new ContactSupport(
      id,
      firstName,
      lastName,
      email,
      phone,
      subject,
      message,
      smsConsent,
      false,
      null,
    );
  }

  static reconstitute(
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    subject: string,
    message: string,
    smsConsent: boolean,
    isRead: boolean,
    deletedAt: Date | null,
  ): ContactSupport {
    return new ContactSupport(
      id,
      firstName,
      lastName,
      email,
      phone,
      subject,
      message,
      smsConsent,
      isRead,
      deletedAt,
    );
  }

  get isRead(): boolean {
    return this._isRead;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  /** Idempotent — marking an already-read entry again is a no-op. */
  markAsRead(): void {
    this._isRead = true;
  }

  softDelete(): void {
    if (this._deletedAt !== null) {
      throw new ContactSupportDomainException(
        'Contact request is already deleted',
      );
    }
    this._deletedAt = new Date();
  }

  restore(): void {
    if (this._deletedAt === null) {
      throw new ContactSupportDomainException('Contact request is not deleted');
    }
    this._deletedAt = null;
  }
}
