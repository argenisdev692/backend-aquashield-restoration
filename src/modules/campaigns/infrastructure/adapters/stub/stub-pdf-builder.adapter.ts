import { Injectable } from '@nestjs/common';
import {
  IPdfBuilderPort,
  BuildProductionBriefInput,
} from '../../../domain/ports/pdf-builder.port';

/**
 * STUB PDF builder.
 * Replace with real pdfkit implementation that produces a multi-page
 * production brief with embedded images or placeholders.
 */
@Injectable()
export class StubPdfBuilderAdapter implements IPdfBuilderPort {
  async build(input: BuildProductionBriefInput): Promise<Buffer> {
    // Return a tiny valid PDF (minimal header) so the pipeline doesn't explode.
    // Real implementation will use pdfkit to generate proper timeline pages.
    const fakePdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n',
    );
    return fakePdf;
  }
}
