import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { CompanyDataRepository } from './companydata.repository';
import type { CompanyData } from './companydata.entity';
import type { UpdateCompanyDataDto } from './dto/update-companydata.dto';
import { StorageService } from '../../shared/storage/storage.service';
import { CacheService } from '../../shared/cache/cache.service';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../shared/database/transaction-manager.port';

const SIGNATURE_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class CompanyDataService {
  private readonly signatureDirectory = 'company-signatures';
  /** Matches the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private readonly cacheKeyPattern = 'http:*:/company-data*';

  constructor(
    private readonly repository: CompanyDataRepository,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(CompanyDataService.name);
  }

  async findByUserId(userId: string): Promise<CompanyData | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.findByUserId', { traceId, userId });
    return this.repository.findByUserId(userId);
  }

  async findByUserIdOrFail(userId: string): Promise<CompanyData> {
    const result = await this.findByUserId(userId);
    if (!result) throw new NotFoundException('Company data not found');
    return result;
  }

  async findById(id: string): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.findById', { traceId, id });
    return this.findOrFail(id);
  }

  async findSingletonOrFail(): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.findSingletonOrFail', { traceId });
    const result = await this.repository.findFirst();
    if (!result) throw new NotFoundException('Company data not found');
    return result;
  }

  async update(id: string, dto: UpdateCompanyDataDto): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.update start', { traceId, id });
    await this.findOrFail(id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, dto);
      await this.audit.log(
        {
          action: 'companydata.updated',
          resourceType: 'COMPANY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('CompanyDataService.update end', { traceId, id });
    return result;
  }

  async uploadSignature(
    companyDataId: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.uploadSignature start', {
      traceId,
      companyDataId,
    });

    const existing = await this.findOrFail(companyDataId);

    const ext = SIGNATURE_EXTENSION_BY_MIME[file.mimeType] ?? 'bin';
    const key = `${this.signatureDirectory}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimeType);

    let result: CompanyData;
    try {
      result = await this.tx.runInTx(async () => {
        const row = await this.repository.update(companyDataId, {
          signaturePath: this.storage.publicUrl(key),
        });
        await this.audit.log(
          {
            action: 'companydata.signature_uploaded',
            resourceType: 'COMPANY',
            resourceId: companyDataId,
          },
          { strict: true },
        );
        return row;
      });
    } catch (error) {
      // DB tx rolled back — also rollback the R2 blob we just uploaded.
      await this.deleteSignatureFileByKey(key);
      throw error;
    }

    if (existing.signaturePath) {
      await this.deleteSignatureFile(existing.signaturePath);
    }

    await this.invalidateCache();
    this.logger.info('CompanyDataService.uploadSignature end', {
      traceId,
      companyDataId,
    });
    return result;
  }

  async deleteSignature(companyDataId: string): Promise<CompanyData> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CompanyDataService.deleteSignature start', {
      traceId,
      companyDataId,
    });

    const existing = await this.findOrFail(companyDataId);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(companyDataId, {
        signaturePath: null,
      });
      await this.audit.log(
        {
          action: 'companydata.signature_deleted',
          resourceType: 'COMPANY',
          resourceId: companyDataId,
        },
        { strict: true },
      );
      return row;
    });

    if (existing.signaturePath) {
      await this.deleteSignatureFile(existing.signaturePath);
    }

    await this.invalidateCache();
    this.logger.info('CompanyDataService.deleteSignature end', {
      traceId,
      companyDataId,
    });
    return result;
  }

  private async findOrFail(id: string): Promise<CompanyData> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Company data not found');
    return result;
  }

  /** Drops every cached company-data GET response after a mutation. */
  private async invalidateCache(): Promise<void> {
    await this.cache.delByPattern(this.cacheKeyPattern);
  }

  private async deleteSignatureFile(signaturePath: string): Promise<void> {
    try {
      const key = this.storage.keyFromUrl(signaturePath);
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to delete signature file from storage', {
        traceId,
        error,
      });
    }
  }

  private async deleteSignatureFileByKey(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to rollback uploaded signature file', {
        traceId,
        key,
        error,
      });
    }
  }
}
