import { Injectable } from '@nestjs/common';
import {
  IStageExportGeneratorPort,
  GenerateStageExportInput,
  GeneratedStageContent,
} from '../../../domain/ports/stage-export-generator.port';

/**
 * STUB implementation for development / skeleton.
 * Replace with real Gemini adapter that calls AI_CLIENT + research if needed.
 */
@Injectable()
export class StubStageExportGeneratorAdapter implements IStageExportGeneratorPort {
  async generate(input: GenerateStageExportInput): Promise<GeneratedStageContent> {
    const stage = input.stage;

    return {
      stage,
      scripts: {
        vertical_916: {
          narration: `[STUB] Narración 9:16 para ${stage} - ${input.companyName} en ${input.niche}. Llama al ${input.phone}.`,
          overlayTexts: ['Descubre más', 'Calidad garantizada'],
          cta: 'Llámanos hoy',
        },
        horizontal_169: {
          narration: `[STUB] Narración 16:9 para ${stage} - ${input.companyName}. Soluciones en ${input.location}.`,
          overlayTexts: ['Expertos locales', 'Resultados reales'],
          cta: 'Agenda tu cita',
        },
      },
      scenes: [
        { id: 1, timecode: '0:00-0:04', title: 'Apertura', visualDescription: 'Professional setting for a business in niche ' + input.niche, imageKeywords: ['business', 'professional'], durationSeconds: 4 },
        { id: 2, timecode: '0:04-0:08', title: 'Problema', visualDescription: 'Customer facing a common pain point', imageKeywords: ['problem', 'solution'], durationSeconds: 4 },
        { id: 3, timecode: '0:08-0:12', title: 'Solución', visualDescription: 'Our service solving the issue', imageKeywords: ['solution', 'happy'], durationSeconds: 4 },
        { id: 4, timecode: '0:12-0:15', title: 'CTA', visualDescription: 'Clear call to action with phone number', imageKeywords: ['call', 'contact'], durationSeconds: 3 },
      ],
      productionNotes: {
        specs916: '1080x1920 · 60fps · subtítulos centrados',
        specs169: '1920x1080 · 30fps · lower thirds',
        musicTone: 'Uplifting corporate',
        colorPalette: ['#1E3A8A', '#0EA5E9', '#F97316'],
        transitionStyle: 'Smooth cross-dissolve',
      },
    };
  }
}
