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

const PLATFORMS = [
  { id: "linkedin",  label: "LinkedIn",   icon: "💼", color: "#0a66c2", dims: "1200×627" },
  { id: "twitter",   label: "Twitter/X",  icon: "𝕏",  color: "#e7e9ea", dims: "1200×675" },
  { id: "instagram", label: "Instagram",  icon: "📸", color: "#E1306C", dims: "1080×1080" },
  { id: "facebook",  label: "Facebook",   icon: "👥", color: "#1877f2", dims: "1200×630" },
  { id: "tiktok",    label: "TikTok",     icon: "🎵", color: "#000000", dims: "1080×1920" },
];

const GOALS = ["awareness", "engagement", "viral", "leads", "sales", "community"];
const VOICES = ["professional", "conversational", "trendy", "inspirational", "humorous"];

const AI_PROVIDERS = [
  { id: "gemini", label: "Gemini", icon: "✨", color: "#4285F4" },
  { id: "anthropic", label: "Claude", icon: "🤖", color: "#D97757" },
  { id: "openai", label: "OpenAI", icon: "🧠", color: "#10B981" },
];

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const STEP1_SYSTEM = `You are a Senior Social Media Content Strategist with 10+ years of experience in viral content creation, audience engagement, and trend analysis across LinkedIn, Twitter/X, Instagram, Facebook, and TikTok. You specialize in identifying high-potential viral topics based on niche analysis, audience behavior, and current social media trends.

INSTRUCTIONS:
1. Analyze the provided niche to understand the target audience, their pain points, and content preferences.
2. Generate 10 viral content topics that balance engagement potential, virality, and audience value.
3. Each topic should include a clear angle, potential hook, and estimated performance metrics.
4. Prioritize topics that demonstrate high viral potential and engagement.

CONSTRAINTS:
- Generate exactly 10 distinct viral topics
- Each topic must be unique and immediately actionable
- Focus on topics with high viral and engagement potential
- Avoid generic or over-saturated topics
- Consider platform-specific strengths: LinkedIn for professional authority, Twitter/X for threads and hooks, Instagram for visual storytelling, Facebook for community engagement, TikTok for short-form video

Return ONLY a valid JSON object, no markdown, no preamble:
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
}`;

const STEP2_SYSTEM = `You are a Senior Social Media Content Strategist specializing in viral content, engagement optimization, and AI-human hybrid content that performs well in 2026. You write in a way that scores HIGH on human-likeness to avoid AI detection.

CRITICAL RULES:
1. Write with natural language, varied sentence structure, personal anecdotes, emotional resonance
2. Include first-hand experience or realistic case study details
3. NEVER use generic AI phrases: "In conclusion", "It's important to note", "In today's world"
4. Include data-backed claims with specific numbers
5. Generate detailed image prompts for Gemini Imagen for each platform
6. Ensure human_writing_index > 75 and ai_detection_risk < 25
7. Optimize for platform-specific formats: LinkedIn (professional), Twitter/X (threads/hooks), Instagram (visual), Facebook (community), TikTok (short-form video)

Return ONLY a valid JSON object, no markdown, no preamble:
{
  "content": {
    "headline": "string",
    "body": "string",
    "call_to_action": "string",
    "hashtags": ["string"]
  },
  "platform_variations": {
    "linkedin": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for LinkedIn 1200x627px" },
    "twitter": { "adapted_content": "string", "character_count": 0, "is_thread": false, "thread_tweets": [], "image_prompt": "Detailed Gemini Imagen prompt for Twitter/X 1200x675px" },
    "instagram": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for Instagram 1080x1080px" },
    "facebook": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for Facebook 1200x630px" },
    "tiktok": { "adapted_content": "string", "video_script": "string", "image_prompt": "Detailed Gemini Imagen prompt for TikTok thumbnail 1080x1920px" }
  },
  "cover_image": {
    "main_prompt": "Detailed Gemini Imagen prompt, versatile across platforms",
    "style": "photorealistic|illustration|minimalist|bold|professional",
    "color_palette": ["#hex1", "#hex2"],
    "mood": "professional|energetic|calm|inspiring|bold",
    "key_elements": ["string"]
  },
  "scores": {
    "human_writing_index": { "value": 0, "factors": ["string"], "explanation": "string" },
    "virality_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "engagement_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "roi_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "trend_alignment": { "value": 0, "factors": ["string"], "explanation": "string" }
  },
  "eeat_analysis": {
    "experience_signals": ["string"],
    "expertise_signals": ["string"],
    "authoritativeness_signals": ["string"],
    "trustworthiness_signals": ["string"]
  },
  "optimization_suggestions": ["string"],
  "research_sources": [{ "source": "string", "relevance": "high|medium|low", "key_insight": "string" }],
  "ai_detection_risk": { "value": 0, "label": "low|medium-low|medium-high|high", "explanation": "string" }
}`;

// ─── API CALLS ───────────────────────────────────────────────────────────────
async function callBackend(endpoint, body) {
  const res = await fetch(`/api/social-media${endpoint}`, {
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

function PlatformTab({ p, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderBottom: active ? `2px solid ${p.color}` : "2px solid transparent",
      background: active ? `${p.color}08` : "transparent", color: active ? p.color : C.textMuted,
      fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
    }}>
      <span>{p.icon}</span> {p.label}
    </button>
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

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function SocialMediaCreator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STEP 1 INPUTS
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState(["multi"]);
  const [goal, setGoal] = useState("viral");
  const [voice, setVoice] = useState("conversational");
  const [company, setCompany] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [aiProvider, setAiProvider] = useState("gemini");

  // Manual mode
  const [manualContent, setManualContent] = useState("");

  // STEP 2 DATA
  const [nicheData, setNicheData] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // STEP 3 DATA
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("linkedin");
  const [scoreTab, setScoreTab] = useState("scores");
  const [copied, setCopied] = useState("");

  // ── STEP 1: Generate Viral Topics ──
  async function generateTopics() {
    if (!niche.trim()) { setError("Ingresa tu nicho primero."); return; }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/generate-topics', {
        niche,
        audience: audience || undefined,
        platforms,
        goal: goal || undefined,
        voice: voice || undefined,
        company: company || undefined,
        provider: aiProvider,
      });
      setNicheData(data);
      setStep(2);
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  // ── STEP 2: Generate Full Content ──
  async function generateContent() {
    if (!selectedTopic) { setError("Selecciona un topic."); return; }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/generate-content', {
        selectedTopic,
        audience: audience || undefined,
        goal: goal || undefined,
        voice: voice || undefined,
        company: company || undefined,
        niche,
        provider: aiProvider,
      });
      setResult(data);
      setStep(3);
      setActiveTab("linkedin");
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
        content: {
          headline: "Manual Content Analysis",
          body: manualContent,
          call_to_action: "Your CTA",
          hashtags: ["#manual", "#analysis"],
        },
        platform_variations: {
          linkedin: { adapted_content: manualContent, character_count: manualContent.length, image_prompt: "Manual analysis prompt" },
          twitter: { adapted_content: manualContent.slice(0, 280), character_count: Math.min(280, manualContent.length), image_prompt: "Manual analysis prompt" },
        },
        scores: {
          human_writing_index: { value: 75, factors: ["Natural language"], explanation: "Good human likeness" },
          virality_score: { value: 60, factors: ["Moderate hook"], explanation: "Could be more viral" },
          engagement_score: { value: 65, factors: ["Decent engagement"], explanation: "Average engagement" },
          roi_score: { value: 55, factors: ["Weak CTA"], explanation: "Improve CTA" },
          trend_alignment: { value: 50, factors: ["Generic trend"], explanation: "Not trend-aligned" },
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
      const res = await fetch('/api/social-media/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-media-content-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setError('Error al descargar ZIP: ' + e.message);
    }
  }

  const scores = result?.scores;
  const hlScore = scores?.human_writing_index?.value ?? 0;
  const safeStatus = hlScore >= 75 ? { label: "HUMAN SAFE", color: C.green } : hlScore >= 50 ? { label: "REVISAR", color: C.yellow } : { label: "AI DETECTED", color: C.red };

  // ── RENDER ──
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPrimary, fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif", padding: "0 0 60px" }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Social Media Creator</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>AI-powered viral content generator</div>
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
              {useAI ? "Paso 1: Define tu nicho" : "Análisis Manual"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Nicho / Industria *</Label>
                <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ej: Marketing B2B, Fitness, Tech startups..." />
              </div>

              <div>
                <Label>Audiencia objetivo</Label>
                <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Ej: CEOs, Millenials, Developers..." />
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

              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Plataformas</Label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setPlatforms(["multi"])} style={{
                    padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: `1.5px solid ${platforms.includes("multi") ? C.accent : C.border}`,
                    background: platforms.includes("multi") ? `${C.accent}15` : "transparent",
                    color: platforms.includes("multi") ? C.accent : C.textMuted,
                  }}>🌐 Todas</button>
                  {PLATFORMS.map(p => {
                    const active = platforms.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => {
                        setPlatforms(prev => {
                          const without = prev.filter(x => x !== "multi");
                          return active ? without.filter(x => x !== p.id) || ["multi"] : [...without, p.id];
                        });
                      }} style={{
                        padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", border: `1.5px solid ${active ? p.color : C.border}`,
                        background: active ? `${p.color}15` : "transparent",
                        color: active ? p.color : C.textMuted, display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <span>{p.icon}</span> {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!useAI && (
                <div style={{ gridColumn: "1 / -1", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                  <Label>Contenido del post *</Label>
                  <Textarea value={manualContent} onChange={e => setManualContent(e.target.value)} placeholder="Pega aquí tu post para analizar scores y obtener adaptaciones por plataforma..." rows={6} />
                </div>
              )}

              {error && <div style={{ gridColumn: "1 / -1", background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>⚠️ {error}</div>}

              <div style={{ gridColumn: "1 / -1" }}>
                {loading ? <Spinner /> : (
                  <Btn onClick={useAI ? generateTopics : analyzeManual} disabled={loading}>
                    {useAI ? "✦ Generar 10 Topics Virales →" : "📊 Analizar Scores →"}
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
                  Elige un topic <span style={{ color: C.accent }}>({nicheData?.viral_topics?.length || 0})</span>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Nicho: <span style={{ color: C.textSecondary }}>{niche}</span> · Audiencia: <span style={{ color: C.textSecondary }}>{nicheData?.niche_analysis?.target_audience?.slice(0, 60)}</span></div>
              </div>
              <Btn variant="ghost" small onClick={() => setStep(1)}>← Volver</Btn>
            </div>

            {/* Niche Analysis Pills */}
            {nicheData?.niche_analysis?.trending_topics?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>🔥 Tendencias:</span>
                {nicheData.niche_analysis.trending_topics.map((t, i) => (
                  <Pill key={i} color={C.gold} active>{t}</Pill>
                ))}
              </div>
            )}

            {/* Topic Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {(nicheData?.viral_topics || []).map(topic => (
                <div key={topic.id} onClick={() => setSelectedTopic(topic)} style={{
                  background: C.card, border: `1px solid ${selectedTopic?.id === topic.id ? C.accent : C.border}`,
                  borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s",
                  boxShadow: selectedTopic?.id === topic.id ? `0 0 12px ${C.accentGlow}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>#{topic.id}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: `${C.accent}15`, color: C.accent, fontWeight: 700 }}>{topic.estimated_virality}% viral</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>{topic.title}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>{topic.angle}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", marginBottom: 8 }}>"{topic.hook}"</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Pill color={C.blue} active small>{topic.platform}</Pill>
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
                  <Btn onClick={generateContent}>✦ Generar Contenido Completo →</Btn>
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
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Contenido generado</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{selectedTopic?.title || "Análisis manual"}</div>
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
                <ScoreRing value={scores?.virality_score?.value ?? 0} label="Virality" />
                <ScoreRing value={scores?.engagement_score?.value ?? 0} label="Engagement" />
                <ScoreRing value={scores?.human_writing_index?.value ?? 0} label="Human Writing" />
                <ScoreRing value={scores?.roi_score?.value ?? 0} label="ROI" />
                <ScoreRing value={scores?.trend_alignment?.value ?? 0} label="Trend" />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <RiskBadge value={scores?.ai_detection_risk?.value ?? 0} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>AI Detection Risk</span>
                </div>
              </div>
            </div>

            {/* MAIN GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

              {/* LEFT: Platform Variations */}
              <div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {/* Platform tabs */}
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto", paddingLeft: 4 }}>
                    {PLATFORMS.map(p => (
                      <PlatformTab key={p.id} p={p} active={activeTab === p.id} onClick={() => setActiveTab(p.id)} />
                    ))}
                  </div>

                  {PLATFORMS.map(p => {
                    const v = result.platform_variations?.[p.id];
                    if (!v || activeTab !== p.id) return null;
                    const content = v.adapted_content;
                    const count = v.character_count || v.word_count;
                    const unit = v.word_count ? "palabras" : "chars";
                    return (
                      <div key={p.id} style={{ padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{p.icon}</span>
                            <span style={{ fontWeight: 700, color: p.color }}>{p.label}</span>
                            <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "2px 8px", borderRadius: 99 }}>{p.dims}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {count && <span style={{ fontSize: 11, color: C.textMuted }}>{count} {unit}</span>}
                            <Btn small variant="ghost" onClick={() => copy(content, p.id)}>
                              {copied === p.id ? "✅ Copiado" : "📋 Copiar"}
                            </Btn>
                          </div>
                        </div>
                        <div style={{ background: C.surface, borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.75, color: C.textSecondary, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto", border: `1px solid ${C.border}` }}>
                          {content}
                        </div>

                        {/* Image Prompt */}
                        {v.image_prompt && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 14 }}>🎨</span> Gemini Imagen Prompt — {p.label}
                            </div>
                            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.textMuted, lineHeight: 1.6, fontFamily: "monospace" }}>
                              {v.image_prompt}
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <Btn small variant="ghost" onClick={() => copy(v.image_prompt, `img_${p.id}`)}>
                                {copied === `img_${p.id}` ? "✅ Copiado" : "📋 Copiar prompt imagen"}
                              </Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Scores & Analysis */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Score tabs */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
                    {["scores", "eeat", "tips"].map(t => (
                      <button key={t} onClick={() => setScoreTab(t)} style={{
                        flex: 1, padding: "10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: scoreTab === t ? C.surface : "transparent", borderBottom: scoreTab === t ? `2px solid ${C.accent}` : "2px solid transparent",
                        color: scoreTab === t ? C.textPrimary : C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{t}</button>
                    ))}
                  </div>

                  {scoreTab === "scores" && scores && (
                    <div style={{ padding: 16 }}>
                      {[
                        { key: "human_writing_index", label: "Human Writing Index", color: C.green },
                        { key: "virality_score", label: "Virality Score", color: C.gold },
                        { key: "engagement_score", label: "Engagement Score", color: C.blue },
                        { key: "roi_score", label: "ROI Score", color: C.purple },
                        { key: "trend_alignment", label: "Trend Alignment", color: C.accent },
                      ].map(({ key, label, color }) => (
                        <BarScore key={key} label={label} value={scores[key]?.value ?? 0} color={color} />
                      ))}
                    </div>
                  )}

                  {scoreTab === "eeat" && result.eeat_analysis && (
                    <div style={{ fontSize: 12, padding: 16 }}>
                      {[
                        { key: "experience_signals", label: "Experience", icon: "🧠", color: C.blue },
                        { key: "expertise_signals", label: "Expertise", icon: "🎓", color: C.purple },
                        { key: "authoritativeness_signals", label: "Authority", icon: "⭐", color: C.gold },
                        { key: "trustworthiness_signals", label: "Trust", icon: "🛡️", color: C.green },
                      ].map(({ key, label, icon, color }) => (
                        <div key={key} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{icon} {label}</div>
                          {(result.eeat_analysis[key] || []).map((s, i) => (
                            <div key={i} style={{ padding: "4px 8px", background: `${color}0d`, border: `1px solid ${color}22`, borderRadius: 6, marginBottom: 4, color: C.textMuted, lineHeight: 1.4 }}>• {s}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {scoreTab === "tips" && (
                    <div style={{ padding: 16 }}>
                      {(result.optimization_suggestions || []).map((s, i) => (
                        <div key={i} style={{ padding: "8px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
                          <span style={{ color: C.accent, fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>{s}
                        </div>
                      ))}
                      {(result.research_sources || []).length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>🔬 Research Sources</div>
                          {result.research_sources.map((src, i) => (
                            <div key={i} style={{ padding: "6px 10px", background: C.surface, borderRadius: 6, marginBottom: 6, fontSize: 11, color: C.textMuted }}>
                              <span style={{ color: src.relevance === "high" ? C.green : src.relevance === "medium" ? C.yellow : C.textMuted, fontWeight: 700 }}>{src.relevance?.toUpperCase()} </span>
                              {src.key_insight}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Main Image Prompt */}
                {result.cover_image?.main_prompt && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>🎨 Main Cover Prompt</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {result.cover_image.color_palette?.map(c => (
                        <div key={c} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: `1px solid ${C.border}`, title: c }} />
                      ))}
                      {result.cover_image.style && <Pill color={C.accent} active>{result.cover_image.style}</Pill>}
                      {result.cover_image.mood && <Pill color={C.purple} active>{result.cover_image.mood}</Pill>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", lineHeight: 1.6, background: C.surface, borderRadius: 8, padding: 10 }}>
                      {result.cover_image.main_prompt?.slice(0, 180)}...
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Btn small variant="ghost" onClick={() => copy(result.cover_image.main_prompt, "main_img")}>
                        {copied === "main_img" ? "✅ Copiado" : "📋 Copiar prompt"}
                      </Btn>
                    </div>
                  </div>
                )}

                {/* Status + New Content */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Estado del Contenido</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["draft", "ready", "published"].map(s => (
                      <button key={s} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${s === "draft" ? C.yellow : s === "ready" ? C.green : C.accent}44`, background: s === "draft" ? `${C.yellow}11` : s === "ready" ? `${C.green}11` : `${C.accent}11`, color: s === "draft" ? C.yellow : s === "ready" ? C.green : C.accent }}>
                        {s === "draft" ? "📝 Draft" : s === "ready" ? "✅ Ready" : "🚀 Publicado"}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Btn onClick={() => { setStep(useAI ? 2 : 1); setResult(null); setSelectedTopic(null); }}>
                      ✦ Nuevo Contenido
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
