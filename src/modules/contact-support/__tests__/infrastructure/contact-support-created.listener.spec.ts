import { ContactSupportCreatedListener } from '../../infrastructure/event-listeners/contact-support-created.listener';
import { ContactSupportCreatedEvent } from '../../domain/events/contact-support-created.domain-event';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';

const ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function deps() {
  const entity = ContactSupport.create(
    ID,
    'John',
    'Doe',
    'john@acme.com',
    '+1-555-0100',
    'Need help',
    'help me',
    false,
  );
  const repo = {
    findById: jest.fn().mockResolvedValue(entity),
    findByIdWithDeleted: jest.fn(),
    save: jest.fn(),
    findReadModelById: jest.fn(),
    findMany: jest.fn(),
    findAllForExport: jest.fn(),
    bulkDelete: jest.fn(),
    bulkRestore: jest.fn(),
  };
  const email = {
    notifyAdminsNewRequest: jest.fn().mockResolvedValue(undefined),
    sendSubmissionConfirmation: jest.fn().mockResolvedValue(undefined),
  };
  const adminRecipients = {
    getAdminRecipientEmails: jest
      .fn()
      .mockResolvedValue(['boss@acme.com', 'admin@acme.com']),
  };
  const gateway = {
    broadcastNewRequest: jest.fn(),
    broadcastRequestRead: jest.fn(),
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  };
  const cls = { get: jest.fn().mockReturnValue('trace-id') };
  const listener = new ContactSupportCreatedListener(
    repo,
    email,
    adminRecipients,
    gateway as never,
    logger as never,
    cls as never,
  );
  return { listener, repo, email, adminRecipients, gateway, logger };
}

describe('ContactSupportCreatedListener', () => {
  it('notifies all admin/super-admin recipients (with subject) and confirms to the sender', async () => {
    const { listener, email, adminRecipients, gateway } = deps();

    await listener.handle(new ContactSupportCreatedEvent(ID));

    expect(adminRecipients.getAdminRecipientEmails).toHaveBeenCalledTimes(1);
    expect(email.notifyAdminsNewRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmails: ['boss@acme.com', 'admin@acme.com'],
        requestId: ID,
        fromName: 'John Doe',
        fromEmail: 'john@acme.com',
        subject: 'Need help',
      }),
    );
    expect(email.sendSubmissionConfirmation).toHaveBeenCalledWith({
      toEmail: 'john@acme.com',
      toName: 'John',
      subject: 'Need help',
    });
    expect(gateway.broadcastNewRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, firstName: 'John', lastName: 'Doe' }),
    );
  });

  it('swallows email failures but still broadcasts (idempotent side effects)', async () => {
    const { listener, email, gateway, logger } = deps();
    email.notifyAdminsNewRequest.mockRejectedValue(new Error('resend down'));

    await listener.handle(new ContactSupportCreatedEvent(ID));

    expect(logger.error).toHaveBeenCalled();
    expect(email.sendSubmissionConfirmation).toHaveBeenCalledTimes(1);
    expect(gateway.broadcastNewRequest).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the request is not found', async () => {
    const { listener, repo, email, gateway } = deps();
    repo.findById.mockResolvedValue(null);

    await listener.handle(new ContactSupportCreatedEvent(ID));

    expect(email.notifyAdminsNewRequest).not.toHaveBeenCalled();
    expect(email.sendSubmissionConfirmation).not.toHaveBeenCalled();
    expect(gateway.broadcastNewRequest).not.toHaveBeenCalled();
  });
});
