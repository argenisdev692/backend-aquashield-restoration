export class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class OtpRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly type: 'login' | 'email_verify' | 'password_reset',
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class OtpVerifiedEvent {
  constructor(
    public readonly userId: string,
    public readonly type: 'login' | 'email_verify' | 'password_reset',
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TwoFactorEnabledEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TwoFactorDisabledEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class EmailVerifiedEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PasswordResetEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class GoogleAuthEvent {
  constructor(
    public readonly userId: string,
    public readonly isNewUser: boolean,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
    public readonly context: {
      email?: string;
      ipAddress?: string | null;
      deviceLabel?: string | null;
    } = {},
  ) {}
}

export class NewDeviceLoginEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly deviceLabel: string | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly timestamp: Date = new Date(),
  ) {}
}
