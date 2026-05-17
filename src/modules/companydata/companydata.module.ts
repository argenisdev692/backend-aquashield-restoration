import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CompanyDataController } from './companydata.controller';
import { CompanyDataService } from './companydata.service';
import { CompanyDataRepository } from './companydata.repository';

@Module({
  imports: [StorageModule],
  controllers: [CompanyDataController],
  providers: [CompanyDataService, CompanyDataRepository],
  exports: [CompanyDataService],
})
export class CompanyDataModule {}
