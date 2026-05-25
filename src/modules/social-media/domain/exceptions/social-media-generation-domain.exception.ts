/**
 * Domain Exception for Social Media Generation invariants.
 * Thrown when business rules are violated inside the Aggregate or Value Objects.
 */
export class SocialMediaGenerationDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialMediaGenerationDomainException';
  }
}
