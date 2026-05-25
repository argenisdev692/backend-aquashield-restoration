Eres un experto en NestJS con arquitectura hexagonal (Ports & Adapters) y DDD.

## Contexto del proyecto
- Framework: NestJS con TypeScript estricto
- Arquitectura: Hexagonal + DDD
- Estructura de carpetas por módulo:
  domain/ application/ infrastructure/ presentation/ + core/ adapters/ ports/
- Los ports se nombran: *.port.ts (ej: tavily.port.ts, gemini.port.ts)
- Ya existen estos adapters implementados (NO los generes, solo importa sus tokens/interfaces):
  - GeminiAdapter → port: gemini-ia.port.ts
  - TavilyAdapter → port: tavily.port.ts
  - R2CloudflareAdapter → port: r2-storage.port.ts

## Módulo a generar: SocialMediaModule

### Descripción funcional
Generador de posts para redes sociales. Flujo en 2 endpoints:

**Endpoint 1 — POST /social-media/topics**
- Recibe: { niche: string, language?: string }
- Llama al TavilyPort para buscar tendencias virales del nicho
- Devuelve: Topic[] con estructura:
  { id: string, title: string, description: string, trendScore: number, tags: string[] }

**Endpoint 2 — POST /social-media/generate**
- Recibe:
  {
    topicId: string,
    topic: { title: string, description: string },
    networks: {
      facebook?: boolean,
      instagram?: boolean,
      tiktok?: boolean,
      linkedin?: boolean
    },
    language?: string
  }
- Llama al GeminiPort con UN SOLO prompt que devuelva JSON con los posts
  solo para las redes donde el boolean sea true
- Guarda el resultado en R2CloudflarePort como JSON histórico con key:
  social-media/posts/{userId}/{timestamp}.json
- Devuelve: GeneratedPostResult con estructura:
  {
    postId: string,
    generatedAt: Date,
    topic: Topic,
    posts: {
      facebook?: { body: string, hashtags: string[] },
      instagram?: { body: string, hashtags: string[], emojis: string },
      tiktok?: { body: string, hashtags: string[], hook: string },
      linkedin?: { body: string, hashtags: string[] }
    }
  }

### Reglas de generación del prompt a Gemini
- Un único call a Gemini que reciba el topic + redes activas
- El prompt debe indicar a Gemini que responda SOLO en JSON válido sin markdown
- Cada red tiene su propio tono:
  - Facebook: conversacional, 150-300 palabras, 5-8 hashtags
  - Instagram: visual, emojis, 80-150 palabras, 10-15 hashtags
  - TikTok: hook poderoso en primera línea, lenguaje joven, 50-80 palabras, 8-12 hashtags
  - LinkedIn: profesional, valor de negocio, 150-250 palabras, 3-5 hashtags
- Si una red no está activa (false o undefined), NO incluirla en el JSON de respuesta

### Estructura de carpetas a generar
src/social-media/
  domain/
    entities/
      topic.entity.ts
      generated-post.entity.ts
    value-objects/
      social-networks.vo.ts
      post-content.vo.ts
    ports/
      topic-finder.port.ts
      post-generator.port.ts
      post-history.port.ts
  application/
    use-cases/
      find-topics.use-case.ts
      generate-post.use-case.ts
    dtos/
      find-topics.dto.ts
      generate-post.dto.ts
      generated-post-result.dto.ts
  infrastructure/
    adapters/
      tavily-topic-finder.adapter.ts   ← implementa topic-finder.port.ts usando TavilyPort
      gemini-post-generator.adapter.ts ← implementa post-generator.port.ts usando GeminiPort
      r2-post-history.adapter.ts       ← implementa post-history.port.ts usando R2Port
  presentation/
    controllers/
      social-media.controller.ts
    swagger/
      social-media.swagger.ts
  social-media.module.ts

### Requisitos adicionales
- Todos los ports deben tener su INJECTION TOKEN como Symbol exportado
- Los use-cases reciben dependencias solo por puerto (nunca adapter directo)
- Decoradores Swagger en el controller con @ApiTags, @ApiOperation, @ApiResponse
- Validación con class-validator en todos los DTOs
- Manejo de errores con excepciones de NestJS (NotFoundException, BadRequestException)
- El prompt de Gemini debe ser un método privado en gemini-post-generator.adapter.ts
  llamado buildPrompt(topic, activeNetworks, language)
- Exportar SOCIAL_MEDIA_TOKENS como objeto con todos los injection tokens del módulo

### Lo que NO debes generar
- La implementación interna de GeminiAdapter, TavilyAdapter ni R2Adapter
- Tests unitarios (se harán después)
- Migraciones de base de datos

Genera todos los archivos con código completo, sin placeholders ni comentarios
tipo "// implementar aquí". Cada archivo debe ser funcional y compilable.
Empieza por las entidades del dominio, luego ports, luego use-cases, luego
adapters de infraestructura, luego controller y finalmente el module.