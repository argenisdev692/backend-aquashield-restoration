import { Injectable, Inject } from '@nestjs/common';
import { CompanyDataRepository } from '../../../companydata/companydata.repository';
import type { ICompanyDataLookupPort } from '../../domain/ports/outbound/company-data-lookup.port';

/**
 * Thin Anti-Corruption Layer adapter.
 *
 * Exposes only the minimal data the campaigns module needs (company name)
 * while hiding the full CompanyData entity and repository implementation details.
 */
@Injectable()
export class PrismaCompanyDataLookupAdapter implements ICompanyDataLookupPort {
  constructor(private readonly companyDataRepo: CompanyDataRepository) {}

  async getCompanyNameByIdForUser(
    companyDataId: string,
    userId: string,
  ): Promise<string | null> {
    const record = await this.companyDataRepo.findById(companyDataId);

    if (!record) return null;
    if (record.userId !== userId) return null; // strict ownership

    return record.companyName ?? null;
  }
}
