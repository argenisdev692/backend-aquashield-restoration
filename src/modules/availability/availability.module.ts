import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { PublicAvailabilityController } from './public-availability.controller';
import { AvailabilityService } from './availability.service';
import { AvailabilityRepository } from './availability.repository';

@Module({
  controllers: [AvailabilityController, PublicAvailabilityController],
  providers: [AvailabilityService, AvailabilityRepository],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
