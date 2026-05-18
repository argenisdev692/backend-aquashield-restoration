import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { CompanyDataRepository } from './companydata.repository';
import type { CompanyData } from './companydata.entity';
import type { CreateCompanyDataDto } from './dto/create-companydata.dto';
import type { UpdateCompanyDataDto } from './dto/update-companydata.dto';
import { StorageService } from '../../shared/storage/storage.service';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { AUDIT_PORT, type IAuditPort } from '../../shared/activity-log/audit.port';

@Injectable()
export class CompanyDataService {
  private readonly signatureDirectory = 'company-signatures';

  constructor(
    private readonly repository: CompanyDataRepository,
    private readonly storage: StorageService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
  ) {
    this.logger.setContext(CompanyDataService.name);
  }

  async findByUserId(userId: string): Promise<CompanyData | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.findByUserId', { traceId, userId });
    return this.repository.findByUserId(userId);
  }

  async findById(id: string): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.findById', { traceId, id });
    return this.findOrFail(id);
  }

  async create(userId: string, dto: CreateCompanyDataDto): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.create start', { traceId, userId });

    if (await this.repository.existsAny()) {
      throw new ConflictException('A company record already exists. Only one company registration is allowed.');
    }

    const result = await this.repository.create({ ...dto, userId });

    await this.audit.log({
      action: 'companydata.created',
      actorId: userId,
      resourceType: 'COMPANY',
      resourceId: result.id,
    });

    this.logger.info('CompanyDataService.create end', { traceId, companyDataId: result.id });
    return result;
  }

  async update(id: string, dto: UpdateCompanyDataDto): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.update start', { traceId, id });
    await this.findOrFail(id);
    const result = await this.repository.update(id, dto);

    await this.audit.log({
      action: 'companydata.updated',
      resourceType: 'COMPANY',
      resourceId: id,
    });

    this.logger.info('CompanyDataService.update end', { traceId, id });
    return result;
  }

  async delete(id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.delete start', { traceId, id });
    const existing = await this.findOrFail(id);
    if (existing.signaturePath) {
      await this.deleteSignatureFile(existing.signaturePath);
    }
    await this.repository.delete(id);

    await this.audit.log({
      action: 'companydata.deleted',
      resourceType: 'COMPANY',
      resourceId: id,
    });

    this.logger.info('CompanyDataService.delete end', { traceId, id });
  }

  async uploadSignature(
    companyDataId: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.uploadSignature start', { traceId, companyDataId });

    const existing = await this.findOrFail(companyDataId);

    if (existing.signaturePath) {
      await this.deleteSignatureFile(existing.signaturePath);
    }

    const ext = file.mimeType.split('/').at(1) ?? 'bin';
    const key = `${this.signatureDirectory}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimeType);

    const result = await this.repository.update(companyDataId, { signaturePath: this.storage.publicUrl(key) });

    await this.audit.log({
      action: 'companydata.signature_uploaded',
      resourceType: 'COMPANY',
      resourceId: companyDataId,
    });

    this.logger.info('CompanyDataService.uploadSignature end', { traceId, companyDataId });
    return result;
  }

  async deleteSignature(companyDataId: string): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.deleteSignature start', { traceId, companyDataId });

    const existing = await this.findOrFail(companyDataId);

    if (existing.signaturePath) {
      await this.deleteSignatureFile(existing.signaturePath);
    }

    const result = await this.repository.update(companyDataId, { signaturePath: null });

    await this.audit.log({
      action: 'companydata.signature_deleted',
      resourceType: 'COMPANY',
      resourceId: companyDataId,
    });

    this.logger.info('CompanyDataService.deleteSignature end', { traceId, companyDataId });
    return result;
  }

  private async findOrFail(id: string): Promise<CompanyData> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Company data not found');
    return result;
  }

  private async deleteSignatureFile(signaturePath: string): Promise<void> {
    try {
      const key = this.storage.keyFromUrl(signaturePath);
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to delete signature file from storage', { traceId, error });
    }
  }
}
