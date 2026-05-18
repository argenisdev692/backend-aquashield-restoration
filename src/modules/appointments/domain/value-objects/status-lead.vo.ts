export enum StatusLead {
  NEW = 'New',
  CALLED = 'Called',
  PENDING = 'Pending',
  DECLINED = 'Declined',
}

export class StatusLeadValue {
  private constructor(public readonly value: StatusLead) {}

  static create(value: string): StatusLeadValue {
    const validStatuses = Object.values(StatusLead);
    if (!validStatuses.includes(value as StatusLead)) {
      throw new Error(
        `Invalid status: ${value}. Must be one of: ${validStatuses.join(', ')}`,
      );
    }
    return new StatusLeadValue(value as StatusLead);
  }

  static new(): StatusLeadValue {
    return new StatusLeadValue(StatusLead.NEW);
  }

  transitionTo(newStatus: StatusLead): StatusLeadValue {
    // Business rule: status transition validation
    const validTransitions: Record<StatusLead, StatusLead[]> = {
      [StatusLead.NEW]: [
        StatusLead.CALLED,
        StatusLead.PENDING,
        StatusLead.DECLINED,
      ],
      [StatusLead.CALLED]: [StatusLead.PENDING, StatusLead.DECLINED],
      [StatusLead.PENDING]: [StatusLead.CALLED, StatusLead.DECLINED],
      [StatusLead.DECLINED]: [],
    };

    const allowed = validTransitions[this.value];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.value} to ${newStatus}. Allowed transitions: ${allowed.join(', ')}`,
      );
    }

    return new StatusLeadValue(newStatus);
  }
}
