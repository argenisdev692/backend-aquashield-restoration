import { Global, Module } from '@nestjs/common';
import { ExportService } from './export.service';

/**
 * Global export module — exposes {@link ExportService} so any module can
 * generate XLSX / CSV without re-providing ExcelJS plumbing.
 */
@Global()
@Module({
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
