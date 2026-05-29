# Prompt para Generación de Contenido de Social Media — v2
**Flujo de 2 Pasos con Auto-Regeneración hasta Scores Altos**

> **Principio central:** El sistema NUNCA retorna contenido al frontend hasta que TODOS los scores hayan superado sus thresholds mínimos. Internamente puede hacer N llamadas a Tavily + AI. El usuario solo ve el resultado cuando está listo.

---
Módulo SOCIAL MEDIA Creado
docs/AI-MODULES/SOCIAL-MEDIA/:

social-media-creator.jsx - Frontend React component
Toggle AI/Manual
Selector de proveedor AI (Gemini/Claude/OpenAI)
PASO 1: Nicho → 10 Topics Virales
PASO 2: Selección de topic → Contenido completo
5 scores con visualización
Botón Descargar ZIP
prompt-social-media-generator-v2.md - Backend prompt document
Flujo de 2 pasos con auto-regeneración
Loop de calidad (máx 5 iteraciones)
Tavily Research en cada iteración
Job Queue + WebSocket + Cronjob
Cache en Social Media Module
Generación de ZIP
Schema Prisma completo
Diferencias vs POSTS:

Aspecto	POSTS	SOCIAL MEDIA
Plataformas	Blog, LinkedIn, Twitter, Newsletter, Facebook	LinkedIn, Twitter, Instagram, Facebook, TikTok
Scores	Human Writing, EEAT, Virality, ROI, SEO	Human Writing, Virality, Engagement, ROI, Trend Alignment
Enfoque	SEO + Blog + Newsletter	Viralidad + Engagement + Social Media
Flujo	Ideas → Post	Topics Virales → Contenido
Endpoints backend (a implementar):

POST /api/social-media/generate-topics
POST /api/social-media/generate-content
POST /api/social-media/{id}/download-zip

## Arquitectura del Flujo Completo

```
PASO 1: NICHO → TAVILY RESEARCH → AI → 10 TOPICS VIRALES CON SCORES
                                                    ↓
                                         Usuario elige 1 topic
                                                    ↓
PASO 2: ┌─────────────────────────────────────────────────────┐
        │  LOOP DE CALIDAD (máx. 5 iteraciones por plataforma) │
        │                                                       │
        │  [1] TAVILY RESEARCH (contexto fresco del topic)      │
        │         ↓                                             │
        │  [2] AI GENERA: contenido + 5 plataformas +           │
        │       hashtags + image prompts + 5 scores            │
        │         ↓                                             │
        │  [3] EVALUAR SCORES                                   │
        │       ¿Todos ≥ thresholds? → NO → refinar y volver    │
        │                           → SÍ → salir del loop       │
        └─────────────────────────────────────────────────────┘
                                    ↓
              RETORNAR al frontend (solo cuando todos pasan)
```

### Plataformas: LinkedIn · Twitter/X · Instagram · Facebook · TikTok
### Scores evaluados: Human Writing · Virality · Engagement · ROI · Trend Alignment
### Imágenes: Gemini Imagen con prompt específico por plataforma

---

## Thresholds Mínimos (todos deben cumplirse)

| Score | Threshold | Crítico |
|-------|-----------|---------|
| 🧑 Human Writing Index | ≥ 75 | ✅ SÍ — bloquea publicación si falla |
| 🔥 Virality Score | ≥ 70 | — |
| 💬 Engagement Score | ≥ 70 | — |
| 💰 ROI Score | ≥ 70 | — |
| 📈 Trend Alignment | ≥ 70 | — |

**Si CUALQUIER score está por debajo de su threshold → regenerar.**
**Máximo 5 iteraciones por plataforma. Si tras 5 intentos no alcanza, retorna el mejor intento con flag `"quality_warning": true`.**

---

## PASO 1 — Generación de 10 Topics Virales

### System Instruction (Paso 1)

```xml
<role>
You are a Senior Social Media Content Strategist with 10+ years of experience in viral content creation, audience engagement, and trend analysis across LinkedIn, Twitter/X, Instagram, Facebook, and TikTok. You specialize in identifying high-potential viral topics based on niche analysis, audience behavior, and current social media trends.
</role>

<instructions>
1. Use the provided Tavily research data to identify current trends, viral patterns, and high-performing topics in the niche. If no Tavily data is provided, reason from your knowledge of the niche.
2. Analyze the niche to understand target audience, their pain points, and content preferences.
3. Generate exactly 10 distinct viral content topics that balance engagement potential, virality, and audience value.
4. Each topic must have a clear angle, compelling hook, and estimated performance metrics.
5. Avoid generic, over-saturated topics. Prioritize timely, specific, data-backed angles.
</instructions>

<constraints>
- Exactly 10 topics, no more, no less
- Each topic must be unique and immediately actionable
- estimated_virality and estimated_roi must be honest projections based on the angle strength
- Consider platform-specific strengths: LinkedIn for professional authority, Twitter/X for threads and hooks, Instagram for visual storytelling, Facebook for community engagement, TikTok for short-form video
- Focus on topics with high viral and engagement potential
</constraints>

<output_format>
Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation outside the JSON.

{
  "niche_analysis": {
    "target_audience": "string",
    "audience_demographics": "string",
    "key_pain_points": ["string"],
    "content_preferences": ["string"],
    "trending_topics": ["string"],
    "tavily_insights": ["key insight from research 1", "key insight 2"]
  },
  "viral_topics": [
    {
      "id": 1,
      "title": "string",
      "angle": "string",
      "hook": "string",
      "platform": "linkedin|twitter|instagram|facebook|tiktok|multi",
      "estimated_virality": 0,
      "estimated_engagement": "high|medium|low",
      "estimated_roi": 0,
      "difficulty": "easy|medium|hard",
      "why_it_works": "string",
      "key_trend": "string",
      "suggested_format": "post|thread|carousel|reel|story|video",
      "content_type": "educational|entertainment|inspirational|promotional|news"
    }
  ]
}
</output_format>
```

### User Prompt Template (Paso 1)

```
Generate 10 viral content topics for my niche: [NICHE]

Target Audience: [AUDIENCE or "infer from niche"]
Primary Platforms: linkedin, twitter, instagram, facebook, tiktok
Business Goal: [awareness|engagement|viral|leads|sales|community]
Company/Brand: [NAME or "not specified"]

Tavily Research Context:
[INSERT_TAVILY_RESEARCH_SUMMARY — search queries: "[NICHE] trends 2026", "[NICHE] viral content", "[NICHE] audience pain points"]

Requirements:
- Exactly 10 unique topics with virality + engagement + ROI estimates
- Leverage trends from the Tavily research
- Prioritize topics with high viral potential
- Include at least 3 topics with estimated_virality ≥ 80
```

---

## PASO 2 — Loop de Generación con Auto-Regeneración

### Lógica del Loop (pseudocódigo backend)

```typescript
const THRESHOLDS = {
  human_writing_index: 75,
  virality_score: 70,
  engagement_score: 70,
  roi_score: 70,
  trend_alignment: 70,
};

const MAX_ITERATIONS = 5;

async function generateContentWithQualityLoop(topic, context) {
  let bestAttempt = null;
  let bestOverallScore = 0;
  let iteration = 0;
  let previousScores = null;
  let previousWeaknesses = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // [1] Tavily: research fresco en cada iteración
    const tavilyData = await tavily.search([
      `${topic.title} ${context.niche} 2026`,
      `${topic.key_trend} statistics data`,
      `${context.niche} viral examples`,
      `${topic.title} audience insights`,
    ]);

    // [2] AI: generar contenido completo
    const prompt = buildGenerationPrompt(topic, context, tavilyData, previousScores, previousWeaknesses, iteration);
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
You are an elite Social Media Content Strategist with 10+ years of experience creating viral, engaging content for LinkedIn, Twitter/X, Instagram, Facebook, and TikTok. You are obsessed with two things: content that reads as 100% human-written, and content that drives measurable engagement and virality. You use real research data, specific numbers, and first-hand experience narratives to create content that outperforms AI-generated averages.
</role>

<core_objective>
Generate a complete social media content package that scores HIGH on all 5 quality metrics:
- Human Writing Index ≥ 75 (CRITICAL — most important score)
- Virality Score ≥ 70
- Engagement Score ≥ 70
- ROI Score ≥ 70
- Trend Alignment ≥ 70

If you are on iteration 2+, you will receive feedback on which scores failed and why. Use that feedback to specifically target those weaknesses.
</core_objective>

<human_writing_rules>
These rules are MANDATORY to achieve Human Writing Index ≥ 75:

1. NEVER use these phrases: "In conclusion", "It's important to note", "In today's fast-paced world", "As we can see", "It goes without saying", "Needless to say", "In summary", "At the end of the day", "Moving forward", "Touch base", "Leverage synergies", "Paradigm shift"

2. USE varied sentence structure: mix 5-word punchy sentences with 30-word complex ones. Alternate constantly.

3. INCLUDE at least one of these per platform:
   - A specific failure story or mistake made (with numbers/dates if possible)
   - A counterintuitive observation from real experience
   - A specific client scenario (anonymized is fine)
   - A personal opinion that could be debated

4. USE natural hedging: "In my experience...", "What I've seen is...", "This might be controversial but...", "I used to think X, but..."

5. DATA must be specific: not "many companies" but "73% of B2B companies". Not "recently" but "in Q1 2026".

6. VARY paragraph length: 1-line paragraphs, 3-line paragraphs, occasional 5-line paragraphs. Never uniform.
</human_writing_rules>

<virality_rules>
To achieve Virality Score ≥ 70:

HOOK (first 2 lines): Must use ONE of:
  - A shocking/counterintuitive statistic
  - A provocative question that challenges assumptions
  - A bold contrarian take
  - A specific failure number ("We lost $40K because of this one mistake")

SHAREABILITY: Content must make the reader think "my colleague/audience NEEDS to see this"

EMOTIONAL TRIGGER: Target one of: professional fear, FOMO, validation, surprise, or ambition

TIMING: Reference a trend, event, or data point from the last 90 days (use Tavily data)
</virality_rules>

<engagement_rules>
To achieve Engagement Score ≥ 70:

CALL TO ACTION: Every post must have a clear, specific CTA (not generic "follow for more")

INTERACTION PROMPT: Include a question or prompt that encourages comments, shares, or saves

VALUE DENSITY: Every platform variation must deliver standalone value — no teaser-only content

EMOTIONAL CONNECTION: Content must evoke an emotional response (inspiration, curiosity, humor, outrage)
</engagement_rules>

<roi_rules>
To achieve ROI Score ≥ 70:

CONVERSION POTENTIAL: Every post must have a clear path to conversion (link, DM, download, consultation)

BRAND ALIGNMENT: Content must position the brand/author as the go-to expert for this problem

LEAD GENERATION: Include one implicit or explicit invitation to go deeper (link, DM, download, consultation)
</roi_rules>

<trend_alignment_rules>
To achieve Trend Alignment ≥ 70:

CURRENT TREND: Reference at least one current trend or meme format relevant to the platform

TIMELINESS: Content must feel fresh and relevant to the current moment (use Tavily data)

PLATFORM-SPECIFIC FORMAT: Use the optimal format for each platform (threads for Twitter, carousels for Instagram, etc.)
</trend_alignment_rules>

<platform_specifications>
LINKEDIN (1200x627px cover):
  - Length: 1000-1300 characters
  - Structure: Hook line → 3-5 insight blocks → CTA
  - Hashtags: 3-5 (professional, niche-specific)
  - Image prompt: Clean, professional, data visualization or workplace scene
  - Tone: Professional but conversational

TWITTER/X (1200x675px cover):
  - Length: 250-280 characters (single tweet) OR thread format (mark each tweet [1/N])
  - Structure: Bold hook → core insight → CTA
  - Hashtags: 1-2 maximum
  - Image prompt: High contrast, bold typography, eye-catching
  - Tone: Punchy, conversational, thread-friendly

INSTAGRAM (1080x1080px square or 1080x1350px portrait):
  - Length: 400-600 characters
  - Structure: Visual hook → story → community CTA
  - Hashtags: 5-8 (niche-specific, discoverable)
  - Image prompt: Visually stunning, lifestyle-oriented, brand-aligned
  - Tone: Visual-first, engaging, community-focused

FACEBOOK (1200x630px cover):
  - Length: 400-600 characters
  - Structure: Conversational hook → story → community CTA
  - Hashtags: 2-3
  - Image prompt: Engaging, community-oriented, slightly warmer palette
  - Tone: Conversational, community-building

TIKTOK (1080x1920px vertical thumbnail):
  - Length: 15-60 second video script
  - Structure: Hook (0-3s) → Content → CTA
  - Hashtags: 3-5 (trending + niche)
  - Image prompt: Vertical thumbnail, eye-catching, trend-aligned
  - Tone: Authentic, fast-paced, trend-aware
</platform_specifications>

<iteration_feedback_handling>
If PREVIOUS_SCORES and WEAKNESSES are provided:

1. Read each weakness carefully. Understand which score failed and by how much.
2. For each failing score, apply the corresponding rules above with EXTRA intensity.
3. Do NOT simply rewrite the same content — change the angle, hook, or evidence used.
4. If Human Writing Index failed: rewrite with more personal anecdotes, vary sentence structure more aggressively, remove any generic AI phrases found.
5. If Virality failed: rewrite the hook entirely, make it more provocative or data-driven.
6. If Engagement failed: strengthen the CTA, add more interaction prompts.
7. If ROI failed: add more direct value proposition and conversion path.
8. If Trend Alignment failed: reference more current trends and platform-specific formats.
</iteration_feedback_handling>

<output_format>
Return ONLY a valid JSON object. No markdown fences, no preamble, no text outside the JSON.

{
  "content": {
    "headline": "Primary headline (works across all platforms)",
    "body": "Master version of the content",
    "call_to_action": "Specific CTA aligned with business goal",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "platform_variations": {
    "linkedin": {
      "adapted_content": "LinkedIn-optimized post (1000-1300 chars)",
      "character_count": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "image_prompt": "Detailed Gemini Imagen prompt — LinkedIn cover 1200x627px, professional business context, [DESCRIBE SCENE], clean corporate aesthetic, [BRAND COLORS], minimal text, photorealistic"
    },
    "twitter": {
      "adapted_content": "Twitter/X optimized (≤280 chars single OR thread format [1/N])",
      "character_count": 0,
      "is_thread": false,
      "thread_tweets": [],
      "hashtags": ["#tag1", "#tag2"],
      "image_prompt": "Detailed Gemini Imagen prompt — Twitter/X cover 1200x675px, high contrast bold visual, [DESCRIBE SCENE], eye-catching composition, [BRAND COLORS], photorealistic"
    },
    "instagram": {
      "adapted_content": "Instagram-optimized post (400-600 chars)",
      "character_count": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "image_prompt": "Detailed Gemini Imagen prompt — Instagram 1080x1080px square, visually stunning lifestyle scene, [DESCRIBE SCENE], vibrant colors, [BRAND COLORS], photorealistic"
    },
    "facebook": {
      "adapted_content": "Facebook-optimized post (400-600 chars)",
      "character_count": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "image_prompt": "Detailed Gemini Imagen prompt — Facebook cover 1200x630px, community-oriented scene, [DESCRIBE SCENE], warm engaging composition, [BRAND COLORS], photorealistic"
    },
    "tiktok": {
      "adapted_content": "TikTok-optimized caption (200-300 chars)",
      "video_script": "15-60 second video script with hook, content, CTA",
      "character_count": 0,
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "image_prompt": "Detailed Gemini Imagen prompt — TikTok thumbnail 1080x1920px vertical, eye-catching hook visual, [DESCRIBE SCENE], trend-aligned, [BRAND COLORS], photorealistic"
    }
  },
  "cover_image": {
    "main_prompt": "Master Gemini Imagen prompt — versatile across all platforms, 1200x630px base, [DESCRIBE KEY VISUAL CONCEPT], professional quality, brand-aligned",
    "style": "photorealistic|illustration|minimalist|bold|professional",
    "color_palette": ["#hex1", "#hex2", "#hex3"],
    "mood": "professional|energetic|calm|inspiring|bold",
    "key_elements": ["element1", "element2", "element3"]
  },
  "scores": {
    "human_writing_index": {
      "value": 0,
      "threshold": 75,
      "passes": true,
      "factors": {
        "natural_language": 0,
        "personal_anecdotes": 0,
        "varied_structure": 0,
        "emotional_depth": 0
      },
      "explanation": "Detailed explanation of why this score was achieved",
      "detected_ai_phrases": [],
      "human_signals_found": []
    },
    "virality_score": {
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
    "engagement_score": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "cta_strength": 0,
        "interaction_prompt": 0,
        "value_density": 0,
        "emotional_connection": 0
      },
      "explanation": "string"
    },
    "roi_score": {
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
    "trend_alignment": {
      "value": 0,
      "threshold": 70,
      "passes": true,
      "factors": {
        "current_trend": 0,
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
    "ready_to_publish": true
  },
  "eeat_analysis": {
    "experience_signals": ["string"],
    "expertise_signals": ["string"],
    "authoritativeness_signals": ["string"],
    "trustworthiness_signals": ["string"]
  },
  "optimization_suggestions": ["string"],
  "research_sources": [
    { "source": "URL or publication", "relevance": "high|medium|low", "key_insight": "string", "used_in": ["linkedin", "twitter"] }
  ],
  "tavily_data_used": ["key insight 1 used", "key insight 2 used"],
  "ai_detection_risk": {
    "value": 0,
    "label": "low|medium-low|medium-high|high",
    "explanation": "string"
  }
}
</output_format>
```

### User Prompt Template (Paso 2 — con feedback de iteraciones anteriores)

```
Generate a complete social media content package for all 5 platforms with high-quality scores.

━━━ SELECTED TOPIC ━━━
Title: [TITLE]
Angle: [ANGLE]
Hook: [HOOK]
Suggested Format: [FORMAT]
Key Trend: [KEY_TREND]
Content Type: [CONTENT_TYPE]

━━━ CONTEXT ━━━
Niche: [NICHE]
Target Audience: [AUDIENCE]
Business Goal: [AWARENESS|ENGAGEMENT|VIRAL|LEADS|SALES|COMMUNITY]
Brand Voice: [PROFESSIONAL|CONVERSATIONAL|TRENDY|INSPIRATIONAL|HUMOROUS]
Company/Organization: [NAME]
Industry: [INDUSTRY]
Key Differentiators: [LIST]

━━━ TAVILY RESEARCH (Iteration [N]) ━━━
[INSERT_TAVILY_RESEARCH_RESULTS]
Research queries used:
- "[TITLE] [NICHE] 2026 trends"
- "[KEY_TREND] statistics recent data"
- "[NICHE] viral examples social media"
- "[AUDIENCE] pain points content preferences"

━━━ ITERATION FEEDBACK ━━━
Current Iteration: [N] of 5

[IF N=1:]
This is the first attempt. Generate the best possible content from the start.
Target: ALL scores ≥ their thresholds.

[IF N>1:]
Previous attempt scores:
- Human Writing Index: [VALUE]/100 (threshold: 75) → [PASS/FAIL]
- Virality Score: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- Engagement Score: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- ROI Score: [VALUE]/100 (threshold: 70) → [PASS/FAIL]
- Trend Alignment: [VALUE]/100 (threshold: 70) → [PASS/FAIL]

Scores that FAILED and need improvement:
[FOR EACH FAILING SCORE:]
- [SCORE_NAME]: Was [VALUE], needs [THRESHOLD]+
  Why it failed: [PREVIOUS_EXPLANATION]
  Specific fix needed: [DERIVED_FROM_RULES]

IMPORTANT: Do NOT repeat the same content. Change the approach for failing scores while keeping what worked.

━━━ REQUIREMENTS ━━━
- Platforms: LinkedIn (1200x627), Twitter/X (1200x675), Instagram (1080x1080), Facebook (1200x630), TikTok (1080x1920)
- Each platform must have its own adapted content, hashtags, and Gemini Imagen cover prompt
- All 5 scores MUST exceed their thresholds
- Human Writing Index is CRITICAL (≥75) — use personal anecdotes, varied structure, no AI phrases
- Include specific data points from Tavily research
- Each image prompt must be detailed enough for Gemini Imagen to generate a platform-specific cover
- TikTok must include video script
- Twitter/X: if thread format, mark tweets as [1/N], [2/N], etc.
```

---

## Tavily Research Queries por Iteración

El sistema debe ejecutar búsquedas Tavily ANTES de cada llamada a AI. Las queries deben variar en cada iteración para aportar contexto fresco.

```typescript
function getTavilyQueries(topic, context, iteration) {
  const baseQueries = [
    `${topic.title} ${context.niche} 2026`,
    `${topic.key_trend} statistics recent data`,
    `${context.niche} audience insights trends`,
  ];

  const iterationQueries = {
    1: baseQueries,
    2: [
      ...baseQueries,
      `${context.niche} viral examples social media`,
      `${topic.title} engagement benchmarks`,
    ],
    3: [
      ...baseQueries,
      `${context.niche} trending topics 2025 2026`,
      `${topic.key_trend} industry report`,
    ],
    4: [
      `${context.niche} authority sources citations`,
      `${topic.title} social media best practices`,
      `${topic.key_trend} content examples`,
    ],
    5: [
      `${context.niche} top performing posts engagement`,
      `${topic.title} conversion rate benchmarks`,
      `${context.niche} human written content examples`,
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
  human_writing_index: ScoreResult;
  virality_score: ScoreResult;
  engagement_score: ScoreResult;
  roi_score: ScoreResult;
  trend_alignment: ScoreResult;
}

function evaluateScores(scores: AllScores): {
  allPass: boolean;
  failingScores: string[];
  overallAverage: number;
} {
  const thresholds = {
    human_writing_index: 75,
    virality_score: 70,
    engagement_score: 70,
    roi_score: 70,
    trend_alignment: 70,
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

## Schema Prisma (actualizado)

```prisma
model SocialMediaContent {
  id            String   @id @default(uuid())
  niche         String
  topic         String
  angle         String
  hook          String
  platform      String   @default("multi") // "multi" para contenido en todas las plataformas
  audience      String
  goal          String
  brandVoice    String
  company       String?

  // Contenido principal
  headline      String
  body          String
  callToAction  String
  hashtags      String[]

  // Variaciones por plataforma
  linkedinContent     String?
  linkedinCharCount   Int?
  linkedinHashtags    String[]

  twitterContent      String?
  twitterCharCount    Int?
  twitterIsThread     Boolean  @default(false)
  twitterThreadTweets Json?
  twitterHashtags     String[]

  instagramContent    String?
  instagramCharCount  Int?
  instagramHashtags   String[]

  facebookContent     String?
  facebookCharCount   Int?
  facebookHashtags    String[]

  tiktokContent       String?
  tiktokVideoScript   String?
  tiktokCharCount     Int?
  tiktokHashtags      String[]

  // Imágenes (R2 paths relativos)
  mainCoverImage          String?
  linkedinCoverImage      String?
  twitterCoverImage       String?
  instagramCoverImage     String?
  facebookCoverImage      String?
  tiktokThumbnailImage    String?

  // Prompts de imagen (para regeneración con Gemini Imagen)
  mainImagePrompt         String?
  linkedinImagePrompt     String?
  twitterImagePrompt      String?
  instagramImagePrompt    String?
  facebookImagePrompt     String?
  tiktokImagePrompt       String?

  // Metadatos de imagen
  coverImageStyle     String?
  coverImageMood      String?
  coverImagePalette   String[]

  // AI metadata
  isAiGenerated       Boolean   @default(false)
  aiModel             String?   @default("gemini-2.5-flash")
  aiGeneratedAt       DateTime?
  iterationsRequired  Int?      @default(1)
  qualityWarning      Boolean   @default(false)
  qualityWarningMsg   String?

  // Scores completos (JSON)
  aiScores            Json?
  eeatAnalysis        Json?
  optimizationSuggestions String[]
  researchSources     Json?
  tavilyDataUsed      String[]
  aiDetectionRisk     Json?

  // Scores individuales (para queries y filtros rápidos)
  humanWritingIndex   Int?
  viralityScore       Int?
  engagementScore     Int?
  roiScore            Int?
  trendAlignment      Int?
  overallScoreAvg     Int?
  allScoresPass       Boolean  @default(false)

  // Estado
  status        String   @default("draft") // draft | ready | published | scheduled | needs_review
  scheduledAt   DateTime?
  publishedAt   DateTime?

  // Performance tracking
  views         Int      @default(0)
  likes         Int      @default(0)
  shares        Int      @default(0)
  comments      Int      @default(0)
  clicks        Int      @default(0)
  impressions   Int      @default(0)

  // Metadata
  createdBy     String
  updatedBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  @@map("social_media_content")
}
```

---

## Almacenamiento de Imágenes en R2

### Estructura de Paths

```
social-media/
  content/
    {content_id}/
      main-cover.png
      linkedin-cover.png      ← 1200x627
      twitter-cover.png       ← 1200x675
      instagram-cover.png     ← 1080x1080
      facebook-cover.png      ← 1200x630
      tiktok-thumbnail.png    ← 1080x1920
```

### Flujo de Imágenes

1. AI genera los 6 prompts de imagen (main + 5 plataformas)
2. Llamar a **Gemini Imagen API** con cada prompt y dimensiones específicas
3. Subir a R2 via StoragePort (disk: r2) usando el path relativo
4. Guardar paths en Prisma (no URLs completas)
5. Generar URLs públicas con StoragePort al retornar al frontend

```typescript
const imageDimensions = {
  main:       { width: 1200, height: 630 },
  linkedin:   { width: 1200, height: 627 },
  twitter:    { width: 1200, height: 675 },
  instagram:  { width: 1080, height: 1080 },
  facebook:   { width: 1200, height: 630 },
  tiktok:     { width: 1080, height: 1920 },
};
```

---

## Observación de Arquitectura: Cache

**Cache en Social Media Module (NO en External AI)**

**External AI (shared/external/ai):**
- ❌ NO tiene cache
- Solo es el cliente/adaptador para llamar a APIs (Gemini, Anthropic, OpenAI)
- Responsabilidad: conectar con el proveedor AI

**Social Media Module:**
- ✅ SÍ tiene cache implementado
- Ubicación: `src/modules/social-media/infrastructure/jobs/social-media-generation.processor.ts`
- Ubicación: `src/modules/social-media/application/commands/handlers/generate-social-content.handler.ts`

**Estrategia de cache en Social Media:**
1. Cache key estable basado en parámetros de entrada (topic, niche, goal)
2. Check cache antes de llamar AI → si hit, retorna resultado sin llamar Gemini + Tavily
3. Guardar resultado en cache después de generación exitosa
4. Invalidación de cache cuando se crea/actualiza/elimina contenido

**Objetivo:** Evitar llamadas duplicadas a Gemini + Tavily con los mismos parámetros dentro del TTL, reduciendo costos de API.

**Por qué el cache está en Social Media y no en External AI:**
- External AI es infraestructura genérica (solo llama APIs)
- Cache es decisión de negocio (evitar costos duplicados)
- Cada bounded context decide su propia estrategia de cache
- Social Media module cachea resultados específicos de generación de contenido

---

## Flujo con Job Queue y Cronjob

**Arquitectura Asíncrona:**

El flujo de generación de contenido usa BullMQ para procesamiento asíncrono y WebSocket para actualizaciones en tiempo real.

**Componentes:**
- `SocialMediaGenerationProcessor` - Procesador BullMQ que ejecuta el loop de calidad
- `SocialMediaScheduler` - Cronjob para tareas programadas (publicación automática)
- `SocialMediaGateway` - WebSocket Gateway para actualizaciones en tiempo real
- `WsJwtMiddleware` - Middleware JWT para autenticación WebSocket

**Flujo de Generación:**
1. Frontend llama a `/api/social-media/generate-content`
2. CommandHandler encola job en BullMQ con parámetros
3. `SocialMediaGenerationProcessor` ejecuta loop de calidad (máx 5 iteraciones)
4. Cada iteración: Tavily Research → AI → Evaluación scores
5. WebSocket emite progreso al frontend (iteración actual, scores parciales)
6. Al completar: resultado guardado en cache + emitido por WebSocket
7. Frontend recibe resultado final cuando todos los scores pasan

**Flujo de Publicación Programada (Cronjob):**
- `SocialMediaScheduler` revisa contenido con `scheduledAt` futuro
- Cuando llega la fecha: cambia status a `published` + invalida cache
- Opcional: notificación por WebSocket al usuario

---

## Generación de ZIP al Aceptar Resultado

**Cuando el usuario acepta/guarda el resultado:**

**Contenido del ZIP:**
```
social-media-content-{timestamp}/
├── README.txt
├── content/
│   ├── linkedin-post.txt
│   ├── twitter-post.txt
│   ├── instagram-post.txt
│   ├── facebook-post.txt
│   └── tiktok-script.txt
├── images/
│   ├── main-cover.png
│   ├── linkedin-cover.png
│   ├── twitter-cover.png
│   ├── instagram-cover.png
│   ├── facebook-cover.png
│   └── tiktok-thumbnail.png
└── metadata/
    ├── scores-report.json
    ├── eeat-analysis.json
    └── research-sources.json
```

**README.txt:**
```
Social Media Content Package
Generated: {timestamp}
Provider: {gemini|anthropic|openai}
Iterations: {N}
Quality Warning: {true|false}

Scores:
- Human Writing Index: {value}/100
- Virality Score: {value}/100
- Engagement Score: {value}/100
- ROI Score: {value}/100
- Trend Alignment: {value}/100

All Scores Pass: {true|false}
```

**Flujo de Generación ZIP:**
1. Usuario hace clic en "Aceptar y Descargar ZIP"
2. Backend genera estructura de carpetas
3. Descarga imágenes desde R2 (o usa paths relativos si ya están en R2)
4. Escribe archivos de texto con contenido de cada plataforma
5. Genera archivos JSON con metadata (scores, research)
6. Comprime todo en ZIP
7. Sube ZIP a R2 o retorna como stream de descarga
8. Invalida cache del contenido (si se guardó en DB)

**Endpoint ZIP:**
```
POST /api/social-media/{id}/download-zip
Response: application/zip (stream)
```

---

## Respuesta Final al Frontend

Solo se retorna cuando `all_scores_pass === true` O cuando `iterations === MAX_ITERATIONS`.

```json
{
  "success": true,
  "data": {
    "content": {
      "id": "uuid",
      "status": "ready",
      "iterations_required": 2,
      "quality_warning": false
    },
    "content": {
      "headline": "string",
      "body": "string",
      "call_to_action": "string",
      "hashtags": ["#tag1"]
    },
    "platforms": {
      "linkedin": {
        "content": "string",
        "character_count": 1240,
        "hashtags": ["#tag1"],
        "cover_image_url": "https://r2.domain.com/social-media/content/{id}/linkedin-cover.png",
        "cover_dimensions": "1200x627"
      },
      "twitter": {
        "content": "string",
        "character_count": 278,
        "is_thread": false,
        "thread_tweets": [],
        "hashtags": ["#tag1"],
        "cover_image_url": "https://r2.domain.com/social-media/content/{id}/twitter-cover.png",
        "cover_dimensions": "1200x675"
      },
      "instagram": {
        "content": "string",
        "character_count": 490,
        "hashtags": ["#tag1"],
        "cover_image_url": "https://r2.domain.com/social-media/content/{id}/instagram-cover.png",
        "cover_dimensions": "1080x1080"
      },
      "facebook": {
        "content": "string",
        "character_count": 490,
        "hashtags": ["#tag1"],
        "cover_image_url": "https://r2.domain.com/social-media/content/{id}/facebook-cover.png",
        "cover_dimensions": "1200x630"
      },
      "tiktok": {
        "content": "string",
        "video_script": "string",
        "character_count": 250,
        "hashtags": ["#tag1"],
        "cover_image_url": "https://r2.domain.com/social-media/content/{id}/tiktok-thumbnail.png",
        "cover_dimensions": "1080x1920"
      }
    },
    "cover_images": {
      "main": {
        "url": "https://r2.domain.com/social-media/content/{id}/main-cover.png",
        "dimensions": "1200x630"
      }
    },
    "scores": {
      "human_writing_index": {
        "value": 82,
        "threshold": 75,
        "passes": true,
        "label": "Human-Like",
        "color": "yellow",
        "factors": { "natural_language": 85, "personal_anecdotes": 78, "varied_structure": 83, "emotional_depth": 80 },
        "explanation": "string",
        "detected_ai_phrases": [],
        "human_signals_found": ["personal anecdote included", "varied sentence length"]
      },
      "virality_score": {
        "value": 76,
        "threshold": 70,
        "passes": true,
        "label": "Good",
        "color": "yellow",
        "factors": { "hook_strength": 82, "shareability": 74, "timing": 71, "emotional_trigger": 77 },
        "explanation": "string"
      },
      "engagement_score": {
        "value": 78,
        "threshold": 70,
        "passes": true,
        "label": "Good",
        "color": "yellow",
        "factors": { "cta_strength": 80, "interaction_prompt": 76, "value_density": 78, "emotional_connection": 77 },
        "explanation": "string"
      },
      "roi_score": {
        "value": 74,
        "threshold": 70,
        "passes": true,
        "label": "Good",
        "color": "yellow",
        "factors": { "conversion_potential": 75, "brand_alignment": 73, "lead_generation": 74 },
        "explanation": "string"
      },
      "trend_alignment": {
        "value": 79,
        "threshold": 70,
        "passes": true,
        "label": "Good",
        "color": "yellow",
        "factors": { "current_trend": 81, "timeliness": 77, "platform_format": 79 },
        "explanation": "string"
      },
      "ai_detection_risk": {
        "value": 18,
        "label": "low",
        "explanation": "string"
      },
      "summary": {
        "all_pass": true,
        "overall_average": 78,
        "ready_to_publish": true,
        "iterations_required": 2
      }
    },
    "eeat_analysis": {
      "experience_signals": ["string"],
      "expertise_signals": ["string"],
      "authoritativeness_signals": ["string"],
      "trustworthiness_signals": ["string"]
    },
    "optimization_suggestions": ["string"],
    "research_sources": [
      { "source": "string", "relevance": "high", "key_insight": "string", "used_in": ["linkedin", "twitter"] }
    ],
    "metadata": {
      "ai_model": "gemini-2.5-flash",
      "imagen_model": "gemini-imagen-3",
      "tavily_searches_performed": 3,
      "ai_generated_at": "2026-05-28T00:00:00Z",
      "created_at": "2026-05-28T00:00:00Z"
    }
  }
}
```

---

## Score Labels y Colores (Frontend)

```typescript
const SCORE_CONFIG = {
  human_writing_index: {
    icon: "🧑",
    label: "Human Writing",
    threshold: 75,
    critical: true,
    labels: { 90: "Excellent", 75: "Human-Like", 50: "Mixed", 0: "AI-Detected" },
    colors: { 90: "#10B981", 75: "#F59E0B", 50: "#F97316", 0: "#EF4444" },
    alertBelow: 75,
    blockPublishBelow: 75,
  },
  virality_score: {
    icon: "🔥",
    label: "Virality",
    threshold: 70,
    critical: false,
    labels: { 85: "High", 70: "Good", 50: "Medium", 0: "Low" },
    colors: { 85: "#10B981", 70: "#F59E0B", 50: "#F97316", 0: "#EF4444" },
  },
  engagement_score: {
    icon: "💬",
    label: "Engagement",
    threshold: 70,
    critical: false,
    labels: { 85: "High", 70: "Good", 50: "Medium", 0: "Low" },
    colors: { 85: "#10B981", 70: "#F59E0B", 50: "#F97316", 0: "#EF4444" },
  },
  roi_score: {
    icon: "💰",
    label: "ROI",
    threshold: 70,
    critical: false,
    labels: { 85: "High", 70: "Good", 50: "Medium", 0: "Low" },
    colors: { 85: "#10B981", 70: "#F59E0B", 50: "#F97316", 0: "#EF4444" },
  },
  trend_alignment: {
    icon: "📈",
    label: "Trend",
    threshold: 70,
    critical: false,
    labels: { 85: "High", 70: "Good", 50: "Medium", 0: "Low" },
    colors: { 85: "#10B981", 70: "#F59E0B", 50: "#F97316", 0: "#EF4444" },
  },
};

// Determinar estado general del contenido
function getPublishStatus(scores: AllScores): "ready" | "needs_review" | "blocked" {
  const humanWriting = scores.human_writing_index?.value ?? 0;
  if (humanWriting < 75) return "blocked";

  const allPass = Object.entries(SCORE_CONFIG).every(
    ([key, config]) => (scores[key]?.value ?? 0) >= config.threshold
  );
  return allPass ? "ready" : "needs_review";
}
```

---

## Best Practices

1. **Tavily en cada iteración** — siempre ejecutar research antes de llamar a AI, incluso en iteración 1. Queries deben variar por iteración para diversificar el contexto.

2. **Human Writing Index es el gatekeeper** — si está por debajo de 75, regenerar siempre, sin excepción, independientemente de otros scores.

3. **Feedback específico al regenerar** — no solo decir "mejora el score", sino pasar el score exacto, qué falló, y qué cambio concreto se necesita.

4. **No mostrar al usuario nada hasta que pase** — el frontend debe mostrar un estado de "generando y optimizando..." con progreso, y solo renderizar el resultado cuando `all_scores_pass === true`.

5. **Guardar el mejor intento** — aunque el loop falle tras 5 iteraciones, guardar en DB el mejor intento con `quality_warning: true` para revisión manual.

6. **Transacción DB + R2 atómica** — guardar contenido en Prisma y subir imágenes a R2 en la misma transacción. Si falla la imagen, no marcar el contenido como "ready".

7. **Prompts de imagen independientes por plataforma** — cada imagen prompt debe ser completo y autocontenido, sin referencias a "la imagen anterior".

8. **TikTok video script** — incluir script de video detallado con hook (0-3s), contenido, y CTA para facilitar la grabación.

9. **Twitter/X thread detection** — si el contenido supera 280 chars, automáticamente dividir en thread y marcar `is_thread: true` con array `thread_tweets`.

10. **Actualizar thresholds trimestralmente** — los estándares de calidad de plataformas evolucionan. Revisar y ajustar thresholds cada Q.

