import { Injectable } from '@nestjs/common';
import {
  IViralityResearchPort,
  ViralityResearchInput,
  ViralityResearchResult,
} from '../../../domain/ports/virality-research.port';

/**
 * STUB implementation for virality research.
 * Replace with real Tavily adapter that searches for similar campaigns and trends.
 */
@Injectable()
export class StubViralityResearchAdapter implements IViralityResearchPort {
  async research(input: ViralityResearchInput): Promise<ViralityResearchResult> {
    return {
      score: 72,
      trendingTopics: [
        `${input.niche} tendencias 2026`,
        `marketing digital para ${input.niche}`,
        `videos virales de ${input.niche} en ${input.location}`,
      ],
      similarCampaigns: [
        {
          title: `Campaña exitosa de ${input.niche} en redes sociales`,
          url: 'https://example.com/campaign1',
          snippet: `Estrategia de video marketing para ${input.niche} que generó alto engagement.`,
          engagementEstimate: 'high',
        },
        {
          title: `Tendencias de contenido para ${input.niche}`,
          url: 'https://example.com/campaign2',
          snippet: `Los videos cortos de ${input.niche} están dominando TikTok e Instagram.`,
          engagementEstimate: 'viral',
        },
      ],
      recommendations: [
        'Usar hooks emocionales en los primeros 3 segundos',
        'Incluir testimonios reales para aumentar credibilidad',
        'Aprovechar tendencias locales de ' + input.location,
      ],
      roiScore: 68,
      leadMetrics: {
        estimatedCpl: 12.5,
        estimatedConversionRate: 3.2,
        marketSize: 'large',
        competitiveness: 'medium',
        projectedLeadsPerMonth: 45,
      },
    };
  }
}
