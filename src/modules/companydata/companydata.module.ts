import { Global, Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { CompanyDataController } from './companydata.controller';
import { CompanyDataService } from './companydata.service';
import { CompanyDataRepository } from './companydata.repository';
import { CompanyBrandingService } from './company-branding.service';

/**
 * @Global so {@link CompanyBrandingService} (email brand-name resolution) is
 * injectable from any email sender without re-importing this module.
 */
@Global()
@Module({
  imports: [StorageModule, CacheModule],
  controllers: [CompanyDataController],
  providers: [CompanyDataService, CompanyDataRepository, CompanyBrandingService],
  exports: [CompanyDataService, CompanyBrandingService],
})
export class CompanyDataModule {}
