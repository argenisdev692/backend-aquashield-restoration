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
  PublicCreateAppointmentDto,
  PublicCreateAppointmentSchema,
} from '../../../application/dtos/public-create-appointment.dto';
import { CreateAppointmentUseCase } from '../../../application/use-cases/create-appointment.use-case';
import { CreateAppointmentResponse } from '../presenters/create-appointment.response';

/**
 * Public appointment submission — no JWT required.
 *
 * Anti-spam stack (layered, in order):
 *   1. Global ThrottlerGuard (IP, 100 req/min) — always active via APP_GUARD.
 *   2. @Throttle override  — tightens the limit to 3 requests per minute per IP.
 *   3. SpamFilterGuard     — rejects messages containing spam keywords or >1 URL.
 */
@ApiTags('public')
@Controller('public/appointments')
export class PublicAppointmentsController {
  constructor(private readonly createAppointment: CreateAppointmentUseCase) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @UseGuards(SpamFilterGuard)
  @ApiCreatedResponse({
    type: CreateAppointmentResponse,
    description: 'Appointment submitted',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or prohibited content detected',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded — try again in 60 seconds',
  })
  @ApiForbiddenResponse({ description: 'Submission rejected as spam' })
  async submit(
    @Body(new ZodValidationPipe(PublicCreateAppointmentSchema))
    dto: PublicCreateAppointmentDto,
  ): Promise<CreateAppointmentResponse> {
    const id = await this.createAppointment.execute({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      address: dto.address,
      address2: dto.address2 ?? null,
      city: dto.city,
      state: dto.state,
      zipcode: dto.zipcode,
      country: dto.country,
      message: dto.message ?? null,
      smsConsent: dto.smsConsent,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      registrationDate: null,
      statusLead: null,
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
    });
    return { id };
  }
}
