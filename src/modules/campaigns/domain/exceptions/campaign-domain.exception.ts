/**
 * Base domain exception for the Campaigns bounded context.
 * All domain-specific errors should extend this.
 */
export abstract class CampaignDomainException extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when a CampaignGeneration is not found for the given id.
 */
export class CampaignGenerationNotFoundException extends CampaignDomainException {
  readonly code = 'CAMPAIGN_GENERATION_NOT_FOUND';

  constructor(id: string) {
    super(`Campaign generation not found: ${id}`);
  }
}

/**
 * Thrown when a transition to an invalid status is attempted.
 */
export class InvalidCampaignStatusTransitionException extends CampaignDomainException {
  readonly code = 'INVALID_CAMPAIGN_STATUS_TRANSITION';

  constructor(from: string, to: string) {
    super(`Cannot transition campaign status from "${from}" to "${to}"`);
  }
}

/**
 * Thrown when the export request contains invalid business rules (e.g. no stages).
 */
export class InvalidCampaignExportRequestException extends CampaignDomainException {
  readonly code = 'INVALID_CAMPAIGN_EXPORT_REQUEST';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when an external AI service (Gemini / ElevenLabs) fails in a way that
 * should surface as a domain-level recoverable error.
 */
export class ExternalAiServiceException extends CampaignDomainException {
  readonly code = 'EXTERNAL_AI_SERVICE_ERROR';

  constructor(service: string, details?: string) {
    super(
      `External AI service error (${service})${details ? `: ${details}` : ''}`,
    );
  }
}
