import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { AvailabilityService, type TimeSlot, type DayAvailability } from './availability.service';
import { TimeSlotsQuerySchema, type TimeSlotsQueryDto } from './dto/time-slots-query.dto';
import { CalendarQuerySchema, type CalendarQueryDto } from './dto/calendar-query.dto';

/**
 * Public availability endpoints — no JWT required.
 * Throttled at 20 req/min per IP to prevent calendar scraping.
 */
@ApiTags('Availability (Public)')
@Controller('public/availability')
export class PublicAvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get('calendar')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOperation({
    summary: 'Get day-level availability for a calendar month',
    description:
      'Returns one entry per day in the requested month. ' +
      'Factors in weekly rules (is_available=false days) and date exceptions (holidays / closures). ' +
      'When serviceDuration is supplied, rule-open days with no slot surviving the ±7h appointment ' +
      "buffers are also returned as unavailable (reason 'full').",
  })
  @ApiQuery({ name: 'year', type: Number, example: 2026 })
  @ApiQuery({ name: 'month', type: Number, example: 6, description: '1–12' })
  @ApiQuery({
    name: 'serviceDuration',
    type: Number,
    required: false,
    example: 420,
    description: 'Optional duration in minutes (15–480). Enables day-level capacity checks.',
  })
  @ApiOkResponse({
    description: 'Array of { date: YYYY-MM-DD, available: boolean, reason?: string }',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async getCalendar(
    @Query(new ZodValidationPipe(CalendarQuerySchema)) query: CalendarQueryDto,
  ): Promise<DayAvailability[]> {
    return this.service.getCalendarAvailability(query);
  }

  @Get('time-slots')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @CacheTTL(TTL_SECONDS.SHORT)
  @ApiOperation({
    summary: 'Get available time slots for a specific date',
    description:
      'Returns available 30-minute-step slots for the given date and service duration. ' +
      'Excludes slots blocked by holidays, weekly rules, or existing appointments (±7h buffer).',
  })
  @ApiQuery({ name: 'date', type: String, example: '2026-07-10', description: 'YYYY-MM-DD in Houston time' })
  @ApiQuery({ name: 'serviceDuration', type: Number, example: 60, description: 'Duration in minutes (15–480)' })
  @ApiOkResponse({
    description: 'Array of { time: ISO string, formattedTime: "HH:mm" }',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async getTimeSlots(
    @Query(new ZodValidationPipe(TimeSlotsQuerySchema)) query: TimeSlotsQueryDto,
  ): Promise<TimeSlot[]> {
    return this.service.getTimeSlots(query);
  }
}
