import { Global, Module } from '@nestjs/common';
import { SecretCipher } from './secret-cipher.service';

/**
 * Global crypto module — exposes {@link SecretCipher} for at-rest secret
 * encryption (TOTP seeds, etc.) to any module without re-providing it.
 */
@Global()
@Module({
  providers: [SecretCipher],
  exports: [SecretCipher],
})
export class CryptoModule {}
