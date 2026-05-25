import { FunnelStage } from '../value-objects/funnel-stage.vo';

/**
 * Structured data returned by the stage export generator (Gemini).
 * This is the canonical shape the rest of the pipeline consumes.
 */
export interface GeneratedScript {
  narration: string;
  overlayTexts: string[];
  cta: string;
}

export interface GeneratedScene {
  id: number;
  timecode: string;
  title: string;
  visualDescription: string; // English, optimized for image gen
  imageKeywords: string[];
  durationSeconds: number;
}

export interface ProductionNotes {
  specs916: string;
  specs169: string;
  musicTone: string;
  colorPalette: string[];
  transitionStyle: string;
}

export interface GeneratedStageContent {
  stage: FunnelStage;
  scripts: {
    vertical_916: GeneratedScript;
    horizontal_169: GeneratedScript;
  };
  scenes: GeneratedScene[];
  productionNotes: ProductionNotes;
}

/**
 * Input required to generate the full stage content.
 */
export interface GenerateStageExportInput {
  companyName: string; // immutable snapshot resolved from CompanyData at request time
  niche: string;
  location: string;
  phone: string;
  website?: string;
  stage: FunnelStage;
  format: '9:16' | '16:9' | 'both';
  durationSeconds: 15 | 20;
  language: string;
  generateImages: boolean;
  aiObservations?: string | null;
  viralityRecommendations?: string[];
}

/**
 * Port: Generates the creative content (scripts, scenes, production notes) for one funnel stage.
 * Implemented by Gemini adapter using AI_CLIENT.
 */
export interface IStageExportGeneratorPort {
  generate(input: GenerateStageExportInput): Promise<GeneratedStageContent>;
}

export const STAGE_EXPORT_GENERATOR_PORT = Symbol('IStageExportGeneratorPort');
