import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../logger/logger.service';
import { CompanyDataService } from './companydata.service';

/**
 * Single source of truth for the brand/company name shown in email templates.
 *
 * Resolution order (never a hardcoded brand literal):
 *   1. The CompanyData singleton (`companyName`) — the deployment's own record.
 *   2. The `COMPANY_NAME` env var — configurable per deployment.
 *
 * Exposed from the (global) CompanyDataModule so every email sender — auth,
 * appointments, contact-support, retell-calls — resolves the name the same way.
 * Never throws: a missing CompanyData record degrades to the env fallback.
 */
@Injectable()
export class CompanyBrandingService {
  private readonly fallbackName: string;

  constructor(
    private readonly companyData: CompanyDataService,
    config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CompanyBrandingService.name);
    // The fallback brand name comes from the validated env (EnvSchema defaults
    // COMPANY_NAME to 'Company'). `getOrThrow` keeps the Zod schema as the
    // single source of the default — no brand literal duplicated here.
    this.fallbackName = config.getOrThrow<string>('COMPANY_NAME');
  }

  /** Configured fallback brand name (`COMPANY_NAME` env). */
  getFallbackName(): string {
    return this.fallbackName;
  }

  /**
   * Normalises a company name already loaded by the caller, falling back to the
   * `COMPANY_NAME` env when it is blank. Use this when the module has ALREADY
   * fetched the CompanyData record (appointments / retell) to avoid a second DB
   * read.
   */
  resolveName(rawName?: string | null): string {
    const trimmed = rawName?.trim();
    return trimmed ? trimmed : this.fallbackName;
  }

  /**
   * Effective company display name: the CompanyData singleton's name when
   * configured, otherwise the env fallback. Use this when the caller does NOT
   * already hold a CompanyData record (auth / contact-support).
   */
  async getCompanyName(): Promise<string> {
    try {
      const company = await this.companyData.findSingletonOrFail();
      return this.resolveName(company.companyName);
    } catch (error) {
      this.logger.warn(
        'CompanyData unavailable — using COMPANY_NAME fallback for email branding',
        {
          traceId: this.cls.get<string>('traceId'),
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return this.fallbackName;
    }
  }
}
