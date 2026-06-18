import { v7 as uuidv7 } from 'uuid';
import { AppointmentId } from '../value-objects/appointment-id.vo';
import { StatusLeadValue } from '../value-objects/status-lead.vo';
import { Phone } from '../value-objects/phone.vo';
import { Email } from '../value-objects/email.vo';

/**
 * Primitive (VO-free) snapshot of an appointment — the single source of truth
 * for the field list shared by `create()`, `updateDetails()` and `toPlain()`.
 * Dates are kept as `Date`; `statusLead` is the raw enum value as a string.
 */
export interface AppointmentSnapshot {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string;
  address2: string | null;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  insuranceProperty: boolean;
  message: string | null;
  smsConsent: boolean;
  registrationDate: Date | null;
  inspectionDate: Date | null;
  inspectionTime: Date | null;
  inspectionStatus: string | null;
  statusLead: string | null;
  leadSource: string | null;
  followUpCalls: unknown;
  notes: string | null;
  owner: string | null;
  damageDetail: string | null;
  intentToClaim: boolean | null;
  followUpDate: Date | null;
  additionalNote: string | null;
  latitude: number | null;
  longitude: number | null;
}

export class Appointment {
  constructor(
    public readonly id: AppointmentId,
    private _firstName: string,
    private _lastName: string,
    private _phone: Phone,
    private _email: Email,
    private _address: string,
    private _address2: string | null,
    private _city: string,
    private _state: string,
    private _zipcode: string,
    private _country: string,
    private _insuranceProperty: boolean,
    private _message: string | null,
    private _smsConsent: boolean,
    private _registrationDate: Date | null,
    private _inspectionDate: Date | null,
    private _inspectionTime: Date | null,
    private _inspectionStatus: string | null,
    private _statusLead: StatusLeadValue | null,
    private _leadSource: string | null,
    private _followUpCalls: unknown,
    private _notes: string | null,
    private _owner: string | null,
    private _damageDetail: string | null,
    private _intentToClaim: boolean | null,
    private _followUpDate: Date | null,
    private _additionalNote: string | null,
    private _latitude: number | null,
    private _longitude: number | null,
  ) {}

  static create(props: AppointmentSnapshot): Appointment {
    const phone = Phone.create(props.phone);
    const email = Email.create(props.email);
    const statusLead = props.statusLead
      ? StatusLeadValue.create(props.statusLead)
      : null;

    return new Appointment(
      AppointmentId.create(uuidv7()),
      props.firstName,
      props.lastName,
      phone,
      email,
      props.address,
      props.address2,
      props.city,
      props.state,
      props.zipcode,
      props.country,
      props.insuranceProperty,
      props.message,
      props.smsConsent,
      props.registrationDate,
      props.inspectionDate,
      props.inspectionTime,
      props.inspectionStatus,
      statusLead,
      props.leadSource,
      props.followUpCalls,
      props.notes,
      props.owner,
      props.damageDetail,
      props.intentToClaim,
      props.followUpDate,
      props.additionalNote,
      props.latitude,
      props.longitude,
    );
  }

  // Getters
  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get phone(): string {
    return this._phone.value;
  }

  get email(): string | null {
    return this._email.value;
  }

  get address(): string {
    return this._address;
  }

  get address2(): string | null {
    return this._address2;
  }

  get city(): string {
    return this._city;
  }

  get state(): string {
    return this._state;
  }

  get zipcode(): string {
    return this._zipcode;
  }

  get country(): string {
    return this._country;
  }

  get insuranceProperty(): boolean {
    return this._insuranceProperty;
  }

  get message(): string | null {
    return this._message;
  }

  get smsConsent(): boolean {
    return this._smsConsent;
  }

  get registrationDate(): Date | null {
    return this._registrationDate;
  }

  get inspectionDate(): Date | null {
    return this._inspectionDate;
  }

  get inspectionTime(): Date | null {
    return this._inspectionTime;
  }

  get inspectionStatus(): string | null {
    return this._inspectionStatus;
  }

  get statusLead(): StatusLeadValue | null {
    return this._statusLead;
  }

  get statusLeadValue(): string | null {
    return this._statusLead?.value ?? null;
  }

  get leadSource(): string | null {
    return this._leadSource;
  }

  get followUpCalls(): unknown {
    return this._followUpCalls;
  }

  get notes(): string | null {
    return this._notes;
  }

  get owner(): string | null {
    return this._owner;
  }

  get damageDetail(): string | null {
    return this._damageDetail;
  }

  get intentToClaim(): boolean | null {
    return this._intentToClaim;
  }

  get followUpDate(): Date | null {
    return this._followUpDate;
  }

  get additionalNote(): string | null {
    return this._additionalNote;
  }

  get latitude(): number | null {
    return this._latitude;
  }

  get longitude(): number | null {
    return this._longitude;
  }

  // Business methods
  updateStatus(newStatus: string): {
    oldStatus: string | null;
    newStatus: string;
  } {
    // `create` validates enum membership (throws AppointmentDomainException)
    // before the transition rule runs — no unchecked `as StatusLead` cast.
    const target = StatusLeadValue.create(newStatus).value;
    const oldStatus = this._statusLead?.value ?? null;
    const current = this._statusLead ?? StatusLeadValue.new();
    this._statusLead = current.transitionTo(target);
    return { oldStatus, newStatus: target };
  }

  updateDetails(props: Partial<Omit<AppointmentSnapshot, 'statusLead'>>): void {
    if (props.firstName !== undefined) this._firstName = props.firstName;
    if (props.lastName !== undefined) this._lastName = props.lastName;
    if (props.phone !== undefined) this._phone = Phone.create(props.phone);
    if (props.email !== undefined) this._email = Email.create(props.email);
    if (props.address !== undefined) this._address = props.address;
    if (props.address2 !== undefined) this._address2 = props.address2;
    if (props.city !== undefined) this._city = props.city;
    if (props.state !== undefined) this._state = props.state;
    if (props.zipcode !== undefined) this._zipcode = props.zipcode;
    if (props.country !== undefined) this._country = props.country;
    if (props.insuranceProperty !== undefined)
      this._insuranceProperty = props.insuranceProperty;
    if (props.message !== undefined) this._message = props.message;
    if (props.smsConsent !== undefined) this._smsConsent = props.smsConsent;
    if (props.registrationDate !== undefined)
      this._registrationDate = props.registrationDate;
    if (props.inspectionDate !== undefined)
      this._inspectionDate = props.inspectionDate;
    if (props.inspectionTime !== undefined)
      this._inspectionTime = props.inspectionTime;
    if (props.inspectionStatus !== undefined)
      this._inspectionStatus = props.inspectionStatus;
    if (props.leadSource !== undefined) this._leadSource = props.leadSource;
    if (props.followUpCalls !== undefined)
      this._followUpCalls = props.followUpCalls;
    if (props.notes !== undefined) this._notes = props.notes;
    if (props.owner !== undefined) this._owner = props.owner;
    if (props.damageDetail !== undefined)
      this._damageDetail = props.damageDetail;
    if (props.intentToClaim !== undefined)
      this._intentToClaim = props.intentToClaim;
    if (props.followUpDate !== undefined)
      this._followUpDate = props.followUpDate;
    if (props.additionalNote !== undefined)
      this._additionalNote = props.additionalNote;
    if (props.latitude !== undefined) this._latitude = props.latitude;
    if (props.longitude !== undefined) this._longitude = props.longitude;
  }

  toPlain(): AppointmentSnapshot & { id: string } {
    return {
      id: this.id.value,
      firstName: this._firstName,
      lastName: this._lastName,
      phone: this._phone.value,
      email: this._email.value,
      address: this._address,
      address2: this._address2,
      city: this._city,
      state: this._state,
      zipcode: this._zipcode,
      country: this._country,
      insuranceProperty: this._insuranceProperty,
      message: this._message,
      smsConsent: this._smsConsent,
      registrationDate: this._registrationDate,
      inspectionDate: this._inspectionDate,
      inspectionTime: this._inspectionTime,
      inspectionStatus: this._inspectionStatus,
      statusLead: this._statusLead?.value ?? null,
      leadSource: this._leadSource,
      followUpCalls: this._followUpCalls,
      notes: this._notes,
      owner: this._owner,
      damageDetail: this._damageDetail,
      intentToClaim: this._intentToClaim,
      followUpDate: this._followUpDate,
      additionalNote: this._additionalNote,
      latitude: this._latitude,
      longitude: this._longitude,
    };
  }
}
