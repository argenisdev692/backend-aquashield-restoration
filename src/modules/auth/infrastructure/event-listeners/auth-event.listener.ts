import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import {
  UserLoggedInEvent,
  OtpRequestedEvent,
  OtpVerifiedEvent,
  TwoFactorEnabledEvent,
  TwoFactorDisabledEvent,
  PasswordChangedEvent,
  NewDeviceLoginEvent,
} from '../../domain/events/auth-events';

@Injectable()
export class AuthEventListener {
  constructor(
    @Inject(EMAIL_PORT)
    private readonly email: IEmailPort,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuthEventListener.name);
  }

  @OnEvent('auth.login')
  handleUserLoggedIn(event: UserLoggedInEvent): void {
    this.logger.info('User logged in', {
      userId: event.userId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  @OnEvent('auth.otp_requested')
  handleOtpRequested(event: OtpRequestedEvent): void {
    this.logger.info('OTP requested', {
      userId: event.userId,
      type: event.type,
    });
  }

  @OnEvent('auth.otp_verified')
  handleOtpVerified(event: OtpVerifiedEvent): void {
    this.logger.info('OTP verified', {
      userId: event.userId,
      type: event.type,
    });
  }

  @OnEvent('auth.2fa_enabled')
  handleTwoFactorEnabled(event: TwoFactorEnabledEvent): void {
    this.logger.info('2FA enabled', { userId: event.userId });
  }

  @OnEvent('auth.2fa_disabled')
  handleTwoFactorDisabled(event: TwoFactorDisabledEvent): void {
    this.logger.info('2FA disabled', { userId: event.userId });
  }

  /**
   * Sends the "your password was changed" notification email. Fire-and-forget:
   * a Resend failure logs but never reverses the password change.
   */
  @OnEvent('auth.password_changed')
  async handlePasswordChanged(event: PasswordChangedEvent): Promise<void> {
    const { email, ipAddress, deviceLabel } = event.context;
    if (!email) {
      this.logger.warn('PasswordChangedEvent without email — skipping notification', {
        userId: event.userId,
      });
      return;
    }
    try {
      await this.email.sendPasswordChangedNotification({
        to: email,
        at: event.timestamp,
        ipAddress: ipAddress ?? null,
        deviceLabel: deviceLabel ?? null,
      });
    } catch (err) {
      this.logger.error('Failed to send password-changed notification', {
        userId: event.userId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Sends the "new device sign-in" alert. Triggered by the LoginUseCase /
   * VerifyTwoFactorChallengeUseCase when AuthTokenIssuer reports the device
   * fingerprint did not match any prior active session.
   */
  @OnEvent('auth.new_device_login')
  async handleNewDeviceLogin(event: NewDeviceLoginEvent): Promise<void> {
    try {
      await this.email.sendNewDeviceAlert({
        to: event.email,
        deviceLabel: event.deviceLabel,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        at: event.timestamp,
      });
    } catch (err) {
      this.logger.error('Failed to send new-device alert', {
        userId: event.userId,
        error: (err as Error).message,
      });
    }
  }
}
