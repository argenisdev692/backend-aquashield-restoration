import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SpamFilterGuard } from '../../../../../core/guards/spam-filter.guard';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import {
  CreateContactSupportDto,
  CreateContactSupportSchema,
} from '../../../application/dtos/create-contact-support.dto';
import { CreateContactSupportUseCase } from '../../../application/use-cases/create-contact-support.use-case';
import { CreateContactSupportResponse } from '../presenters/contact-support.response';

/**
 * Public contact-support submission — no JWT required.
 *
 * Anti-spam stack (layered, in order):
 *   1. Global ThrottlerGuard (IP, 100 req/min) — always active via APP_GUARD.
 *   2. @Throttle override  — tightens the limit to 3 requests per minute per IP.
 *   3. SpamFilterGuard     — rejects messages containing spam keywords or >1 URL.
 */
@ApiTags('Public')
@Controller('public/contact-support')
export class PublicContactSupportController {
  constructor(private readonly createUseCase: CreateContactSupportUseCase) {}

  @Post()
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  @UseGuards(SpamFilterGuard)
  @ApiCreatedResponse({
    type: CreateContactSupportResponse,
    description: 'Contact-support request submitted',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or prohibited content detected',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded — try again in 60 seconds',
  })
  @ApiForbiddenResponse({ description: 'Submission rejected as spam' })
  async submit(
    @Body(new ZodValidationPipe(CreateContactSupportSchema))
    dto: CreateContactSupportDto,
  ): Promise<CreateContactSupportResponse> {
    const id = await this.createUseCase.execute(dto);
    return { id };
  }
}
