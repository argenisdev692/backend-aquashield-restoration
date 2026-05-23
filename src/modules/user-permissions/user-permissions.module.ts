import { Module } from '@nestjs/common';
import { UserPermissionsController } from './user-permissions.controller';
import { UserPermissionsService } from './user-permissions.service';
import { UserPermissionsRepository } from './user-permissions.repository';

@Module({
  controllers: [UserPermissionsController],
  providers: [UserPermissionsService, UserPermissionsRepository],
  exports: [UserPermissionsService, UserPermissionsRepository],
})
export class UserPermissionsModule {}
