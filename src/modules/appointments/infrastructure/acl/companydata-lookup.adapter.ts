import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CompanyDataService } from '../../../companydata/companydata.service';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  AppointmentCompanyInfo,
  ICompanyDataLookupPort,
} from '../../domain/ports/outbound/company-data-lookup.port.interface';

/**
 * ACL adapter → companydata bounded context.
 *
 * Reads the platform CompanyData singleton and projects only the footer/
 * branding fields the appointment email templates need. Never throws: a
 * missing company record degrades the email to its default branding rather
 * than aborting a fire-and-forget notification.
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

  async getCompanyInfo(): Promise<AppointmentCompanyInfo | null> {
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
      this.logger.warn('CompanyData singleton unavailable for email footer', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
