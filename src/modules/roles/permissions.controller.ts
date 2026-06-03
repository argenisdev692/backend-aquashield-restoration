import { Controller, Get, UseGuards } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { Action } from '../../core/access/actions.enum';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { RolesService } from './roles.service';
import { PermissionResponseDto } from './dto/role-response.dto';
import type { Permission } from './roles.entity';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, CaslGuard)
export class PermissionsController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @ApiOkResponse({ type: [PermissionResponseDto] })
  @CacheTTL(TTL_SECONDS.LONG)
  @CheckAbilities({ action: Action.Read, subject: 'PERMISSION' })
  async findAll(): Promise<Permission[]> {
    return this.service.findAllPermissions();
  }
}
