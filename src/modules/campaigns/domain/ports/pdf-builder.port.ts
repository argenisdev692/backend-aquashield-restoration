import { GeneratedStageContent } from './stage-export-generator.port';

/**
 * Input for building the production brief PDF.
 */
export interface BuildProductionBriefInput {
  generationId: string;
  companyName: string; // snapshot from CompanyData at request time
  niche: string;
  stage: string;
  format: '9:16' | '16:9' | 'both';
  durationSeconds: 15 | 20;
  content: GeneratedStageContent;
  images: Map<number, Buffer | null>;
  generateImages: boolean;
}

/**
 * Port: Builds the production_brief.pdf (one page per format) as an in-memory Buffer.
 * Implementation uses pdfkit (already in the project).
 */
export interface IPdfBuilderPort {
  build(input: BuildProductionBriefInput): Promise<Buffer>;
}

export const PDF_BUILDER_PORT = Symbol('IPdfBuilderPort');
