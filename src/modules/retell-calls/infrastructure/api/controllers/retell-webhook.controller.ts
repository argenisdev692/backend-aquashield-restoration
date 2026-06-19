import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { RetellSignatureGuard } from '../guards/retell-signature.guard';
import {
  RetellWebhookDto,
  RetellWebhookSchema,
} from '../../../application/dtos/retell-webhook.dto';
import { IngestCallWebhookUseCase } from '../../../application/use-cases/ingest-call-webhook.use-case';

/**
 * Public Retell webhook sink — no JWT. Authenticity is proven by the
 * `x-retell-signature` HMAC ({@link RetellSignatureGuard}). Acks fast (≤10s
 * Retell timeout); side-effects (email, WS) run asynchronously via events.
 */
@ApiTags('Retell Calls')
@Controller('retell/webhook')
export class RetellWebhookController {
  constructor(private readonly ingest: IngestCallWebhookUseCase) {}

  @Post()
  @HttpCode(200)
  @UseGuards(RetellSignatureGuard)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @ApiExcludeEndpoint()
  @ApiOkResponse({ schema: { example: { received: true } } })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook signature' })
  @ApiBadRequestResponse({ description: 'Malformed payload' })
  async handle(
    @Body(new ZodValidationPipe(RetellWebhookSchema)) dto: RetellWebhookDto,
  ): Promise<{ received: true }> {
    await this.ingest.execute(dto);
    return { received: true };
  }
}
