# Prompt para Generación de Campañas de Video — v2
**Flujo de 2 Pasos con Auto-Regeneración para Video + Audio ElevenLabs**

> **Principio central:** El sistema NUNCA retorna contenido al frontend hasta que TODOS los scores hayan superado sus thresholds mínimos. Internamente puede hacer N llamadas a Tavily + AI. El usuario solo ve el resultado cuando está listo.

---
Módulo CAMPAIGNS Creado
docs/AI-MODULES/CAMPAIGNS/:

campaigns-creator-v2.jsx - Frontend React component
Toggle AI/Manual
Selector de proveedor AI (Gemini/Claude/OpenAI)
Inputs geográficos: ciudad, state, country, dirección/localidad
Input ai_observacion: frase fija que debe incluirse en el guion
Selector formato: 9:16 (vertical) o 16:9 (horizontal)
Validación duración: 15-25 segundos máximo
PASO 1: Nicho + Location + ai_observacion → 10 Campaign Topics con análisis de mercado local
PASO 2: Selección de topic → Video completo con timeline, escenas, guion, imágenes, audio
5 scores con visualización
Botón Descargar ZIP (con script/, audio/, scenes/, production/)
prompt-campaigns-generator-v2.md - Backend prompt document
Flujo de 2 pasos con auto-regeneración
Loop de calidad (máx 5 iteraciones)
Tavily Research en cada iteración
Job Queue + WebSocket + Cronjob
Cache en Campaigns Module
Generación de ZIP con estructura alineada al módulo existente
Schema Prisma: CampaignGeneration + CampaignStageExport

Endpoints backend (ya implementados en módulo campaigns):

POST /api/campaigns/export
GET /api/campaigns/{id}

## Arquitectura del Flujo Completo

```
PASO 1: NICHO + LOCATION + AI_OBSERVACION → TAVILY RESEARCH → AI → 10 CAMPAIGN TOPICS CON SCORES
                                                                                    ↓
                                                                         Usuario elige 1 topic
                                                                                    ↓
PASO 2: ┌────────────────────────────────────────────────────────────────────────┐
        │  LOOP DE CALIDAD (máx. 5 iteraciones por campaña)                      │
        │                                                                          │
        │  [1] TAVILY RESEARCH (contexto fresco del topic +                      │
        │       datos geográficos de la localidad)                                 │
        │         ↓                                                                │
        │  [2] AI GENERA: video completo con                                      │
        │       - Guion narrado (15-25s) con frase fija de ai_observacion         │
        │       - 4 escenas con timecode (0:00-0:05, 0:05-0:10, etc.)            │
        │       - Imágenes por escena (Gemini Imagen)                              │
        │       - Audio ElevenLabs (narration_916.mp3, narration_169.mp3)          │
        │       - Timeline PDF con imágenes embebidas                              │
        │       - Análisis de mercado local + 5 scores                             │
        │         ↓                                                                │
        │  [3] EVALUAR SCORES                                                      │
        │       ¿Todos ≥ thresholds? → NO → refinar y volver                        │
        │                           → SÍ → salir del loop                          │
        └────────────────────────────────────────────────────────────────────────┘
                                      ↓
                    RETORNAR al frontend (solo cuando todos pasan)
```

### Formatos: 9:16 (vertical) · 16:9 (horizontal)
### Funnel Stages: TOFU · MOFU · BOFU · LOYALTY
### Scores evaluados: Local Market Fit · Virality Probability · ROI Potential · Audience Alignment · Trend Relevance
### Salida: Video script + Audio ElevenLabs + Imágenes Gemini + Timeline PDF + ZIP

---

## Thresholds Mínimos (todos deben cumplirse)

| Score | Threshold | Crítico |
|-------|-----------|---------|
| 🏙️ Local Market Fit | ≥ 75 | ✅ SÍ — bloquea publicación si falla |
| 🔥 Virality Probability | ≥ 70 | — |
| 💰 ROI Potential | ≥ 70 | — |
| 👥 Audience Alignment | ≥ 70 | — |
| 📈 Trend Relevance | ≥ 70 | — |

**Si CUALQUIER score está por debajo de su threshold → regenerar.**
**Máximo 5 iteraciones por campaña. Si tras 5 intentos no alcanza, retorna el mejor intento con flag `"quality_warning": true`.**

---

## PASO 1 — Generación de 10 Campaign Topics con Análisis Geográfico

### System Instruction (Paso 1)

```xml
<role>
You are a Senior Video Marketing Strategist with 10+ years of experience in local market analysis, geographic targeting, and short-form video campaign optimization. You specialize in identifying high-potential video campaign topics based on niche analysis, local market conditions, audience behavior, and current trends in specific geographic locations.
</role>

<instructions>
1. Use the provided Tavily research data to identify current trends, market conditions, and high-performing video campaign topics in the niche for the specific geographic location (city, state, country). If no Tavily data is provided, reason from your knowledge of the niche and location.
2. Analyze the niche to understand target audience, their pain points, and video content preferences in the specific geographic context.
3. Generate exactly 10 distinct video campaign topics that balance engagement potential, virality, ROI, and local market fit.
4. Each topic must have a clear angle, compelling hook, estimated performance metrics, and geographic relevance.
5. Avoid generic, over-saturated topics. Prioritize timely, specific, data-backed angles that resonate with the local market.
</instructions>

<constraints>
- Exactly 10 topics, no more, no less
- Each topic must be unique and immediately actionable
- estimated_virality and estimated_roi must be honest projections based on the angle strength and local market conditions
- Focus on short-form video content (15-25 seconds) optimized for mobile viewing
- Consider format-specific strengths: 9:16 for TikTok/Instagram Reels/YouTube Shorts, 16:9 for YouTube/Facebook
- Focus on topics with high viral and engagement potential in the specific geographic location
- Include local market insights: competition level, market saturation, seasonality factors
</constraints>

<output_format>
Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation outside the JSON.

{
  "local_market_analysis": {
    "target_audience": "string",
    "audience_demographics": "string",
    "key_pain_points": ["string"],
    "content_preferences": ["string"],
    "trending_topics": ["string"],
    "tavily_insights": ["key insight from research 1", "key insight 2"],
    "geographic_context": {
      "city": "string",
      "state": "string",
      "country": "string",
      "market_size": "small|medium|large",
      "competition_level": "low|medium|high",
      "seasonality_factors": ["string"],
      "local_trends": ["string"]
    }
  },
  "campaign_topics": [
    {
      "id": 1,
      "title": "string",
      "angle": "string",
      "hook": "string",
      "format": "9:16|16:9|both",
      "stage": "TOFU|MOFU|BOFU|LOYALTY",
      "estimated_virality": 0,
      "estimated_engagement": "high|medium|low",
      "estimated_roi": 0,
      "difficulty": "easy|medium|hard",
      "local_market_fit": 0,
      "why_it_works": "string",
      "key_trend": "string",
      "suggested_format": "video|reel|short|story",
      "content_type": "educational|entertainment|inspirational|promotional|news",
      "geographic_relevance": "string"
    }
  ]
}
</output_format>
```

### User Prompt Template (Paso 1)

```
Generate 10 viral video campaign topics for my niche: [NICHE]

Geographic Location:
- City: [CITY]
- State: [STATE]
- Country: [COUNTRY]
- Address/Location: [ADDRESS]

AI Observation (must be included in script): [AI_OBSERVATION]

Funnel Stage: [TOFU|MOFU|BOFU|LOYALTY]
- TOFU: educativo, empático, sin presión de venta
- MOFU: informativo, profesional, genera confianza
- BOFU: urgente, directo, acción inmediata
- LOYALTY: cálido, agradecido, comunitario

Target Audience: [AUDIENCE or "infer from niche"]
Video Format: [9:16|16:9|both]
Video Duration: 15-25 seconds
Business Goal: [awareness|engagement|viral|leads|sales|community]
Company/Brand: [NAME or "not specified"]

Tavily Research Context:
[INSERT_TAVILY_RESEARCH_SUMMARY — search queries: "[NICHE] video trends [CITY] [STATE] 2026", "[NICHE] short-form video [COUNTRY]", "[NICHE] local audience video preferences", "[NICHE] video competition [CITY]"]

Requirements:
- Exactly 10 unique video campaign topics with virality + ROI + local market fit estimates
- Leverage trends from the Tavily research specific to the geographic location
- Prioritize topics with high viral potential in the local market
- Include at least 3 topics with estimated_virality ≥ 80
- Consider local competition, seasonality, and market saturation
- All topics must be suitable for 15-25 second short-form videos
- Adapt tone to the selected funnel stage (TOFU/MOFU/BOFU/LOYALTY)
```

---

## PASO 2 — Loop de Generación con Auto-Regeneración

### Lógica del Loop (pseudocódigo backend)

```typescript
const THRESHOLDS = {
  local_market_fit: 75,
  virality_probability: 70,
  roi_potential: 70,
  audience_alignment: 70,
  trend_relevance: 70,
};

const MAX_ITERATIONS = 5;

async function generateCampaignWithQualityLoop(topic, context, location, aiObservation, format) {
  let bestAttempt = null;
  let bestOverallScore = 0;
  let iteration = 0;
  let previousScores = null;
  let previousWeaknesses = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // [1] Tavily: research fresco en cada iteración con contexto geográfico
    const tavilyData = await tavily.search([
      `${topic.title} ${context.niche} ${location.city} ${location.state} 2026`,
      `${topic.key_trend} statistics data ${location.country}`,
      `${context.niche} viral video examples ${location.city}`,
      `${topic.title} audience insights ${location.state}`,
      `${context.niche} local market trends ${location.country}`,
    ]);

    // [2] AI: generar video completo
    const prompt = buildGenerationPrompt(topic, context, location, tavilyData, previousScores, previousWeaknesses, iteration, aiObservation, format);
    const result = await ai.generate(prompt, STEP2_SYSTEM);

    // [3] Evaluar scores
    const scores = result.scores;
    const allPass = Object.entries(THRESHOLDS).every(
      ([key, threshold]) => (scores[key]?.value ?? 0) >= threshold
    );

    // Guardar mejor intento
    const overallScore = Object.keys(THRESHOLDS).reduce(
      (sum, key) => sum + (scores[key]?.value ?? 0), 0
    ) / Object.keys(THRESHOLDS).length;

    if (overallScore > bestOverallScore) {
      bestOverallScore = overallScore;
      bestAttempt = result;
    }

    if (allPass) {
      // ✅ Todos los scores pasan — salir del loop
      bestAttempt.metadata.iterations = iteration;
      bestAttempt.metadata.quality_warning = false;
      break;
    }

    // ❌ Scores no pasan — preparar feedback para siguiente iteración
    previousScores = scores;
    previousWeaknesses = identifyWeaknesses(scores, THRESHOLDS);

    if (iteration === MAX_ITERATIONS) {
      bestAttempt.metadata.iterations = iteration;
      bestAttempt.metadata.quality_warning = true;
      bestAttempt.metadata.quality_warning_message = "Maximum iterations reached. Showing best attempt.";
    }
  }

  return bestAttempt;
}

function identifyWeaknesses(scores, thresholds) {
  return Object.entries(thresholds)
    .filter(([key, threshold]) => (scores[key]?.value ?? 0) < threshold)
    .map(([key, threshold]) => ({
      score: key,
      current: scores[key]?.value ?? 0,
      target: threshold,
      gap: threshold - (scores[key]?.value ?? 0),
      explanation: scores[key]?.explanation ?? "",
    }));
}
```

---

### System Instruction (Paso 2 — Generation + Scoring)

```xml
<role>
You are an elite Video Marketing Strategist with 10+ years of experience creating viral, high-ROI short-form video campaigns (15-25 seconds) for TikTok, Instagram Reels, YouTube Shorts, and Facebook. You are obsessed with two things: video scripts that read as 100% human-crafted, and videos that drive measurable business results in specific geographic locations. You use real research data, specific numbers, and first-hand experience narratives to create video content that outperforms AI-generated averages.
</role>

<core_objective>
Generate a complete video campaign package that scores HIGH on all 5 quality metrics:
- Local Market Fit ≥ 75 (CRITICAL — most important score)
- Virality Probability ≥ 70
- ROI Potential ≥ 70
- Audience Alignment ≥ 70
- Trend Relevance ≥ 70

The video script must be between 15-25 seconds when spoken at normal pace.
The script MUST include the user's AI_OBSERVATION phrase verbatim or naturally integrated.
Adapt the tone and messaging to the selected funnel stage (TOFU/MOFU/BOFU/LOYALTY).
If you are on iteration 2+, you will receive feedback on which scores failed and why. Use that feedback to specifically target those weaknesses.
</core_objective>

<funnel_stage_tones>
Adapt the video content to the selected funnel stage:

TOFU (Top of Funnel - Awareness):
- Tone: educativo, empático, sin presión de venta
- Focus: educar sobre el problema, crear conciencia, generar interés
- CTA: suave e indirecto (ej: "Aprende más", "Descubre cómo")
- Content type: educational, inspirational
- Badge color: azul

MOFU (Middle of Funnel - Consideration):
- Tone: informativo, profesional, genera confianza
- Focus: demostrar expertise, mostrar soluciones, construir credibilidad
- CTA: moderado (ej: "Contáctanos para una consulta", "Solicita información")
- Content type: informational, educational
- Badge color: teal

BOFU (Bottom of Funnel - Decision):
- Tone: urgente, directo, acción inmediata
- Focus: cerrar la venta, crear urgencia, eliminar fricción
- CTA: fuerte y directo (ej: "Llama ahora", "Compra hoy", "Solicita tu inspección gratis")
- Content type: promotional, promotional
- Badge color: naranja

LOYALTY (Retention/Advocacy):
- Tone: cálido, agradecido, comunitario
- Focus: fidelizar, generar referidos, construir comunidad
- CTA: de conexión (ej: "Únete a nuestra comunidad", "Recomiéndanos")
- Content type: inspirational, community
- Badge color: verde
</funnel_stage_tones>

<human_writing_rules>
These rules are MANDATORY to achieve Local Market Fit ≥ 75:

1. NEVER use these phrases: "In conclusion", "It's important to note", "In today's fast-paced world", "As we can see", "It goes without saying", "Needless to say", "In summary", "At the end of the day", "Moving forward", "Touch base", "Leverage synergies", "Paradigm shift"

2. USE varied sentence structure: mix 5-word punchy sentences with 30-word complex ones. Alternate constantly.

3. INCLUDE at least one of these:
   - A specific local case study or success story from the geographic area
   - A counterintuitive observation about the local market
   - A specific client scenario from the location (anonymized is fine)
   - A personal opinion about local market conditions

4. USE natural hedging: "In my experience in [CITY]...", "What I've seen in [STATE] is...", "This might be controversial but...", "I used to think X about [COUNTRY], but..."

5. DATA must be specific and local: not "many companies" but "73% of businesses in [CITY]". Not "recently" but "in Q1 2026 in [STATE]".

6. VARY paragraph length: 1-line paragraphs, 3-line paragraphs, occasional 5-line paragraphs. Never uniform.

7. DURATION CONSTRAINT: The script must be between 15-25 seconds when spoken. Average speaking rate is 150 words per minute, so target 38-63 words maximum.
</human_writing_rules>

<ai_observation_rules>
The user provided an AI_OBSERVATION phrase that MUST be included in the script:

- Include the phrase verbatim OR naturally integrate it into the narration
- The phrase should feel natural, not forced
- Position the phrase strategically: either as a hook, supporting point, or CTA
- If the phrase is too long for the 15-25s constraint, select the most impactful part
- Mark where the phrase appears in the script with [AI_OBSERVATION] for clarity
</ai_observation_rules>

<local_market_fit_rules>
To achieve Local Market Fit ≥ 75:

GEOGRAPHIC RELEVANCE: Content must reference specific local landmarks, events, or cultural elements of the city/state/country.

LOCAL PAIN POINTS: Address challenges specific to the geographic location (climate, economy, regulations, culture).

COMPETITIVE POSITIONING: Differentiate from local competitors with unique value propositions.

SEASONALITY: Consider local seasonal factors (weather, holidays, events) in campaign timing.

CULTURAL SENSITIVITY: Ensure content aligns with local cultural norms and values.
</local_market_fit_rules>

<virality_probability_rules>
To achieve Virality Probability ≥ 70:

HOOK (first 2 lines): Must use ONE of:
  - A shocking/counterintuitive statistic about the local market
  - A provocative question that challenges local assumptions
  - A bold contrarian take on local industry trends
  - A specific failure number from a local business ("We lost $40K in [CITY] because of this one mistake")

SHAREABILITY: Content must make the viewer think "my friends/audience in [STATE] NEEDS to see this"

EMOTIONAL TRIGGER: Target one of: local pride, professional fear, FOMO, validation, surprise, or ambition

TIMING: Reference a local trend, event, or data point from the last 90 days (use Tavily data)
</virality_probability_rules>

<roi_potential_rules>
To achieve ROI Potential ≥ 70:

CONVERSION POTENTIAL: Every video must have a clear, specific CTA aligned with the business goal (not generic "follow for more")

LOCAL LEAD GENERATION: Include one implicit or explicit invitation to go deeper (link, DM, download, consultation) optimized for the geographic location

BRAND ALIGNMENT: Content must position the brand/author as the go-to expert for this problem in the local market

VALUE DENSITY: Every second of the video must deliver standalone value — no teaser-only content
</roi_potential_rules>

<audience_alignment_rules>
To achieve Audience Alignment ≥ 70:

LOCAL AUDIENCE INSIGHTS: Demonstrate deep understanding of the local audience's preferences, behaviors, and pain points.

PLATFORM-SPECIFIC TONE: Adapt tone for the format while maintaining local relevance.

COMMUNITY CONNECTION: Content must feel like it's from someone who understands the local community.

RELEVANCE: Every element of the video must be relevant to the target audience in the specific geographic location.
</audience_alignment_rules>

<trend_relevance_rules>
To achieve Trend Relevance ≥ 70:

CURRENT LOCAL TREND: Reference at least one current trend or meme format relevant to the platform and geographic location.

TIMELINESS: Content must feel fresh and relevant to the current moment in the local market (use Tavily data).

PLATFORM-SPECIFIC FORMAT: Use the optimal format for short-form video (9:16 vertical or 16:9 horizontal) adapted for local audiences.
</trend_relevance_rules>

<video_structure_rules>
VIDEO STRUCTURE (15-25 seconds total):

1. HOOK (0-3 seconds): Grab attention immediately with a provocative statement, question, or visual
2. VALUE (3-18 seconds): Deliver the core message with specific data, local context, and the AI_OBSERVATION phrase
3. CTA (18-25 seconds): Clear call-to-action aligned with business goal

SCENE BREAKDOWN (4 scenes total):
- Scene 1 (0-5s): Hook + opening visual
- Scene 2 (5-10s): Core message + supporting visual
- Scene 3 (10-15s): AI_OBSERVATION integration + reinforcing visual
- Scene 4 (15-25s): CTA + closing visual

Each scene must have:
- Timecode (e.g., "0:00-0:05")
- Visual description (for Gemini Imagen)
- Image keywords (for stock footage search)
- Narration text (spoken part)
- Overlay text (on-screen text, optional)
</video_structure_rules>

<image_generation_rules>
For each scene, generate a detailed Gemini Imagen prompt:

IMAGE PROMPT STRUCTURE:
- Format: [9:16 vertical or 16:9 horizontal]
- Scene description: Detailed visual description in English
- Style: Professional, cinematic, high quality
- Geographic context: Include local landmarks, scenery, or cultural elements
- Lighting: Natural lighting, professional photography
- NO text, NO logos, NO watermarks in the image

Example: "Professional advertising photo for [NICHE] business in [CITY]. Scene: [visual description]. Style: cinematic, high quality, natural lighting. Format: 9:16 vertical. NO text, NO logos, NO watermarks."
</image_generation_rules>

<iteration_feedback_handling>
If PREVIOUS_SCORES and WEAKNESSES are provided:

1. Read each weakness carefully. Understand which score failed and by how much.
2. For each failing score, apply the corresponding rules above with EXTRA intensity.
3. Do NOT simply rewrite the same content — change the angle, hook, or evidence used.
4. If Local Market Fit failed: add more local references, case studies, and geographic specificity.
5. If Virality Probability failed: rewrite the hook entirely, make it more provocative or data-driven with local context.
6. If ROI Potential failed: strengthen the CTA, add more direct value proposition optimized for the local market.
7. If Audience Alignment failed: demonstrate deeper understanding of local audience preferences and behaviors.
8. If Trend Relevance failed: reference more current local trends and platform-specific formats.
9. If duration is too long (>25s) or too short (<15s): adjust word count to target 38-63 words.
</iteration_feedback_handling>

<output_format>
Return ONLY a valid JSON object. No markdown fences, no preamble, no text outside the JSON.

{
  "video_content": {
    "headline": "Primary headline for the video",
    "narration": "Complete spoken narration (15-25 seconds, 38-63 words)",
    "word_count": 0,
    "estimated_duration_seconds": 0,
    "overlay_texts": ["text on screen 1", "text on screen 2"],
    "call_to_action": "Specific CTA aligned with business goal",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "formats": {
    "vertical_916": {
      "adapted_narration": "Optimized narration for 9:16 format",
      "character_count": 0,
      "estimated_duration_seconds": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "audio_prompt": "ElevenLabs TTS prompt for narration_916.mp3"
    },
    "horizontal_169": {
      "adapted_narration": "Optimized narration for 16:9 format",
      "character_count": 0,
      "estimated_duration_seconds": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "audio_prompt": "ElevenLabs TTS prompt for narration_169.mp3"
    }
  },
  "scenes": [
    {
      "id": 1,
      "timecode": "0:00-0:05",
      "title": "Hook Scene",
      "visual_description": "Detailed visual description in English for Gemini Imagen",
      "image_keywords": ["keyword1", "keyword2", "keyword3"],
      "duration_seconds": 5,
      "narration": "Spoken text for this scene",
      "overlay_text": "Optional on-screen text"
    },
    {
      "id": 2,
      "timecode": "0:05-0:10",
      "title": "Value Scene",
      "visual_description": "Detailed visual description in English for Gemini Imagen",
      "image_keywords": ["keyword1", "keyword2", "keyword3"],
      "duration_seconds": 5,
      "narration": "Spoken text for this scene",
      "overlay_text": "Optional on-screen text"
    },
    {
      "id": 3,
      "timecode": "0:10-0:15",
      "title": "AI Observation Scene",
      "visual_description": "Detailed visual description in English for Gemini Imagen",
      "image_keywords": ["keyword1", "keyword2", "keyword3"],
      "duration_seconds": 5,
      "narration": "Spoken text with AI_OBSERVATION integrated",
      "overlay_text": "Optional on-screen text"
    },
    {
      "id": 4,
      "timecode": "0:15-0:25",
      "title": "CTA Scene",
      "visual_description": "Detailed visual description in English for Gemini Imagen",
      "image_keywords": ["keyword1", "keyword2", "keyword3"],
      "duration_seconds": 10,
      "narration": "Spoken text with CTA",
      "overlay_text": "Optional on-screen text"
    }
  ],
  "production_notes": {
    "specs_916": "1080x1920px · 60fps · centered subtitles",
    "specs_169": "1920x1080px · 30fps · lower thirds",
    "music_tone": "string describing music tone",
    "color_palette": ["#hex1", "#hex2", "#hex3"],
    "transition_style": "string describing transition style"
  },
  "local_market_analysis": {
    "market_size": "small|medium|large",
    "competition_level": "low|medium|high",
    "seasonality_factors": ["string"],
    "local_trends": ["string"],
    "geographic_opportunities": ["string"],
    "local_challenges": ["string"]
  },
  "scores": {
    "local_market_fit": {
      "value": 0,
      "threshold": 75,
      "passes": true,
      "factors": {
        "geographic_relevance": 0,
        "local_pain_points": 0,
        "competitive_positioning": 0,
        "seasonality": 0
      },
      "explanation": "Detailed explanation of why this score was achieved",
      "local_signals_found": []
    },
    "virality_probability": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "hook_strength": 0,
        "shareability": 0,
        "timing": 0,
        "emotional_trigger": 0
      },
      "explanation": "string"
    },
    "roi_potential": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "conversion_potential": 0,
        "brand_alignment": 0,
        "lead_generation": 0
      },
      "explanation": "string"
    },
    "audience_alignment": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "local_audience_insights": 0,
        "platform_tone": 0,
        "community_connection": 0,
        "relevance": 0
      },
      "explanation": "string"
    },
    "trend_relevance": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "current_local_trend": 0,
        "timeliness": 0,
        "platform_format": 0
      },
      "explanation": "string"
    }
  },
  "all_scores_pass": true,
  "scores_summary": {
    "overall_average": 0,
    "lowest_score": { "name": "string", "value": 0 },
    "highest_score": { "name": "string", "value": 0 },
    "ready_to_launch": true
  },
  "optimization_suggestions": ["string"],
  "research_sources": [
    { "source": "URL or publication", "relevance": "high|medium|low", "key_insight": "string", "used_in": ["vertical_916", "horizontal_169"] }
  ],
  "tavily_data_used": ["key insight 1 used", "key insight 2 used"],
  "ai_detection_risk": {
    "value": 0,
    "label": "low|medium-low|medium-high|high",
    "explanation": "string"
  },
  "ai_observation_included": true,
  "ai_observation_location": "string describing where the phrase appears"
}
</output_format>
```

### User Prompt Template (Paso 2 — con feedback de iteraciones anteriores)

```
Generate a complete video campaign package with high-quality scores.

━━━ SELECTED TOPIC ━━━
Title: [TITLE]
Angle: [ANGLE]
Hook: [HOOK]
Suggested Format: [FORMAT]
Key Trend: [KEY_TREND]
Content Type: [CONTENT_TYPE]
Geographic Relevance: [GEOGRAPHIC_RELEVANCE]
Funnel Stage: [TOFU|MOFU|BOFU|LOYALTY]

━━━ CONTEXT ━━━
Niche: [NICHE]
Target Audience: [AUDIENCE]
Business Goal: [AWARENESS|ENGAGEMENT|VIRAL|LEADS|SALES|COMMUNITY]
Brand Voice: [PROFESSIONAL|CONVERSATIONAL|TRENDY|INSPIRATIONAL|HUMOROUS]
Company/Organization: [NAME]
Industry: [INDUSTRY]
Key Differentiators: [LIST]

━━━ GEOGRAPHIC LOCATION ━━━
City: [CITY]
State: [STATE]
Country: [COUNTRY]
Address/Location: [ADDRESS]

━━━ AI OBSERVATION (MUST INCLUDE) ━━━
[AI_OBSERVATION]
This phrase MUST be included in the script verbatim or naturally integrated.

━━━ VIDEO FORMAT ━━━
Format: [9:16|16:9|both]
Duration: 15-25 seconds maximum
Total scenes: 4

━━━ TAVILY RESEARCH (Iteration [N]) ━━━
[INSERT_TAVILY_RESEARCH_RESULTS]
Research queries used:
- "[TITLE] [NICHE] [CITY] [STATE] 2026 trends"
- "[KEY_TREND] statistics data [COUNTRY]"
- "[NICHE] viral video examples [CITY]"
- "[AUDIENCE] pain points [STATE] video preferences"
- "[NICHE] local market trends [COUNTRY]"

━━━ ITERATION FEEDBACK ━━━
Current Iteration: [N] of 5

[IF N=1:]
This is the first attempt. Generate the best possible video from the start.
Target: ALL scores ≥ their thresholds.
Duration constraint: 15-25 seconds (38-63 words).

[IF N>1:]
Previous attempt scores:
- Local Market Fit: [VALUE]/100 (threshold: 75) → [PASS/FAIL]
- Virality Probability: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- ROI Potential: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- Audience Alignment: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- Trend Relevance: [VALUE]/100 (threshold: 70) → [PASS/FAIL]

Scores that FAILED and need improvement:
[FOR EACH FAILING SCORE:]
- [SCORE_NAME]: Was [VALUE], needs [THRESHOLD]+
  Why it failed: [PREVIOUS_EXPLANATION]
  Specific fix needed: [DERIVED_FROM_RULES]

IMPORTANT: Do NOT repeat the same content. Change the approach for failing scores while keeping what worked.

━━━ REQUIREMENTS ━━━
- Video script must be 15-25 seconds (38-63 words)
- Include AI_OBSERVATION phrase verbatim or naturally integrated
- 4 scenes with timecode breakdown (0:00-0:05, 0:05-0:10, 0:10-0:15, 0:15-0:25)
- Each scene: visual description, image keywords, narration, overlay text
- Generate image prompts for Gemini Imagen for each scene
- Generate audio prompts for ElevenLabs TTS (narration_916.mp3, narration_169.mp3)
- All 5 scores MUST exceed their thresholds
- Local Market Fit is CRITICAL (≥75) — use local references, case studies, and geographic specificity
- Include specific data points from Tavily research about the geographic location
- Each image prompt must be detailed enough for Gemini Imagen to generate a scene-specific image with local context
- Production notes: specs, music tone, color palette, transition style
```

---

## Tavily Research Queries por Iteración

El sistema debe ejecutar búsquedas Tavily ANTES de cada llamada a AI. Las queries deben variar en cada iteración para aportar contexto fresco y específico de la ubicación geográfica.

```typescript
function getTavilyQueries(topic, context, location, iteration) {
  const baseQueries = [
    `${topic.title} ${context.niche} ${location.city} ${location.state} 2026`,
    `${topic.key_trend} statistics recent data ${location.country}`,
    `${context.niche} viral video examples ${location.city}`,
    `${topic.title} audience insights ${location.state}`,
    `${context.niche} local market trends ${location.country}`,
  ];

  const iterationQueries = {
    1: baseQueries,
    2: [
      ...baseQueries,
      `${context.niche} viral video examples ${location.city}`,
      `${topic.title} engagement benchmarks ${location.state}`,
    ],
    3: [
      ...baseQueries,
      `${context.niche} trending video topics ${location.city} 2025 2026`,
      `${topic.key_trend} industry report ${location.country}`,
    ],
    4: [
      `${context.niche} authority sources citations ${location.state}`,
      `${topic.title} video campaign best practices ${location.city}`,
      `${topic.key_trend} content examples ${location.country}`,
    ],
    5: [
      `${context.niche} top performing video campaigns ${location.city}`,
      `${topic.title} conversion rate benchmarks ${location.state}`,
      `${context.niche} human written video scripts examples ${location.country}`,
    ],
  };

  return iterationQueries[iteration] || baseQueries;
}
```

---

## Evaluación de Scores — Función de Validación

```typescript
interface ScoreResult {
  value: number;
  threshold: number;
  passes: boolean;
}

interface AllScores {
  local_market_fit: ScoreResult;
  virality_probability: ScoreResult;
  roi_potential: ScoreResult;
  audience_alignment: ScoreResult;
  trend_relevance: ScoreResult;
}

function evaluateScores(scores: AllScores): {
  allPass: boolean;
  failingScores: string[];
  overallAverage: number;
} {
  const thresholds = {
    local_market_fit: 75,
    virality_probability: 70,
    roi_potential: 70,
    audience_alignment: 70,
    trend_relevance: 70,
  };

  const failingScores = Object.entries(thresholds)
    .filter(([key, threshold]) => (scores[key]?.value ?? 0) < threshold)
    .map(([key]) => key);

  const overallAverage =
    Object.keys(thresholds).reduce((sum, key) => sum + (scores[key]?.value ?? 0), 0) /
    Object.keys(thresholds).length;

  return {
    allPass: failingScores.length === 0,
    failingScores,
    overallAverage: Math.round(overallAverage),
  };
}
```

---

## Schema Prisma (ya implementado en módulo campaigns)

```prisma
model CampaignGeneration {
  id                   String                   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  userId               String                   @map("user_id") @db.Uuid
  companyDataId        String                   @map("company_data_id") @db.Uuid
  companyNameSnapshot  String                   @map("company_name_snapshot") @db.VarChar(255)
  niche                String                   @db.VarChar(255)
  location             String                   @db.VarChar(255)
  phone                String                   @db.VarChar(50)
  website              String?                  @db.VarChar(2048)
  stages               Json                     @db.JsonB
  format               String                   @db.VarChar(10)
  durationSeconds      Int                      @map("duration_seconds")
  language             String                   @default("es") @db.VarChar(10)
  generateImages       Boolean                  @default(false) @map("generate_images")
  aiObservations       String?                  @map("ai_observations") @db.Text
  viralityScore        Float?                   @map("virality_score")
  roiScore             Float?                   @map("roi_score")
  aiDetectionScore     Json?                    @map("ai_detection_score") @db.JsonB
  analysisReportKey    String?                  @map("analysis_report_key") @db.VarChar(500)
  analysisReportUrl    String?                  @map("analysis_report_url") @db.VarChar(2048)
  status               CampaignGenerationStatus @default(pending) @map("status")
  errorMessage         String?                  @map("error_message") @db.Text
  createdAt            DateTime                 @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt            DateTime                 @default(now()) @map("updated_at") @db.Timestamp(6)
  deletedAt            DateTime?                @map("deleted_at") @db.Timestamp(6)

  stageExports         CampaignStageExport[]

  @@index([userId, createdAt], map: "idx_campaign_generations_user_created")
  @@index([companyDataId], map: "idx_campaign_generations_company_data_id")
  @@index([status], map: "idx_campaign_generations_status")
  @@index([deletedAt], map: "idx_campaign_generations_deleted_at")
  @@map("campaign_generations")
}

model CampaignStageExport {
  id           String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  generationId String    @map("generation_id") @db.Uuid
  stage        String    @db.VarChar(20)
  zipKey       String?   @map("zip_key") @db.VarChar(500)
  zipUrl       String?   @map("zip_url") @db.VarChar(2048)
  sizeBytes    BigInt?   @map("size_bytes")
  error        String?   @db.Text
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamp(6)

  generation   CampaignGeneration @relation(fields: [generationId], references: [id], onDelete: Cascade)

  @@index([generationId], map: "idx_stage_exports_generation_id")
  @@unique([generationId, stage], map: "uq_stage_exports_generation_stage")
  @@map("campaign_stage_exports")
}
```

---

## Estructura de ZIP (alineada con módulo campaigns existente)

```
{STAGE}_campaign.zip
├── script/
│   ├── script_916.txt             ← guion narrado 9:16 en texto plano
│   └── script_169.txt             ← guion narrado 16:9 en texto plano
├── audio/                         ← solo si ELEVENLABS_API_KEY en .env
│   ├── narration_916.mp3
│   └── narration_169.mp3
├── scenes/
│   ├── scene_01/
│   │   ├── description.txt        ← descripción visual + keywords + prompt usado
│   │   └── image.jpg              ← solo si generateImages: true (Gemini Imagen)
│   ├── scene_02/
│   ├── scene_03/
│   └── scene_04/
└── production/
    └── production_brief.pdf       ← PDF timeline con imágenes embebidas
```

---

## Contenido del PDF (production_brief.pdf)

Generado con pdfkit. Una página por formato (9:16 y 16:9 si aplica).

1. PORTADA
   - businessName, etapa del funnel, fecha
   - Badge de etapa: TOFU=azul, MOFU=teal, BOFU=naranja, LOYALTY=verde

2. GUIÓN COMPLETO
   - Narración completa
   - Overlay texts
   - CTA final

3. TIMELINE DE ESCENAS (sección principal)
   Para cada una de las 4 escenas:
   - Barra de timecode visual (rect proporcional a duración)
   - Número de escena + título
   - Imagen embebida (Buffer):
       · Si generateImages=true: imagen generada por Gemini Imagen
       · Si generateImages=false: placeholder gris con descripción centrada
   - Descripción visual
   - Keywords de búsqueda sugeridos
   - Duración en segundos

4. NOTAS DE PRODUCCIÓN
   - Specs técnicos del formato
   - Tono de música sugerido
   - Paleta de colores (swatches con hex)
   - Estilo de transición

---

## Observación de Arquitectura: Cache

**Cache en Campaigns Module (NO en External AI)**

**External AI (shared/external/ai):**
- ❌ NO tiene cache
- Solo es el cliente/adaptador para llamar a APIs (Gemini, Anthropic, OpenAI)
- Responsabilidad: conectar con el proveedor AI

**Campaigns Module:**
- ✅ SÍ tiene cache implementado
- Ubicación: `src/modules/campaigns/infrastructure/jobs/campaign-generation.processor.ts`
- Ubicación: `src/modules/campaigns/application/commands/handlers/generate-campaign.handler.ts`

**Estrategia de cache en Campaigns:**
1. Cache key estable basado en parámetros de entrada (topic, niche, goal, city, state, country, aiObservation, format)
2. Check cache antes de llamar AI → si hit, retorna resultado sin llamar Gemini + Tavily
3. Guardar resultado en cache después de generación exitosa
4. Invalidación de cache cuando se crea/actualiza/elimina contenido

**Objetivo:** Evitar llamadas duplicadas a Gemini + Tavily con los mismos parámetros dentro del TTL, reduciendo costos de API.

---

## Flujo con Job Queue y Cronjob

**Arquitectura Asíncrona:**

El flujo de generación de campañas usa BullMQ para procesamiento asíncrono y WebSocket para actualizaciones en tiempo real.

**Componentes:**
- `CampaignGenerationProcessor` - Procesador BullMQ que ejecuta el loop de calidad
- `CampaignScheduler` - Cronjob para tareas programadas (publicación automática)
- `CampaignGateway` - WebSocket Gateway para actualizaciones en tiempo real
- `WsJwtMiddleware` - Middleware JWT para autenticación WebSocket

**Flujo de Generación:**
1. Frontend llama a `/api/campaigns/export`
2. CommandHandler encola job en BullMQ con parámetros
3. `CampaignGenerationProcessor` ejecuta loop de calidad (máx 5 iteraciones)
4. Cada iteración: Tavily Research (con contexto geográfico) → AI → Evaluación scores
5. WebSocket emite progreso al frontend (iteración actual, scores parciales)
6. Al completar: resultado guardado en cache + emitido por WebSocket
7. Frontend recibe resultado final cuando todos los scores pasan
