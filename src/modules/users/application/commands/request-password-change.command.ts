import type { RequestPasswordChangeInput } from '../dtos/request-password-change.dto';

export class RequestPasswordChangeCommand {
  constructor(public readonly dto: RequestPasswordChangeInput) {}
}
