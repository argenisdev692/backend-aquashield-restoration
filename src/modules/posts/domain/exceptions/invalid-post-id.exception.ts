import { PostDomainException } from './post-domain.exception';

export class InvalidPostIdException extends PostDomainException {
  constructor(value: string) {
    super(`Invalid PostId format: ${value}`);
  }
}
