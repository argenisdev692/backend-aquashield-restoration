import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ParseFilePipeBuilder,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Action } from '../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../core/access/actions.enum';
import { CompanyDataService } from './companydata.service';
import { UpdateCompanyDataSchema } from './dto/update-companydata.dto';
import type { UpdateCompanyDataDto } from './dto/update-companydata.dto';
import { CompanyDataResponse } from './dto/companydata.response';

const SIGNATURE_MIME_REGEX = /^(image\/png|image\/jpeg|image\/webp)$/;
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

@ApiTags('company-data')
@ApiBearerAuth()
@Controller('company-data')
@UseGuards(JwtAuthGuard, CaslGuard)
export class CompanyDataController {
  constructor(private readonly service: CompanyDataService) {}

  @Get()
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse({ description: 'Company data not found' })
  @CacheTTL(TTL_SECONDS.LONG)
  @CheckAbilities({ action: Action.Read, subject: 'COMPANY' })
  async findSingleton(): Promise<CompanyDataResponse> {
    return this.service.findSingletonOrFail();
  }

  @Get('me')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse({ description: 'Company data not found' })
  @CacheTTL(TTL_SECONDS.LONG)
  @CheckAbilities({ action: Action.Read, subject: 'COMPANY' })
  async getMyCompanyData(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyDataResponse> {
    return this.service.findByUserIdOrFail(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.LONG)
  @CheckAbilities({ action: Action.Read, subject: 'COMPANY' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyDataResponse> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'COMPANY' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCompanyDataSchema))
    dto: UpdateCompanyDataDto,
  ): Promise<CompanyDataResponse> {
    return this.service.update(id, dto);
  }

  @Post(':id/signature')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Invalid file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @UseInterceptors(FileInterceptor('file'))
  @CheckAbilities({ action: Action.Update, subject: 'COMPANY' })
  async uploadSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: SIGNATURE_MIME_REGEX })
        .addMaxSizeValidator({ maxSize: SIGNATURE_MAX_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ): Promise<CompanyDataResponse> {
    return this.service.uploadSignature(id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Delete(':id/signature')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'COMPANY' })
  async deleteSignature(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyDataResponse> {
    return this.service.deleteSignature(id);
  }
}
