import { Appointment } from '../../../domain/entities/appointment.aggregate';

describe('Appointment', () => {
  it('should create a valid Appointment', () => {
    const appointment = Appointment.create({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      address: '123 Main St',
      address2: 'Apt 4B',
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701',
      country: 'USA',
      message: 'Test message',
      smsConsent: true,
      registrationDate: new Date(),
      statusLead: 'New',
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
      latitude: 40.7128,
      longitude: -74.006,
    });

    expect(appointment.firstName).toBe('John');
    expect(appointment.lastName).toBe('Doe');
    expect(appointment.phone).toBe('+1234567890');
    expect(appointment.email).toBe('john@example.com');
    expect(appointment.statusLeadValue).toBe('New');
  });

  it('should update status', () => {
    const appointment = Appointment.create({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: null,
      address: '123 Main St',
      address2: null,
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701',
      country: 'USA',
      message: null,
      smsConsent: false,
      registrationDate: null,
      statusLead: 'New',
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
      latitude: null,
      longitude: null,
    });

    const statusChange = appointment.updateStatus('Called');
    expect(statusChange.oldStatus).toBe('New');
    expect(statusChange.newStatus).toBe('Called');
    expect(appointment.statusLeadValue).toBe('Called');
  });

  it('should update details', () => {
    const appointment = Appointment.create({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: null,
      address: '123 Main St',
      address2: null,
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701',
      country: 'USA',
      message: null,
      smsConsent: false,
      registrationDate: null,
      statusLead: 'New',
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
      latitude: null,
      longitude: null,
    });

    appointment.updateDetails({
      firstName: 'Jane',
      notes: 'Updated notes',
    });

    expect(appointment.firstName).toBe('Jane');
    expect(appointment.notes).toBe('Updated notes');
  });

  it('should convert to plain object', () => {
    const appointment = Appointment.create({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      address: '123 Main St',
      address2: null,
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701',
      country: 'USA',
      message: null,
      smsConsent: false,
      registrationDate: null,
      statusLead: 'New',
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
      latitude: null,
      longitude: null,
    });

    const plain = appointment.toPlain();
    expect(plain.firstName).toBe('John');
    expect(plain.lastName).toBe('Doe');
    expect(plain.statusLead).toBe('New');
  });
});
