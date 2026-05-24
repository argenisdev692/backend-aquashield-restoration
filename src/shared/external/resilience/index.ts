/**
 * Public surface of the shared resilience layer.
 *
 * Only expose the factory and the profile type.
 * Never leak cockatiel types or internal config outside this folder.
 */

export { createExternalServicePolicy } from './resilience.factory';
export type { ExternalServiceProfile } from './resilience.types';
