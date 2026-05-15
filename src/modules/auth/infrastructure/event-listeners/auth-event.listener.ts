import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import {
  UserLoggedInEvent,
  OtpRequestedEvent,
  OtpVerifiedEvent,
  TwoFactorEnabledEvent,
  TwoFactorDisabledEvent,
} from '../../domain/events/auth-events';

@Injectable()
export class AuthEventListener {
  constructor(private readonly logger: LoggerService) {
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
}
