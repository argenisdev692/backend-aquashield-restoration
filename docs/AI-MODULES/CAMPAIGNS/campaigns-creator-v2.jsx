import { useState, useRef, useEffect } from "react";

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0f",
  surface: "#111118",
  card: "#16161f",
  border: "#1e1e2e",
  borderHover: "#2e2e4e",
  accent: "#6366f1",
  accentGlow: "rgba(99,102,241,0.15)",
  accentHover: "#818cf8",
  gold: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  yellow: "#f59e0b",
  purple: "#a855f7",
  blue: "#3b82f6",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#475569",
};

const FORMATS = [
  { id: "9:16", label: "9:16 (Vertical)", icon: "📱", dims: "1080×1920" },
  { id: "16:9", label: "16:9 (Horizontal)", icon: "📺", dims: "1920×1080" },
  { id: "both", label: "Ambos", icon: "🔄", dims: "9:16 + 16:9" },
];

const FUNNEL_STAGES = [
  { id: "TOFU", label: "TOFU (Awareness)", icon: "🔵", color: "#3b82f6", description: "Educativo, empático, sin presión" },
  { id: "MOFU", label: "MOFU (Consideration)", icon: "🟢", color: "#14b8a6", description: "Informativo, profesional, confianza" },
  { id: "BOFU", label: "BOFU (Decision)", icon: "🟠", color: "#f97316", description: "Urgente, directo, acción inmediata" },
  { id: "LOYALTY", label: "LOYALTY (Retention)", icon: "🟣", color: "#a855f7", description: "Cálido, agradecido, comunitario" },
];

const GOALS = ["awareness", "engagement", "viral", "leads", "sales", "community"];
const VOICES = ["professional", "conversational", "trendy", "inspirational", "humorous"];

const AI_PROVIDERS = [
  { id: "gemini", label: "Gemini", icon: "✨", color: "#4285F4" },
  { id: "anthropic", label: "Claude", icon: "🤖", color: "#D97757" },
  { id: "openai", label: "OpenAI", icon: "🧠", color: "#10B981" },
];

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const STEP1_SYSTEM = `You are a Senior Video Marketing Strategist with 10+ years of experience in local market analysis, geographic targeting, and short-form video campaign optimization. You specialize in identifying high-potential video campaign topics based on niche analysis, local market conditions, audience behavior, and current trends in specific geographic locations.

INSTRUCTIONS:
1. Analyze the provided niche to understand the target audience, their pain points, and video content preferences in the specific geographic context.
2. Generate 10 video campaign topics that balance engagement potential, virality, ROI, and local market fit.
3. Each topic should include a clear angle, potential hook, estimated performance metrics, and geographic relevance.
4. Prioritize topics that demonstrate high viral potential and local market relevance.

CONSTRAINTS:
- Generate exactly 10 distinct video campaign topics
- Each topic must be unique and immediately actionable
- Focus on short-form video content (15-25 seconds) optimized for mobile viewing
- Focus on topics with high viral and ROI potential in the specific geographic location
- Avoid generic or over-saturated topics

Return ONLY a valid JSON object, no markdown, no preamble:
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
}`;

const STEP2_SYSTEM = `You are a Senior Video Marketing Strategist specializing in local market video campaigns, viral content, and AI-human hybrid video scripts that perform well in 2026. You write in a way that scores HIGH on human-likeness to avoid AI detection.

CRITICAL RULES:
1. Write with natural language, varied sentence structure, personal anecdotes, emotional resonance
2. Include first-hand experience or realistic case study details from the geographic location
3. NEVER use generic AI phrases: "In conclusion", "It's important to note", "In today's world"
4. Include data-backed claims with specific numbers and local context
5. Generate detailed image prompts for Gemini Imagen for each scene with geographic elements
6. Ensure local_market_fit > 75 and ai_detection_risk < 25
7. Video script must be 15-25 seconds (38-63 words maximum)
8. MUST include the user's AI_OBSERVATION phrase verbatim or naturally integrated
9. Optimize for short-form video formats: 9:16 vertical (TikTok/Reels/Shorts) or 16:9 horizontal (YouTube/Facebook)

Return ONLY a valid JSON object, no markdown, no preamble:
{
  "video_content": {
    "headline": "string",
    "narration": "string",
    "word_count": 0,
    "estimated_duration_seconds": 0,
    "overlay_texts": ["string"],
    "call_to_action": "string",
    "hashtags": ["string"]
  },
  "formats": {
    "vertical_916": { "adapted_narration": "string", "character_count": 0, "estimated_duration_seconds": 0, "audio_prompt": "ElevenLabs TTS prompt" },
    "horizontal_169": { "adapted_narration": "string", "character_count": 0, "estimated_duration_seconds": 0, "audio_prompt": "ElevenLabs TTS prompt" }
  },
  "scenes": [
    {
      "id": 1,
      "timecode": "0:00-0:05",
      "title": "string",
      "visual_description": "string",
      "image_keywords": ["string"],
      "duration_seconds": 5,
      "narration": "string",
      "overlay_text": "string"
    }
  ],
  "production_notes": {
    "specs_916": "string",
    "specs_169": "string",
    "music_tone": "string",
    "color_palette": ["#hex1", "#hex2"],
    "transition_style": "string"
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
    "local_market_fit": { "value": 0, "factors": ["string"], "explanation": "string" },
    "virality_probability": { "value": 0, "factors": ["string"], "explanation": "string" },
    "roi_potential": { "value": 0, "factors": ["string"], "explanation": "string" },
    "audience_alignment": { "value": 0, "factors": ["string"], "explanation": "string" },
    "trend_relevance": { "value": 0, "factors": ["string"], "explanation": "string" }
  },
  "optimization_suggestions": ["string"],
  "research_sources": [{ "source": "string", "relevance": "high|medium|low", "key_insight": "string" }],
  "ai_detection_risk": { "value": 0, "label": "low|medium-low|medium-high|high", "explanation": "string" },
  "ai_observation_included": true,
  "ai_observation_location": "string"
}`;

// ─── API CALLS ───────────────────────────────────────────────────────────────
async function callBackend(endpoint, body) {
  const res = await fetch(`/api/campaigns${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function ScoreRing({ value, label, size = 64 }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const color = value >= 75 ? C.green : value >= 50 ? C.yellow : C.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={5} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 4px ${color})` }} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.2} fontWeight={800} fill={color}>{value}</text>
      </svg>
      <span style={{ fontSize: 10, color: C.textMuted, textAlign: "center", maxWidth: size + 8, lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

function RiskBadge({ value }) {
  const low = value <= 25, med = value <= 50;
  const color = low ? C.green : med ? C.yellow : C.red;
  const label = low ? "LOW RISK" : med ? "MED RISK" : "HIGH RISK";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: `1px solid ${color}22`, background: `${color}11` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.05em" }}>{label} AI DET</span>
    </div>
  );
}

function Pill({ children, color = C.accent, active = false, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      cursor: "pointer", border: `1px solid ${active ? color : C.border}`,
      background: active ? `${color}18` : "transparent",
      color: active ? color : C.textMuted,
    }}>{children}</button>
  );
}

function BarScore({ label, value, max = 100, color = C.accent }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "12px 14px", fontSize: 14, color: C.textPrimary,
        lineHeight: 1.6, resize: "vertical", outline: "none", transition: "border-color 0.2s",
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%", background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "10px 14px", fontSize: 14, color: C.textPrimary,
        outline: "none", transition: "border-color 0.2s",
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>{children}</div>;
}

function Btn({ children, onClick, variant = "primary", small = false, disabled = false }) {
  const style = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.textSecondary, border: `1px solid ${C.border}` },
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "8px 16px" : "10px 20px", borderRadius: 8, fontSize: small ? 12 : 13,
        fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", ...style,
        opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.accent,
        borderRadius: "50%", animation: "spin 1s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TimelineScene({ scene, index, format }) {
  return (
    <div style={{ 
      background: C.surface, 
      border: `1px solid ${C.border}`, 
      borderRadius: 10, 
      padding: 12, 
      marginBottom: 8,
      display: "grid",
      gridTemplateColumns: "80px 1fr",
      gap: 12,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>{index + 1}</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{scene.timecode}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{scene.duration_seconds}s</div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>{scene.title}</div>
        <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>{scene.visual_description}</div>
        <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", marginBottom: 4 }}>"{scene.narration}"</div>
        {scene.overlay_text && (
          <div style={{ fontSize: 10, color: C.gold, background: `${C.gold}15`, padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
            Overlay: {scene.overlay_text}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          {scene.image_keywords?.map((kw, i) => (
            <span key={i} style={{ fontSize: 10, color: C.blue, background: `${C.blue}15`, padding: "2px 6px", borderRadius: 99 }}>{kw}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function CampaignsCreatorV2() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STEP 1 INPUTS
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("9:16");
  const [funnelStage, setFunnelStage] = useState("TOFU");
  const [goal, setGoal] = useState("viral");
  const [voice, setVoice] = useState("conversational");
  const [company, setCompany] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiObservation, setAiObservation] = useState("");

  // Geographic inputs
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");

  // Manual mode
  const [manualContent, setManualContent] = useState("");

  // STEP 2 DATA
  const [nicheData, setNicheData] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // STEP 3 DATA
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");

  // ── STEP 1: Generate Campaign Topics ──
  async function generateTopics() {
    if (!niche.trim()) { setError("Ingresa tu nicho primero."); return; }
    if (!city.trim() || !state.trim() || !country.trim()) { 
      setError("Ingresa ciudad, estado y país para análisis geográfico."); return; 
    }
    if (!aiObservation.trim()) {
      setError("Ingresa una observación AI (frase fija para el guion).");
      return;
    }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/generate-topics', {
        niche,
        audience: audience || undefined,
        format,
        funnelStage,
        goal: goal || undefined,
        voice: voice || undefined,
        company: company || undefined,
        provider: aiProvider,
        aiObservation,
        location: {
          city,
          state,
          country,
          address: address || undefined,
        },
      });
      setNicheData(data);
      setStep(2);
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  // ── STEP 2: Generate Full Campaign ──
  async function generateCampaign() {
    if (!selectedTopic) { setError("Selecciona un topic."); return; }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/generate-campaign', {
        selectedTopic,
        audience: audience || undefined,
        goal: goal || undefined,
        voice: voice || undefined,
        company: company || undefined,
        niche,
        provider: aiProvider,
        aiObservation,
        format,
        funnelStage,
        location: {
          city,
          state,
          country,
          address: address || undefined,
        },
      });
      setResult(data);
      setStep(3);
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  // ── Manual Analysis ──
  async function analyzeManual() {
    if (!manualContent.trim()) { setError("Pega contenido para analizar."); return; }
    setError(""); setLoading(true);
    try {
      // Mock analysis for manual mode
      const mockResult = {
        video_content: {
          headline: "Manual Video Analysis",
          narration: manualContent,
          word_count: manualContent.split(" ").length,
          estimated_duration_seconds: Math.round(manualContent.split(" ").length / 2.5),
          overlay_texts: [],
          call_to_action: "Your CTA",
          hashtags: ["#manual", "#video"],
        },
        formats: {
          vertical_916: { adapted_narration: manualContent, character_count: manualContent.length, estimated_duration_seconds: Math.round(manualContent.split(" ").length / 2.5) },
          horizontal_169: { adapted_narration: manualContent, character_count: manualContent.length, estimated_duration_seconds: Math.round(manualContent.split(" ").length / 2.5) },
        },
        scenes: [],
        production_notes: {},
        scores: {
          local_market_fit: { value: 75, factors: ["Geographic relevance"], explanation: "Good local market fit" },
          virality_probability: { value: 60, factors: ["Moderate hook"], explanation: "Could be more viral" },
          roi_potential: { value: 65, factors: ["Decent ROI"], explanation: "Average ROI potential" },
          audience_alignment: { value: 55, factors: ["Weak alignment"], explanation: "Improve audience alignment" },
          trend_relevance: { value: 50, factors: ["Generic trend"], explanation: "Not trend-aligned" },
        },
        ai_detection_risk: { value: 30, label: "medium-low", explanation: "Low AI detection risk" },
      };
      setResult(mockResult);
      setStep(3);
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  async function downloadZip() {
    try {
      const res = await fetch('/api/campaigns/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setError('Error al descargar ZIP: ' + e.message);
    }
  }

  const scores = result?.scores;
  const lmScore = scores?.local_market_fit?.value ?? 0;
  const safeStatus = lmScore >= 75 ? { label: "LOCAL FIT", color: C.green } : lmScore >= 50 ? { label: "REVISAR", color: C.yellow } : { label: "LOW FIT", color: C.red };

  // ── RENDER ──
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPrimary, fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif", padding: "0 0 60px" }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Video Campaigns Creator</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>AI-powered video campaign generator (15-25s)</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* AI PROVIDER SELECTOR */}
            {useAI && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>AI:</span>
                {AI_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setAiProvider(p.id)} style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", border: `1px solid ${aiProvider === p.id ? p.color : C.border}`,
                    background: aiProvider === p.id ? `${p.color}18` : "transparent",
                    color: aiProvider === p.id ? p.color : C.textMuted, display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            )}
            {/* TOGGLE */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Manual</span>
              <div onClick={() => { setUseAI(!useAI); setStep(1); setResult(null); setNicheData(null); }} style={{
                width: 40, height: 22, borderRadius: 99, cursor: "pointer", position: "relative",
                background: useAI ? C.accent : C.border, transition: "background 0.2s",
              }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: useAI ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
              </div>
              <span style={{ fontSize: 11, color: useAI ? C.accent : C.textMuted }}>AI</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>

        {/* ══════════ STEP 1: INPUTS ══════════ */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20 }}>
              {useAI ? "Paso 1: Define tu nicho y ubicación" : "Análisis Manual"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Nicho / Industria *</Label>
                <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ej: Marketing B2B, Fitness, Tech startups..." />
              </div>

              {/* Geographic Inputs */}
              <div>
                <Label>Ciudad *</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Miami, New York, Madrid..." />
              </div>

              <div>
                <Label>Estado/Provincia *</Label>
                <Input value={state} onChange={e => setState(e.target.value)} placeholder="Ej: Florida, NY, Comunidad de Madrid..." />
              </div>

              <div>
                <Label>País *</Label>
                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Ej: USA, Spain, Mexico..." />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Dirección/Localidad (opcional)</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Downtown, zona norte, barrio específico..." />
              </div>

              {/* AI Observation */}
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>AI Observación (frase fija para el guion) *</Label>
                <Textarea 
                  value={aiObservation} 
                  onChange={e => setAiObservation(e.target.value)} 
                  placeholder="Ej: 'Protege tu hogar hoy mismo' o 'Maximizamos tu compensación' - Esta frase se incluirá en el guion" 
                  rows={2} 
                />
              </div>

              <div>
                <Label>Audiencia objetivo</Label>
                <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Ej: CEOs, Millenials, Developers..." />
              </div>

              <div>
                <Label>Formato de video</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FORMATS.map(f => (
                    <Pill key={f.id} color={C.accent} active={format === f.id} onClick={() => setFormat(f.id)}>{f.icon} {f.label}</Pill>
                  ))}
                </div>
              </div>

              <div>
                <Label>Etapa del Funnel</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FUNNEL_STAGES.map(s => (
                    <Pill key={s.id} color={s.color} active={funnelStage === s.id} onClick={() => setFunnelStage(s.id)}>{s.icon} {s.label}</Pill>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{FUNNEL_STAGES.find(s => s.id === funnelStage)?.description}</div>
              </div>

              <div>
                <Label>Objetivo</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {GOALS.map(g => (
                    <Pill key={g} color={C.accent} active={goal === g} onClick={() => setGoal(g)}>{g}</Pill>
                  ))}
                </div>
              </div>

              <div>
                <Label>Tono de voz</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {VOICES.map(v => (
                    <Pill key={v} color={C.purple} active={voice === v} onClick={() => setVoice(v)}>{v}</Pill>
                  ))}
                </div>
              </div>

              <div>
                <Label>Empresa / Marca</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Tu empresa o marca" />
              </div>

              {!useAI && (
                <div style={{ gridColumn: "1 / -1", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                  <Label>Guion de video *</Label>
                  <Textarea value={manualContent} onChange={e => setManualContent(e.target.value)} placeholder="Pega aquí tu guion de video para analizar scores..." rows={6} />
                </div>
              )}

              {error && <div style={{ gridColumn: "1 / -1", background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>⚠️ {error}</div>}

              <div style={{ gridColumn: "1 / -1" }}>
                {loading ? <Spinner /> : (
                  <Btn onClick={useAI ? generateTopics : analyzeManual} disabled={loading}>
                    {useAI ? "✦ Generar 10 Topics de Video →" : "📊 Analizar Scores →"}
                  </Btn>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 2: TOPICS ══════════ */}
        {step === 2 && useAI && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
                  Elige un topic <span style={{ color: C.accent }}>({nicheData?.campaign_topics?.length || 0})</span>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted }}>
                  Nicho: <span style={{ color: C.textSecondary }}>{niche}</span> · 
                  Ubicación: <span style={{ color: C.textSecondary }}>{city}, {state}, {country}</span> · 
                  Formato: <span style={{ color: C.textSecondary }}>{format}</span> · 
                  Audiencia: <span style={{ color: C.textSecondary }}>{nicheData?.local_market_analysis?.target_audience?.slice(0, 60)}</span>
                </div>
              </div>
              <Btn variant="ghost" small onClick={() => setStep(1)}>← Volver</Btn>
            </div>

            {/* Local Market Analysis Pills */}
            {nicheData?.local_market_analysis?.local_trends?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>🏙️ Tendencias locales:</span>
                {nicheData.local_market_analysis.local_trends.map((t, i) => (
                  <Pill key={i} color={C.gold} active>{t}</Pill>
                ))}
              </div>
            )}

            {/* Topic Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {(nicheData?.campaign_topics || []).map(topic => (
                <div key={topic.id} onClick={() => setSelectedTopic(topic)} style={{
                  background: C.card, border: `1px solid ${selectedTopic?.id === topic.id ? C.accent : C.border}`,
                  borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s",
                  boxShadow: selectedTopic?.id === topic.id ? `0 0 12px ${C.accentGlow}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>#{topic.id}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: `${C.accent}15`, color: C.accent, fontWeight: 700 }}>{topic.estimated_virality}% viral</span>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: `${C.green}15`, color: C.green, fontWeight: 700 }}>{topic.local_market_fit}% local</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>{topic.title}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>{topic.angle}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", marginBottom: 8 }}>"{topic.hook}"</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{topic.geographic_relevance}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Pill color={C.blue} active small>{topic.format}</Pill>
                    <Pill color={C.purple} active small>{topic.content_type}</Pill>
                    <Pill color={C.green} active small>{topic.suggested_format}</Pill>
                  </div>
                </div>
              ))}
            </div>

            {selectedTopic && (
              <div style={{ marginTop: 20, padding: 16, background: `${C.accent}08`, border: `1px solid ${C.accent}33`, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Topic seleccionado: {selectedTopic.title}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 12 }}>{selectedTopic.why_it_works}</div>
                {loading ? <Spinner /> : (
                  <Btn onClick={generateCampaign}>✦ Generar Video Completo →</Btn>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════ STEP 3: RESULT ══════════ */}
        {step === 3 && result && (
          <div>
            {/* TOP BAR */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Video generado</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{selectedTopic?.title || "Análisis manual"}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{city}, {state}, {country} · {format}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ padding: "5px 12px", borderRadius: 99, background: `${safeStatus.color}15`, border: `1px solid ${safeStatus.color}44`, fontSize: 11, fontWeight: 800, color: safeStatus.color, letterSpacing: "0.05em" }}>
                  ● {safeStatus.label}
                </div>
                <Btn small onClick={downloadZip}>📦 Descargar ZIP</Btn>
                <Btn variant="ghost" small onClick={() => { setStep(useAI ? 2 : 1); setResult(null); }}>← Volver</Btn>
              </div>
            </div>

            {/* SCORE RINGS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <ScoreRing value={scores?.local_market_fit?.value ?? 0} label="Local Fit" />
                <ScoreRing value={scores?.virality_probability?.value ?? 0} label="Virality" />
                <ScoreRing value={scores?.roi_potential?.value ?? 0} label="ROI" />
                <ScoreRing value={scores?.audience_alignment?.value ?? 0} label="Audience" />
                <ScoreRing value={scores?.trend_relevance?.value ?? 0} label="Trend" />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <RiskBadge value={scores?.ai_detection_risk?.value ?? 0} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>AI Detection Risk</span>
                </div>
              </div>
            </div>

            {/* MAIN GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

              {/* LEFT: Video Content */}
              <div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {/* Format tabs */}
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, paddingLeft: 4 }}>
                    <button onClick={() => {}} style={{
                      padding: "8px 14px", borderBottom: `2px solid ${C.accent}`,
                      background: `${C.accent}08`, color: C.accent,
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>
                      📱 Video Script
                    </button>
                  </div>

                  <div style={{ padding: 20 }}>
                    <div style={{ marginBottom: 12 }}>
                      <Label>Headline</Label>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{result.video_content?.headline}</div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <Label>Narration ({result.video_content?.word_count} words · {result.video_content?.estimated_duration_seconds}s)</Label>
                      <Textarea 
                        value={result.video_content?.narration || ""} 
                        onChange={() => {}} 
                        rows={4} 
                        readOnly
                        style={{ background: C.surface, color: C.textPrimary, marginBottom: 8 }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: result.video_content?.estimated_duration_seconds >= 15 && result.video_content?.estimated_duration_seconds <= 25 ? C.green : C.red }}>
                          {result.video_content?.estimated_duration_seconds >= 15 && result.video_content?.estimated_duration_seconds <= 25 ? "✓ Duración óptima (15-25s)" : "⚠️ Ajustar duración"}
                        </span>
                        <Btn small variant="ghost" onClick={() => copy(result.video_content?.narration || "", "narration")}>
                          {copied === "narration" ? "✓ Copiado" : "📋 Copiar"}
                        </Btn>
                      </div>
                    </div>

                    {result.video_content?.overlay_texts?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Label>Overlay Texts</Label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {result.video_content.overlay_texts.map((text, i) => (
                            <span key={i} style={{ fontSize: 11, color: C.gold, background: `${C.gold}15`, padding: "2px 8px", borderRadius: 99 }}>{text}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 12 }}>
                      <Label>Call to Action</Label>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{result.video_content?.call_to_action}</div>
                    </div>

                    {result.video_content?.hashtags?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Label>Hashtags</Label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {result.video_content.hashtags.map((tag, i) => (
                            <span key={i} style={{ fontSize: 11, color: C.accent, background: `${C.accent}15`, padding: "2px 8px", borderRadius: 99 }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.ai_observation_included && (
                      <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4 }}>✓ AI Observación incluida</div>
                        <div style={{ fontSize: 11, color: C.textSecondary }}>{result.ai_observation_location}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIMELINE */}
                {result.scenes?.length > 0 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>🎬 Timeline de Escenas</div>
                    {result.scenes.map((scene, index) => (
                      <TimelineScene key={scene.id} scene={scene} index={index} format={format} />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT: Details */}
              <div>
                {/* Format Variations */}
                {result.formats && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>📐 Variaciones por Formato</div>
                    {result.formats.vertical_916 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>9:16 Vertical</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>{result.formats.vertical_916.estimated_duration_seconds}s · {result.formats.vertical_916.character_count} chars</div>
                      </div>
                    )}
                    {result.formats.horizontal_169 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>16:9 Horizontal</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>{result.formats.horizontal_169.estimated_duration_seconds}s · {result.formats.horizontal_169.character_count} chars</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Local Market Analysis */}
                {result.local_market_analysis && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>🏙️ Análisis de Mercado Local</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Tamaño:</span> {result.local_market_analysis.market_size}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Competencia:</span> {result.local_market_analysis.competition_level}
                    </div>
                    {result.local_market_analysis.local_trends?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <Label>Tendencias locales</Label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {result.local_market_analysis.local_trends.map((t, i) => (
                            <span key={i} style={{ fontSize: 10, color: C.gold, background: `${C.gold}15`, padding: "2px 8px", borderRadius: 99 }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Score Details */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>📊 Detalle de Scores</div>
                  {scores && Object.entries(scores).map(([key, score]) => (
                    <BarScore 
                      key={key} 
                      label={key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} 
                      value={score.value} 
                      color={score.value >= 75 ? C.green : score.value >= 50 ? C.yellow : C.red}
                    />
                  ))}
                </div>

                {/* Production Notes */}
                {result.production_notes && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>🎥 Notas de Producción</div>
                    {result.production_notes.specs_916 && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>9:16:</span> {result.production_notes.specs_916}
                      </div>
                    )}
                    {result.production_notes.specs_169 && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>16:9:</span> {result.production_notes.specs_169}
                      </div>
                    )}
                    {result.production_notes.music_tone && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>Música:</span> {result.production_notes.music_tone}
                      </div>
                    )}
                    {result.production_notes.transition_style && (
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        <span style={{ fontWeight: 600 }}>Transición:</span> {result.production_notes.transition_style}
                      </div>
                    )}
                  </div>
                )}

                {/* Optimization Suggestions */}
                {result.optimization_suggestions?.length > 0 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 12 }}>💡 Sugerencias</div>
                    {result.optimization_suggestions.map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, lineHeight: 1.4 }}>• {s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
