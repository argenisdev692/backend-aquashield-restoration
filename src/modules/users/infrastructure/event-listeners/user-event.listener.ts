import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import type { UserCreatedEvent } from '../../domain/events/user-created.domain-event';
import type { PasswordSetupEvent } from '../../domain/events/password-setup.domain-event';
import type { PasswordChangedEvent } from '../../domain/events/password-changed.domain-event';

@Injectable()
export class UserEventListener {
  constructor(private readonly logger: LoggerService) {}

  @OnEvent('users.created')
  handleUserCreated(event: UserCreatedEvent): void {
    this.logger.info('User created event received', {
      userId: event.userId,
      email: event.email,
    });
  }

  @OnEvent('users.password_setup')
  handlePasswordSetup(event: PasswordSetupEvent): void {
    this.logger.info('Password setup event received', {
      userId: event.userId,
    });
  }

  @OnEvent('users.password_changed')
  handlePasswordChanged(event: PasswordChangedEvent): void {
    this.logger.info('Password changed event received', {
      userId: event.userId,
    });
  }
}
