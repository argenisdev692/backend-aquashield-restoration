Eres un experto en NestJS con arquitectura hexagonal (Ports & Adapters) y DDD.

CONTEXTO DEL PROYECTO
- Framework: NestJS con TypeScript estricto
- Arquitectura: Hexagonal + DDD
- Estructura: domain/ application/ infrastructure/ presentation/ + core/ adapters/ ports/
- Ports nombrados: *.port.ts
- Adapters ya existentes (NO generar, solo importar tokens):
    GeminiAdapter        → port: gemini-ia.port.ts
    R2CloudflareAdapter  → port: r2-storage.port.ts
    ElevenLabsAdapter    → port: elevenlabs.port.ts (@Optional)
- Package de audio: elevenlabs (npm install elevenlabs)
- Package ZIP:      archiver (npm install archiver @types/archiver)
- Package PDF:      pdfkit (npm install pdfkit @types/pdfkit)

═══════════════════════════════════════════════
MÓDULO: CampaignExportModule
═══════════════════════════════════════════════

ENDPOINT: POST /campaigns/export
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Request DTO: ExportCampaignDto
{
  businessName:    string,
  niche:           string,
  location:        string,
  phone:           string,
  website?:        string,
  stages:          FunnelStage[],   // ['TOFU','MOFU','BOFU','LOYALTY'] o subset
  format:          '9:16' | '16:9' | 'both',
  durationSeconds: 15 | 20,
  language?:       string,          // default: 'es'
  generateImages:  boolean,         // true = Gemini genera imagen por escena
}

Response DTO: ExportCampaignResultDto
{
  exportId:          string,
  generatedAt:       Date,
  stages:            FunnelStage[],
  elevenLabsEnabled: boolean,
  imagesEnabled:     boolean,
  zips: {
    [stage: string]: {
      zipKey:  string,             // key en R2
      zipUrl:  string,             // URL de descarga desde R2
      sizeKb:  number,
      files:   string[],           // lista de archivos dentro del ZIP
    }
  },
  errors?: { [stage: string]: string }
}

═══════════════════════════════════════════════
ESTRUCTURA DE CADA ZIP (uno por etapa)
═══════════════════════════════════════════════

{STAGE}_campaign.zip
├── script/
│   ├── script_916.txt             ← guion narrado 9:16 en texto plano
│   └── script_169.txt             ← guion narrado 16:9 en texto plano
├── audio/                         ← solo si ELEVENLABS_API_KEY en .env.example
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

═══════════════════════════════════════════════
CONTENIDO DEL PDF (production_brief.pdf)
═══════════════════════════════════════════════

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
       · Si generateImages=true:  imagen generada por Gemini Imagen
       · Si generateImages=false: placeholder gris con descripción centrada
   - Descripción visual
   - Keywords de búsqueda sugeridos
   - Duración en segundos

4. NOTAS DE PRODUCCIÓN
   - Specs técnicos del formato
   - Tono de música sugerido
   - Paleta de colores (swatches con hex)
   - Estilo de transición

═══════════════════════════════════════════════
LÓGICA DE IMÁGENES (Gemini Imagen)
═══════════════════════════════════════════════

Solo si generateImages: true en el request.

En ai-image-generator.adapter.ts:
  - Implementa AiImageGeneratorPort
  - Usa GeminiPort para llamar generateImage(prompt: string): Promise<Buffer>
  - El prompt de imagen se construye así:
      `Professional advertising photo for ${niche} business.
       Scene: ${scene.visualDescription}.
       Style: cinematic, high quality, natural lighting.
       NO text, NO logos, NO watermarks.`
  - Retornar Buffer JPEG
  - Si Gemini Imagen no está disponible en el GeminiPort base,
    crear el método con esta firma en el port:
      generateImage(prompt: string): Promise<Buffer>
    e implementarlo en el adapter lanzando NotImplementedException
    con mensaje: 'Gemini Image generation not configured in GeminiAdapter'

Si generateImages: false:
  - No llamar Gemini para imágenes
  - En el PDF: placeholder gris (doc.rect().fill('#CCCCCC'))
    con texto de descripción centrado en blanco
  - En scenes/scene_0X/: solo description.txt, sin image.jpg

═══════════════════════════════════════════════
DETECCIÓN ELEVENLABS (.env.example)
═══════════════════════════════════════════════

- En onModuleInit leer .env.example con fs.readFileSync
- Si contiene 'ELEVENLABS_API_KEY': activar audio
- Si NO contiene: omitir carpeta audio/ del ZIP, sin error
- Package: elevenlabs (ElevenLabsClient)
- Modelo: eleven_multilingual_v2
- Voz default: 'Rachel' o process.env.ELEVENLABS_VOICE_ID
- Generar narration_916.mp3 y narration_169.mp3 en paralelo (Promise.all)
- Convertir ReadableStream de ElevenLabs a Buffer:
    async function streamToBuffer(stream: Readable): Promise<Buffer> {
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      return Buffer.concat(chunks)
    }

═══════════════════════════════════════════════
FLUJO DEL USE-CASE (generate-export.use-case.ts)
═══════════════════════════════════════════════

Procesar cada stage en paralelo: Promise.all(stages.map(...))
Por cada stage:

  PASO 1 — Generar contenido con Gemini
    campaignData = await campaignExportGeneratorPort.generate(dto, stage)

  PASO 2 — Operaciones paralelas con Promise.allSettled
    [audioResults, imageResults] = await Promise.allSettled([
      this.generateAudios(campaignData),    // ElevenLabs @Optional
      this.generateImages(campaignData, dto.generateImages), // Gemini Imagen
    ])

  PASO 3 — Construir PDF
    pdfBuffer = await pdfBuilderPort.build(campaignData, images, stage)

  PASO 4 — Armar ZIP en memoria
    const archive = archiver('zip', { zlib: { level: 9 } })
    const zipBuffer = await this.buildZip(archive, {
      scripts, audios, images, pdfBuffer, sceneDescriptions
    })

  PASO 5 — Subir ZIP a R2
    zipKey = `exports/{exportId}/{stage}/{stage}_campaign.zip`
    zipUrl = await exportStoragePort.upload(zipKey, zipBuffer)

  PASO 6 — Retornar metadata del ZIP
    { zipKey, zipUrl, sizeKb, files }

Manejo de errores:
  - Si un stage falla: capturar, loggear, continuar con los demás
  - Incluir en response.errors: { [stage]: errorMessage }
  - Nunca fallar el endpoint completo por un stage individual

═══════════════════════════════════════════════
PROMPT A GEMINI (buildExportPrompt)
═══════════════════════════════════════════════

Método privado en gemini-export.adapter.ts.
Gemini debe responder SOLO JSON sin markdown ni backticks:

{
  "stage": "TOFU",
  "scripts": {
    "vertical_916": {
      "narration": "texto narrado completo...",
      "overlayTexts": ["texto pantalla 1", "texto pantalla 2"],
      "cta": "texto call to action"
    },
    "horizontal_169": {
      "narration": "...",
      "overlayTexts": [...],
      "cta": "..."
    }
  },
  "scenes": [
    {
      "id": 1,
      "timecode": "0:00-0:03",
      "title": "Apertura impacto",
      "visualDescription": "descripción detallada en inglés para imagen IA",
      "imageKeywords": ["keyword1", "keyword2", "keyword3"],
      "durationSeconds": 3
    }
    // 4 escenas total
  ],
  "productionNotes": {
    "specs916": "1080x1920px · 60fps · subtítulos centrados",
    "specs169": "1920x1080px · 30fps · lower thirds",
    "musicTone": "descripción del tono musical",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "transitionStyle": "descripción del estilo de transición"
  }
}

Tono por etapa:
  TOFU:    educativo, empático, sin presión de venta
  MOFU:    informativo, profesional, genera confianza
  BOFU:    urgente, directo, acción inmediata
  LOYALTY: cálido, agradecido, comunitario

═══════════════════════════════════════════════
ESTRUCTURA DE CARPETAS
═══════════════════════════════════════════════

src/campaign-export/
  domain/
    entities/
      campaign-export.entity.ts
    value-objects/
      funnel-stage.vo.ts
      export-package.vo.ts
    ports/
      campaign-export-generator.port.ts   ← genera scripts+escenas (Gemini)
      ai-image-generator.port.ts          ← genera imagen por escena (Gemini)
      audio-generator.port.ts             ← text-to-speech (ElevenLabs)
      pdf-builder.port.ts                 ← genera PDF Buffer (pdfkit)
      export-storage.port.ts              ← sube ZIP a R2, retorna URL
  application/
    use-cases/
      generate-export.use-case.ts
    dtos/
      export-campaign.dto.ts
      export-campaign-result.dto.ts
  infrastructure/
    adapters/
      gemini-export.adapter.ts            ← implementa campaign-export-generator.port
      gemini-image.adapter.ts             ← implementa ai-image-generator.port
      elevenlabs-audio.adapter.ts         ← implementa audio-generator.port
      pdfkit-builder.adapter.ts           ← implementa pdf-builder.port
      r2-export-storage.adapter.ts        ← implementa export-storage.port
    config/
      elevenlabs-detection.config.ts      ← lee .env.example
  presentation/
    controllers/
      campaign-export.controller.ts
    swagger/
      campaign-export.swagger.ts
  campaign-export.module.ts

═══════════════════════════════════════════════
REQUISITOS TÉCNICOS
═══════════════════════════════════════════════

- CAMPAIGN_EXPORT_TOKENS: objeto con todos los Symbol injection tokens
- @Optional() en AudioGeneratorPort — nunca error si ElevenLabs no está
- Promise.allSettled para operaciones paralelas — nunca bloquear por fallo
- Swagger completo: @ApiTags, @ApiOperation, @ApiResponse, @ApiProperty
- class-validator en todos los DTOs (@IsArray, @IsEnum, @IsBoolean, etc.)
- Logger de NestJS en use-case y adapters con contexto claro
- archiver modo 'zip' compresión level 9, todo en memoria (sin writeFile)
- pdfkit: fuente Helvetica, imágenes con doc.image(buffer, x, y, { width })
- streamToBuffer helper en shared/utils/stream-to-buffer.util.ts
- Todo código completo y compilable SIN placeholders ni TODO

LO QUE NO DEBES GENERAR
- Implementación interna base de GeminiAdapter ni R2Adapter
- Tests unitarios
- Migraciones de base de datos
- El archivo .env.example

ORDEN DE GENERACIÓN
1. Value objects y entidad
2. Ports con tokens (incluyendo generateImage en gemini-ia.port.ts si no existe)
3. DTOs con validaciones
4. streamToBuffer util
5. generate-export.use-case.ts con Promise.allSettled
6. gemini-export.adapter.ts (scripts + escenas + buildExportPrompt)
7. gemini-image.adapter.ts (imagen por escena)
8. elevenlabs-audio.adapter.ts (elevenlabs npm, streamToBuffer)
9. pdfkit-builder.adapter.ts (timeline + imágenes embebidas + placeholder)
10. r2-export-storage.adapter.ts (ZIP upload + URL firmada)
11. elevenlabs-detection.config.ts
12. Controller con Swagger
13. Module con todos los providers