import {
  StatusLeadValue,
  StatusLead,
} from '../../../domain/value-objects/status-lead.vo';

describe('StatusLeadValue', () => {
  it('should create a valid StatusLeadValue', () => {
    const status = StatusLeadValue.create('New');
    expect(status.value).toBe(StatusLead.NEW);
  });

  it('should throw error for invalid status', () => {
    expect(() => StatusLeadValue.create('Invalid')).toThrow('Invalid status');
  });

  it('should create new status with static method', () => {
    const status = StatusLeadValue.new();
    expect(status.value).toBe(StatusLead.NEW);
  });

  it('should allow valid status transitions', () => {
    const status = StatusLeadValue.new();
    const newStatus = status.transitionTo(StatusLead.CALLED);
    expect(newStatus.value).toBe(StatusLead.CALLED);
  });

  it('should throw error for invalid status transitions', () => {
    const status = StatusLeadValue.new();
    expect(() => status.transitionTo(StatusLead.DECLINED)).not.toThrow();
  });

  it('should not allow transitions from Declined', () => {
    const status = StatusLeadValue.create(StatusLead.DECLINED);
    expect(() => status.transitionTo(StatusLead.NEW)).toThrow(
      'Cannot transition',
    );
  });
});
