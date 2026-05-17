export class UserDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDomainException';
  }
}

export class UserNotFoundException extends UserDomainException {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundException';
  }
}

export class EmailAlreadyExistsException extends UserDomainException {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
    this.name = 'EmailAlreadyExistsException';
  }
}
