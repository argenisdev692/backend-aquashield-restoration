import { SocialNetwork } from '../entities/social-media-generation.entity';

/**
 * Value Object: SocialNetwork
 * Ensures only valid networks are used and provides type-safe operations.
 */
export class SocialNetworkVO {
  private constructor(private readonly value: SocialNetwork) {}

  static create(network: string): SocialNetworkVO {
    const valid: SocialNetwork[] = ['facebook', 'instagram', 'tiktok', 'linkedin'];
    if (!valid.includes(network as SocialNetwork)) {
      throw new Error(`Invalid social network: ${network}`);
    }
    return new SocialNetworkVO(network as SocialNetwork);
  }

  getValue(): SocialNetwork {
    return this.value;
  }

  equals(other: SocialNetworkVO): boolean {
    return this.value === other.value;
  }
}
