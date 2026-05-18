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
  HttpCode,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { Action } from '../../core/access/actions.enum';
import { CompanyDataService } from './companydata.service';
import { CreateCompanyDataSchema } from './dto/create-companydata.dto';
import type { CreateCompanyDataDto } from './dto/create-companydata.dto';
import { UpdateCompanyDataSchema } from './dto/update-companydata.dto';
import type { UpdateCompanyDataDto } from './dto/update-companydata.dto';
import { CompanyDataResponse } from './companydata.entity';

@ApiTags('company-data')
@ApiBearerAuth()
@Controller('company-data')
@UseGuards(JwtAuthGuard, CaslGuard)
export class CompanyDataController {
  constructor(private readonly service: CompanyDataService) {}

  @Get('me')
  @ApiOkResponse({ type: CompanyDataResponse })
  @ApiNotFoundResponse({ description: 'Company data not found' })
  @CacheTTL(TTL_SECONDS.LONG)
  @CheckAbilities({ action: Action.Read, subject: 'COMPANY' })
  async getMyCompanyData(
    @Req() req: { user: { id: string } },
  ): Promise<CompanyDataResponse> {
    const result = await this.service.findByUserId(req.user.id);
    if (!result) throw new NotFoundException('Company data not found');
    return result;
  }

  @Post()
  @ApiCreatedResponse({ type: CompanyDataResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Company data already exists' })
  @CheckAbilities({ action: Action.Create, subject: 'COMPANY' })
  async create(
    @Req() req: { user: { id: string } },
    @Body(new ZodValidationPipe(CreateCompanyDataSchema)) dto: CreateCompanyDataDto,
  ): Promise<CompanyDataResponse> {
    return this.service.create(req.user.id, dto);
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
    @Body(new ZodValidationPipe(UpdateCompanyDataSchema)) dto: UpdateCompanyDataDto,
  ): Promise<CompanyDataResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'COMPANY' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file: Express.Multer.File, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  @CheckAbilities({ action: Action.Update, subject: 'COMPANY' })
  async uploadSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CompanyDataResponse> {
    if (!file) {
      throw new BadRequestException('No file provided or invalid file type. Allowed: png, jpeg, webp (max 2 MB)');
    }
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
