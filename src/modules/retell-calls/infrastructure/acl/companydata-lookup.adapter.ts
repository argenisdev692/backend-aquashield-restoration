import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CompanyDataService } from '../../../companydata/companydata.service';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  ICompanyDataLookupPort,
  RetellCallCompanyInfo,
} from '../../domain/ports/outbound/company-data-lookup.port.interface';

/**
 * ACL adapter → companydata bounded context. Reads the platform CompanyData
 * singleton and projects the inbox + branding the new-call email needs.
 * Never throws: a missing company record degrades the notification to its
 * default branding rather than aborting a fire-and-forget email.
 */
@Injectable()
export class CompanyDataLookupAdapter implements ICompanyDataLookupPort {
  constructor(
    private readonly companyData: CompanyDataService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CompanyDataLookupAdapter.name);
  }

  async getCompanyInfo(): Promise<RetellCallCompanyInfo | null> {
    const traceId = this.cls.get<string>('traceId');
    try {
      const company = await this.companyData.findSingletonOrFail();
      return {
        companyName: company.companyName,
        email: company.email,
        phone: company.phone,
        address: company.address,
        website: company.website,
        facebookLink: company.facebookLink,
        instagramLink: company.instagramLink,
        linkedinLink: company.linkedinLink,
        twitterLink: company.twitterLink,
      };
    } catch (error) {
      this.logger.warn('CompanyData singleton unavailable for new-call email', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
