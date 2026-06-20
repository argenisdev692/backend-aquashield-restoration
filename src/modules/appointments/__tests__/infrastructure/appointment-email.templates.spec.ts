import {
  formatScheduleEs,
  formatUsPhone,
  renderAppointmentCancelledClientHtml,
  renderAppointmentConfirmedClientHtml,
  renderAppointmentRescheduledClientHtml,
  renderAppointmentScheduledInternalHtml,
} from '../../infrastructure/external-services/templates/appointment-email.templates';
import type { AppointmentEmailData } from '../../domain/ports/outbound/email.port.interface';
import type { AppointmentCompanyInfo } from '../../domain/ports/outbound/company-data-lookup.port.interface';

const appointment: AppointmentEmailData = {
  appointmentId: 'appt-1',
  firstName: 'John',
  lastName: 'Doe',
  phone: '5551234567',
  email: 'john@acme.test',
  address: '123 Main St',
  address2: null,
  city: 'Springfield',
  state: 'IL',
  zipcode: '62701',
  country: 'USA',
  insuranceProperty: true,
  smsConsent: false,
  message: null,
  notes: null,
  leadSource: 'Website',
  inspectionDate: new Date('2026-01-05T00:00:00.000Z'),
  inspectionTime: new Date('1970-01-01T10:00:00.000Z'),
};

const company: AppointmentCompanyInfo = {
  companyName: 'Aquashield Restoration LLC',
  email: 'info@aquashield.test',
  phone: '8005551212',
  address: '99 Water Way',
  website: 'https://aquashield.test',
  facebookLink: 'https://facebook.com/aquashield',
  instagramLink: null,
  linkedinLink: null,
  twitterLink: null,
};

describe('appointment-email templates', () => {
  describe('formatUsPhone', () => {
    it('formats a 10-digit number', () => {
      expect(formatUsPhone('5551234567')).toBe('(555) 123-4567');
    });
    it('strips the US country code', () => {
      expect(formatUsPhone('15551234567')).toBe('(555) 123-4567');
    });
    it('returns the original for non-standard lengths', () => {
      expect(formatUsPhone('+44 20 7946 0000')).toBe('+44 20 7946 0000');
    });
    it('returns empty for null', () => {
      expect(formatUsPhone(null)).toBe('');
    });
  });

  describe('formatScheduleEs', () => {
    it('merges date + time into a Spanish label with +3h end hint', () => {
      const label = formatScheduleEs(
        appointment.inspectionDate,
        appointment.inspectionTime,
      );
      expect(label).not.toBeNull();
      expect(label?.full).toContain('2026');
      expect(label?.full).toContain('a las');
      // 10:00 + 3h = 13:00 → 01:00 p. m.
      expect(label?.end).toMatch(/01:00/);
    });
    it('returns null without a date', () => {
      expect(formatScheduleEs(null, appointment.inspectionTime)).toBeNull();
    });
  });

  describe('client confirmed (ES)', () => {
    it('renders the Spanish heading, schedule and company name', () => {
      const html = renderAppointmentConfirmedClientHtml(appointment, company);
      expect(html).toContain('Su cita ha sido confirmada');
      expect(html).toContain('Confirmada');
      expect(html).toContain('Aquashield Restoration LLC');
      expect(html).toContain('John Doe');
    });
  });

  describe('client rescheduled (ES)', () => {
    it('shows previous and new schedule', () => {
      const html = renderAppointmentRescheduledClientHtml(
        appointment,
        company,
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('1970-01-01T09:00:00.000Z'),
      );
      expect(html).toContain('reprogramada');
      expect(html).toContain('Fecha y hora anterior');
    });
  });

  describe('client cancelled (ES)', () => {
    it('renders the cancellation notice', () => {
      const html = renderAppointmentCancelledClientHtml(appointment, company);
      expect(html).toContain('Su cita ha sido cancelada');
      expect(html).toContain('Cancelada');
    });
  });

  describe('internal scheduled (EN)', () => {
    it('escapes HTML in user-controlled fields', () => {
      const xss: AppointmentEmailData = {
        ...appointment,
        firstName: '<script>alert(1)</script>',
      };
      const html = renderAppointmentScheduledInternalHtml(xss, company);
      expect(html).toContain('New Appointment Confirmed');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('renders no hardcoded brand when company is null (name resolved upstream)', () => {
      const html = renderAppointmentScheduledInternalHtml(appointment, null);
      // The adapter resolves the name (CompanyData → COMPANY_NAME env) before
      // rendering; the template itself must never embed a hardcoded brand.
      expect(html).not.toContain('Aquashield Restoration LLC');
    });
  });
});
