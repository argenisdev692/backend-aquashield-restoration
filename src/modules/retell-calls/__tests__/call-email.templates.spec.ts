import { renderNewCallEmail } from '../infrastructure/external-services/templates/call-email.templates';
import type { RetellCallReadModel } from '../domain/repositories/retell-call-repository.interface';
import type { RetellCallCompanyInfo } from '../domain/ports/outbound/company-data-lookup.port.interface';

const CALL: RetellCallReadModel = {
  id: 'rec-1',
  callId: 'call-1',
  agentId: null,
  callType: 'phone_call',
  direction: 'inbound',
  fromNumber: '12137771234',
  toNumber: '2137775555',
  callStatus: 'ended',
  disconnectionReason: null,
  startedAt: new Date('2026-06-01T10:00:00Z'),
  endedAt: null,
  durationMs: 12000,
  userSentiment: 'Positive',
  callSummary: 'Customer booked an inspection.',
  transcript: null,
  recordingUrl: 'https://recordings.retell/call-1.wav',
  isRead: false,
  createdAt: new Date('2026-06-01T10:00:11Z'),
  updatedAt: new Date('2026-06-01T10:00:11Z'),
  deletedAt: null,
};

const COMPANY: RetellCallCompanyInfo = {
  companyName: 'Aquashield Restoration',
  email: 'info@aquashield.test',
  phone: null,
  address: '1 Main St',
  website: null,
  facebookLink: null,
  instagramLink: null,
  linkedinLink: null,
  twitterLink: null,
};

describe('renderNewCallEmail', () => {
  it('renders the new-call subject and recording button', () => {
    const { subject, html } = renderNewCallEmail({
      call: CALL,
      company: COMPANY,
    });

    expect(subject).toContain('New Call Recorded');
    expect(html).toContain('Listen to Recording');
    expect(html).toContain(CALL.recordingUrl);
    expect(html).toContain('Aquashield Restoration');
    // phone formatted to (XXX) XXX-XXXX
    expect(html).toContain('(213) 777-1234');
    expect(html).toContain('Customer booked an inspection.');
  });

  it('omits the recording button when no recording is available', () => {
    const { html } = renderNewCallEmail({
      call: { ...CALL, recordingUrl: null },
      company: COMPANY,
    });
    expect(html).not.toContain('Listen to Recording');
  });
});
