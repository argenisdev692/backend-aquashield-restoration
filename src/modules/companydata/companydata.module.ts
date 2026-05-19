import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { CompanyDataController } from './companydata.controller';
import { CompanyDataService } from './companydata.service';
import { CompanyDataRepository } from './companydata.repository';

@Module({
  imports: [StorageModule, CacheModule],
  controllers: [CompanyDataController],
  providers: [CompanyDataService, CompanyDataRepository],
  exports: [CompanyDataService],
})
export class CompanyDataModule {}
