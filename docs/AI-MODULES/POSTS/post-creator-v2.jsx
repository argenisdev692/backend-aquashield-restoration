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
  { id: "blog",      label: "Blog",       icon: "✍️", color: "#10b981", dims: "1200×628" },
  { id: "linkedin",  label: "LinkedIn",   icon: "💼", color: "#0a66c2", dims: "1200×627" },
  { id: "twitter",   label: "Twitter/X",  icon: "𝕏",  color: "#e7e9ea", dims: "1200×675" },
  { id: "newsletter",label: "Newsletter", icon: "📬", color: "#f59e0b", dims: "600×400"  },
  { id: "facebook",  label: "Facebook",   icon: "👥", color: "#1877f2", dims: "1200×630" },
];

const GOALS = ["awareness", "leads", "thought_leadership", "engagement", "sales"];
const VOICES = ["professional", "conversational", "technical", "inspirational", "urgent"];

const AI_PROVIDERS = [
  { id: "gemini", label: "Gemini", icon: "✨", color: "#4285F4" },
  { id: "anthropic", label: "Claude", icon: "🤖", color: "#D97757" },
  { id: "openai", label: "OpenAI", icon: "🧠", color: "#10B981" },
];

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const STEP1_SYSTEM = `You are a Senior Social Media Content Strategist with 10+ years of experience in viral content creation, SEO optimization, and audience engagement across Blog, LinkedIn, Twitter/X, Instagram, Newsletter and Facebook. You specialize in identifying high-potential content topics based on niche analysis, audience behavior, and current trends.

INSTRUCTIONS:
1. Analyze the provided niche to understand the target audience, their pain points, and content preferences.
2. Generate 10 content ideas that balance virality potential, ROI, and audience value.
3. Each idea should include a clear angle, potential hook, and estimated performance metrics.
4. Prioritize topics that demonstrate E-E-A-T principles.

CONSTRAINTS:
- Generate exactly 10 distinct content ideas
- Each idea must be unique and actionable
- Focus on topics with high viral and ROI potential
- Avoid generic or over-saturated topics

Return ONLY a valid JSON object, no markdown, no preamble:
{
  "niche_analysis": {
    "target_audience": "string",
    "audience_demographics": "string",
    "key_pain_points": ["string"],
    "content_preferences": ["string"],
    "trending_topics": ["string"]
  },
  "content_ideas": [
    {
      "id": 1,
      "title": "string",
      "angle": "string",
      "hook": "string",
      "platform": "blog|linkedin|twitter|newsletter|facebook|multi",
      "estimated_virality": 0,
      "estimated_roi": 0,
      "estimated_engagement": "high|medium|low",
      "difficulty": "easy|medium|hard",
      "eeat_potential": 0,
      "why_it_works": "string",
      "key_trend": "string",
      "suggested_format": "post|thread|carousel|video|story|article",
      "content_type": "educational|entertainment|inspirational|promotional|news"
    }
  ]
}`;

const STEP2_SYSTEM = `You are a Senior Social Media Content Strategist specializing in E-E-A-T, viral content and AI-human hybrid content that ranks well in 2026. You write in a way that scores HIGH on human-likeness to avoid AI detection.

CRITICAL RULES:
1. Write with natural language, varied sentence structure, personal anecdotes, emotional resonance
2. Include first-hand experience or realistic case study details
3. NEVER use generic AI phrases: "In conclusion", "It's important to note", "In today's world"
4. Include data-backed claims with specific numbers
5. Generate detailed image prompts for Gemini Imagen for each platform
6. Ensure human_writing_index > 75 and ai_detection_risk < 25
7. Generate SEO metadata: meta_title (50-60 chars), meta_description (150-160 chars), og_title, og_description, twitter_title, twitter_description, canonical_url, and valid Schema.org JSON-LD for BlogPosting

Return ONLY a valid JSON object, no markdown, no preamble:
{
  "post_content": {
    "headline": "string",
    "body": "string",
    "call_to_action": "string",
    "hashtags": ["string"]
  },
  "platform_variations": {
    "blog": { "adapted_content": "string", "word_count": 0, "meta_title": "string (50-60)", "meta_description": "string (150-160)", "image_prompt": "Detailed Gemini Imagen prompt for Blog cover 1200x628px" },
    "linkedin": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for LinkedIn 1200x627px" },
    "twitter": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for Twitter/X 1200x675px" },
    "newsletter": { "adapted_content": "string", "word_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for Newsletter header 600x400px" },
    "facebook": { "adapted_content": "string", "character_count": 0, "image_prompt": "Detailed Gemini Imagen prompt for Facebook 1200x630px" }
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
    "eeat_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "virality_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "roi_score": { "value": 0, "factors": ["string"], "explanation": "string" },
    "seo_score": { "value": 0, "factors": ["string"], "explanation": "string" }
  },
  "seo_metadata": {
    "meta_title": "SEO meta title (50-60 chars)",
    "meta_description": "SEO meta description (150-160 chars)",
    "og_title": "Open Graph title (max 60 chars)",
    "og_description": "Open Graph description (max 160 chars)",
    "og_image_url": "URL placeholder for Open Graph image",
    "og_type": "article",
    "twitter_card": "summary_large_image",
    "twitter_title": "Twitter card title (max 60 chars)",
    "twitter_description": "Twitter card description (max 160 chars)",
    "twitter_image_url": "URL placeholder for Twitter image",
    "canonical_url": "Canonical URL placeholder (use {{CANONICAL_URL}})",
    "schema_json_ld": {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "string",
      "description": "string",
      "image": "string",
      "author": { "@type": "Person", "name": "string" },
      "datePublished": "ISO 8601 date",
      "dateModified": "ISO 8601 date",
      "publisher": { "@type": "Organization", "name": "string" }
    }
  },
  "eeat_analysis": {
    "experience_signals": ["string"],
    "expertise_signals": ["string"],
    "authoritativeness_signals": ["string"],
    "trustworthiness_signals": ["string"]
  },
  "seo_analysis": {
    "primary_keyword": "string",
    "lsi_keywords": ["string"],
    "technical_factors": ["string"],
    "semantic_factors": ["string"],
    "machine_readability": ["string"]
  },
  "optimization_suggestions": ["string"],
  "research_sources": [{ "source": "string", "relevance": "high|medium|low", "key_insight": "string" }]
}`;

// ─── API CALLS ───────────────────────────────────────────────────────────────
async function callBackend(endpoint, body) {
  const res = await fetch(`/api/posts${endpoint}`, {
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
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.05em" }}>{label} AI DETECT {value}%</span>
    </div>
  );
}

function Pill({ children, color = C.accent, active }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: active ? `${color}22` : "transparent",
      color: active ? color : C.textMuted,
      border: `1px solid ${active ? color + "44" : C.border}`,
      letterSpacing: "0.03em",
    }}>{children}</span>
  );
}

function BarScore({ label, value, factors }) {
  const color = value >= 75 ? C.green : value >= 50 ? C.yellow : C.red;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 99, transition: "width 1s ease", boxShadow: `0 0 8px ${color}66` }} />
      </div>
      {factors && (
        <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {factors.map(f => <Pill key={f}>{f.replace(/_/g, " ")}</Pill>)}
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, selected, onClick }) {
  const vColor = idea.estimated_virality >= 75 ? C.green : idea.estimated_virality >= 50 ? C.yellow : C.red;
  const engColor = { high: C.green, medium: C.yellow, low: C.red }[idea.estimated_engagement];
  return (
    <div onClick={onClick} style={{
      background: selected ? `linear-gradient(135deg, ${C.accentGlow}, ${C.card})` : C.card,
      border: `1.5px solid ${selected ? C.accent : C.border}`,
      borderRadius: 12, padding: "14px 16px", cursor: "pointer",
      transition: "all 0.2s", position: "relative", overflow: "hidden",
      boxShadow: selected ? `0 0 20px ${C.accentGlow}` : "none",
    }}>
      {selected && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.accent}, ${C.purple})` }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, lineHeight: 1.4, flex: 1 }}>
          <span style={{ color: C.textMuted, marginRight: 6, fontFamily: "monospace", fontSize: 11 }}>#{idea.id.toString().padStart(2, "0")}</span>
          {idea.title}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: vColor, background: `${vColor}15`, padding: "2px 7px", borderRadius: 99 }}>V:{idea.estimated_virality}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", background: "#6366f115", padding: "2px 7px", borderRadius: 99 }}>ROI:{idea.estimated_roi}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 8, fontStyle: "italic" }}>"{idea.hook}"</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <Pill color={engColor} active>{idea.estimated_engagement} eng</Pill>
        <Pill color={C.purple} active={idea.difficulty === "easy"}>{idea.difficulty}</Pill>
        <Pill color={C.blue} active>{idea.content_type}</Pill>
        <Pill color={C.gold} active>{idea.suggested_format}</Pill>
      </div>
    </div>
  );
}

function PlatformTab({ p, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
      borderBottom: `2px solid ${active ? p.color : "transparent"}`,
      color: active ? p.color : C.textMuted, fontSize: 13, fontWeight: 600,
      transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 14 }}>{p.icon}</span> {p.label}
    </button>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{
      width: "100%", boxSizing: "border-box", background: C.surface,
      border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.textPrimary,
      fontSize: 14, padding: "10px 12px", fontFamily: "inherit", resize: "vertical",
      outline: "none", lineHeight: 1.6, transition: "border 0.15s",
    }} onFocus={e => e.target.style.borderColor = C.accent}
       onBlur={e => e.target.style.borderColor = C.border} />
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} style={{
      width: "100%", boxSizing: "border-box", background: C.surface,
      border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.textPrimary,
      fontSize: 14, padding: "10px 12px", fontFamily: "inherit", outline: "none",
      transition: "border 0.15s",
    }} onFocus={e => e.target.style.borderColor = C.accent}
       onBlur={e => e.target.style.borderColor = C.border} />
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function ChipGroup({ options, value, onChange, colorMap }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const active = value === o;
        const color = colorMap?.[o] || C.accent;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
            cursor: "pointer", border: `1.5px solid ${active ? color : C.border}`,
            background: active ? `${color}18` : "transparent",
            color: active ? color : C.textMuted, transition: "all 0.15s",
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", small }) {
  const styles = {
    primary: { bg: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, color: "#fff", border: "none" },
    ghost: { bg: "transparent", color: C.textSecondary, border: `1.5px solid ${C.border}` },
    danger: { bg: "transparent", color: C.red, border: `1.5px solid ${C.red}33` },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "7px 16px" : "11px 22px",
      borderRadius: 8, fontSize: small ? 12 : 14, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? C.border : s.bg, color: disabled ? C.textMuted : s.color,
      border: s.border, transition: "all 0.15s", letterSpacing: "0.02em",
      boxShadow: variant === "primary" && !disabled ? `0 0 20px ${C.accentGlow}` : "none",
    }}>{children}</button>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: C.textMuted, fontSize: 13 }}>Procesando con IA...</span>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function PostCreatorV2() {
  // STEP
  const [step, setStep] = useState(1); // 1=niche, 2=ideas, 3=result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STEP 1 INPUTS
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState(["multi"]);
  const [goal, setGoal] = useState("awareness");
  const [voice, setVoice] = useState("professional");
  const [company, setCompany] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [aiProvider, setAiProvider] = useState("gemini");

  // Manual mode
  const [manualContent, setManualContent] = useState("");

  // STEP 2 DATA
  const [nicheData, setNicheData] = useState(null);
  const [selectedIdea, setSelectedIdea] = useState(null);

  // STEP 3 DATA
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("blog");
  const [scoreTab, setScoreTab] = useState("scores");
  const [copied, setCopied] = useState("");

  // ── STEP 1: Generate Ideas ──
  async function generateIdeas() {
    if (!niche.trim()) { setError("Ingresa tu nicho primero."); return; }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/social/generate-ideas', {
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

  // ── STEP 2: Generate Full Post ──
  async function generatePost() {
    if (!selectedIdea) { setError("Selecciona una idea."); return; }
    setError(""); setLoading(true);
    try {
      const data = await callBackend('/social/generate-post', {
        selectedIdea,
        audience: audience || undefined,
        goal: goal || undefined,
        voice: voice || undefined,
        company: company || undefined,
        niche,
        provider: aiProvider,
      });
      setResult(data);
      setStep(3);
      setActiveTab("blog");
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  // ── Manual Analysis ──
  async function analyzeManual() {
    if (!manualContent.trim()) { setError("Escribe el contenido a analizar."); return; }
    setError(""); setLoading(true);
    try {
      // Manual mode not implemented in backend yet - use mock
      const data = {
        post_content: {
          headline: "Manual Analysis",
          body: manualContent,
          call_to_action: "Detected CTA or none",
          hashtags: [],
        },
        platform_variations: {
          blog: { adapted_content: manualContent, word_count: manualContent.split(" ").length, image_prompt: "Suggested prompt" },
          linkedin: { adapted_content: manualContent.slice(0, 1200), character_count: manualContent.slice(0, 1200).length, image_prompt: "Suggested prompt" },
          twitter: { adapted_content: manualContent.slice(0, 280), character_count: manualContent.slice(0, 280).length, image_prompt: "Suggested prompt" },
          newsletter: { adapted_content: manualContent, word_count: manualContent.split(" ").length, image_prompt: "Suggested prompt" },
          facebook: { adapted_content: manualContent.slice(0, 500), character_count: manualContent.slice(0, 500).length, image_prompt: "Suggested prompt" },
        },
        cover_image: { main_prompt: "string", style: "string", color_palette: [], mood: "string", key_elements: [] },
        scores: {
          human_writing_index: { value: 75, factors: [], explanation: "Manual content" },
          eeat_score: { value: 70, factors: [], explanation: "Manual content" },
          virality_score: { value: 70, factors: [], explanation: "Manual content" },
          roi_score: { value: 70, factors: [], explanation: "Manual content" },
          seo_score: { value: 70, factors: [], explanation: "Manual content" },
        },
        seo_metadata: {
          meta_title: "Manual Title",
          meta_description: "Manual Description",
          og_title: "Manual OG Title",
          og_description: "Manual OG Description",
          twitter_title: "Manual Twitter Title",
          twitter_description: "Manual Twitter Description",
          canonical_url: "",
          schema_json_ld: { "@context": "https://schema.org", "@type": "BlogPosting" },
        },
        eeat_analysis: { experience_signals: [], expertise_signals: [], authoritativeness_signals: [], trustworthiness_signals: [] },
        optimization_suggestions: [],
        research_sources: [],
      };
      setResult(data);
      setStep(3);
      setActiveTab("blog");
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
      const res = await fetch('/api/posts/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-media-post-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setError('Error al descargar ZIP: ' + e.message);
    }
  }

  const scores = result?.scores;
  const hlScore = scores?.human_likeness_score?.value ?? 0;
  const safeStatus = hlScore >= 75 ? { label: "GOOGLE SAFE", color: C.green } : hlScore >= 50 ? { label: "REVISAR", color: C.yellow } : { label: "RIESGO SEO", color: C.red };

  // ── RENDER ──
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPrimary, fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif", padding: "0 0 60px" }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>PostCraft <span style={{ color: C.accent }}>AI</span></span>
          </div>
          {/* STEP INDICATOR */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[{ n: 1, label: "Nicho" }, { n: 2, label: "Ideas" }, { n: 3, label: "Post" }].map(({ n, label }, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800,
                  background: step >= n ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.border,
                  color: step >= n ? "#fff" : C.textMuted,
                  boxShadow: step === n ? `0 0 12px ${C.accentGlow}` : "none",
                }}>{n}</div>
                <span style={{ fontSize: 11, color: step >= n ? C.textSecondary : C.textMuted, display: window.innerWidth < 480 ? "none" : "inline" }}>{label}</span>
                {i < 2 && <div style={{ width: 20, height: 1, background: step > n ? C.accent : C.border }} />}
              </div>
            ))}
          </div>
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

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>

        {/* ══════════ STEP 1 ══════════ */}
        {(step === 1 || !useAI) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* LEFT: Config */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.03em" }}>
                {useAI ? "¿Cuál es tu nicho?" : "Analiza tu contenido"}
              </div>
              <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
                {useAI ? "Genera 10 ideas de contenido viral con scoring EEAT, Virality y ROI" : "Obtén scores de calidad y adaptaciones para cada plataforma"}
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <Label>{useAI ? "Nicho / Industria *" : "Nicho (opcional)"}</Label>
              <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ej: restauración de agua, SaaS B2B, coaching fitness..." />

              <div style={{ marginTop: 14 }}>
                <Label>Empresa / Marca</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nombre de tu empresa o marca personal" />
              </div>

              <div style={{ marginTop: 14 }}>
                <Label>Audiencia objetivo</Label>
                <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="CMOs de SaaS, propietarios de PYMES, freelancers..." />
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <Label>Objetivo de negocio</Label>
              <ChipGroup options={GOALS} value={goal} onChange={setGoal} colorMap={{ awareness: C.blue, leads: C.green, thought_leadership: C.purple, engagement: C.gold, sales: C.red }} />

              <div style={{ marginTop: 14 }}>
                <Label>Tono de marca</Label>
                <ChipGroup options={VOICES} value={voice} onChange={setVoice} />
              </div>

              <div style={{ marginTop: 14 }}>
                <Label>Plataformas</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[...PLATFORMS, { id: "multi", label: "Todas", icon: "🌐", color: C.accent }].map(p => {
                    const active = platforms.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => {
                        if (p.id === "multi") { setPlatforms(["multi"]); return; }
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
            </div>

            {!useAI && (
              <div style={{ gridColumn: "1 / -1", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <Label>Contenido del post *</Label>
                <Textarea value={manualContent} onChange={e => setManualContent(e.target.value)} placeholder="Pega aquí tu post para analizar scores EEAT, virality, ROI y obtener adaptaciones por plataforma..." rows={6} />
              </div>
            )}

            {error && <div style={{ gridColumn: "1 / -1", background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>⚠️ {error}</div>}

            <div style={{ gridColumn: "1 / -1" }}>
              {loading ? <Spinner /> : (
                <Btn onClick={useAI ? generateIdeas : analyzeManual} disabled={loading}>
                  {useAI ? "✦ Generar 10 Ideas con AI →" : "📊 Analizar Scores →"}
                </Btn>
              )}
            </div>
          </div>
        )}

        {/* ══════════ STEP 2: IDEAS ══════════ */}
        {step === 2 && useAI && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
                  Elige una idea <span style={{ color: C.accent }}>({nicheData?.content_ideas?.length || 0})</span>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Nicho: <span style={{ color: C.textSecondary }}>{niche}</span> · Audiencia: <span style={{ color: C.textSecondary }}>{nicheData?.niche_analysis?.target_audience?.slice(0, 60)}</span></div>
              </div>
              <Btn variant="ghost" small onClick={() => setStep(1)}>← Volver</Btn>
            </div>

            {/* Niche Analysis Pills */}
            {nicheData?.niche_analysis?.trending_topics?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Trending:</span>
                {nicheData.niche_analysis.trending_topics.map(t => <Pill key={t} color={C.gold} active>{t}</Pill>)}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {(nicheData?.content_ideas || []).map(idea => (
                <IdeaCard key={idea.id} idea={idea} selected={selectedIdea?.id === idea.id} onClick={() => setSelectedIdea(idea)} />
              ))}
            </div>

            {selectedIdea && (
              <div style={{ background: `${C.accentGlow}`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Idea seleccionada</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{selectedIdea.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{selectedIdea.why_it_works}</div>
              </div>
            )}

            {error && <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

            {loading ? <Spinner /> : (
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={generatePost} disabled={!selectedIdea || loading}>✦ Generar Post Completo →</Btn>
                <Btn variant="ghost" onClick={() => setStep(1)}>← Cambiar Nicho</Btn>
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
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Post generado</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{selectedIdea?.title || "Análisis manual"}</div>
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
                <ScoreRing value={scores?.roi_score?.value ?? 0} label="ROI" />
                <ScoreRing value={scores?.human_likeness_score?.value ?? 0} label="Human Writing" />
                <ScoreRing value={scores?.eeat_score?.value ?? 0} label="EEAT" />
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
                    {[{ id: "scores", label: "Scores" }, { id: "seo", label: "SEO" }, { id: "eeat", label: "EEAT" }, { id: "tips", label: "Tips" }].map(t => (
                      <button key={t.id} onClick={() => setScoreTab(t.id)} style={{
                        flex: 1, padding: "10px 0", background: "none", border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 700, color: scoreTab === t.id ? C.accent : C.textMuted,
                        borderBottom: `2px solid ${scoreTab === t.id ? C.accent : "transparent"}`,
                      }}>{t.label}</button>
                    ))}
                  </div>

                  <div style={{ padding: 16 }}>
                    {scoreTab === "scores" && (
                      <div>
                        <BarScore label="Virality" value={scores?.virality_score?.value ?? 0} factors={scores?.virality_score?.factors} />
                        <BarScore label="ROI" value={scores?.roi_score?.value ?? 0} factors={scores?.roi_score?.factors} />
                        <BarScore label="Human Writing" value={scores?.human_writing_index?.value ?? 0} factors={scores?.human_writing_index?.factors} />
                        <BarScore label="EEAT" value={scores?.eeat_score?.value ?? 0} factors={scores?.eeat_score?.factors} />
                        <BarScore label="SEO" value={scores?.seo_score?.value ?? 0} factors={scores?.seo_score?.factors} />
                        <div style={{ marginTop: 8, padding: "10px 12px", background: C.surface, borderRadius: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                          <strong style={{ color: C.textSecondary }}>Human Writing:</strong> {scores?.human_writing_index?.explanation}
                        </div>
                      </div>
                    )}

                    {scoreTab === "seo" && result.seo_metadata && (
                      <div style={{ fontSize: 12 }}>
                        <div style={{ marginBottom: 12 }}>
                          <Label>Meta Title (50-60 chars)</Label>
                          <Textarea 
                            value={result.seo_metadata.meta_title || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, meta_title: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="SEO meta title"
                            rows={2}
                          />
                          <div style={{ fontSize: 10, color: result.seo_metadata.meta_title?.length > 60 ? C.red : C.textMuted, marginTop: 4 }}>
                            {result.seo_metadata.meta_title?.length || 0}/60 chars
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Meta Description (150-160 chars)</Label>
                          <Textarea 
                            value={result.seo_metadata.meta_description || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, meta_description: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="SEO meta description"
                            rows={3}
                          />
                          <div style={{ fontSize: 10, color: result.seo_metadata.meta_description?.length > 160 ? C.red : C.textMuted, marginTop: 4 }}>
                            {result.seo_metadata.meta_description?.length || 0}/160 chars
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Open Graph Title</Label>
                          <Input 
                            value={result.seo_metadata.og_title || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, og_title: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="OG title for social sharing"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Open Graph Description</Label>
                          <Textarea 
                            value={result.seo_metadata.og_description || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, og_description: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="OG description"
                            rows={2}
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Twitter Card Title</Label>
                          <Input 
                            value={result.seo_metadata.twitter_title || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, twitter_title: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="Twitter card title"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Canonical URL</Label>
                          <Input 
                            value={result.seo_metadata.canonical_url || ""} 
                            onChange={e => {
                              const updated = { ...result, seo_metadata: { ...result.seo_metadata, canonical_url: e.target.value } };
                              setResult(updated);
                            }}
                            placeholder="https://yourdomain.com/post-url"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Label>Schema.org JSON-LD</Label>
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontSize: 11, fontFamily: "monospace", color: C.textMuted, maxHeight: 150, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                            {JSON.stringify(result.seo_metadata.schema_json_ld, null, 2)}
                          </div>
                          <Btn small variant="ghost" onClick={() => copy(JSON.stringify(result.seo_metadata.schema_json_ld, null, 2), "schema")}>
                            {copied === "schema" ? "✅ Copiado" : "📋 Copiar JSON-LD"}
                          </Btn>
                        </div>

                        {result.seo_analysis && (
                          <div style={{ marginTop: 12, padding: "10px 12px", background: C.surface, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>SEO Analysis</div>
                            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                              <strong>Primary Keyword:</strong> {result.seo_analysis.primary_keyword}<br/>
                              <strong>LSI Keywords:</strong> {(result.seo_analysis.lsi_keywords || []).join(", ")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {scoreTab === "eeat" && result.eeat_analysis && (
                      <div style={{ fontSize: 12 }}>
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
                      <div>
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

                {/* Status + New Post */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Estado del Post</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["draft", "ready", "published"].map(s => (
                      <button key={s} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${s === "draft" ? C.yellow : s === "ready" ? C.green : C.accent}44`, background: s === "draft" ? `${C.yellow}11` : s === "ready" ? `${C.green}11` : `${C.accent}11`, color: s === "draft" ? C.yellow : s === "ready" ? C.green : C.accent }}>
                        {s === "draft" ? "📝 Draft" : s === "ready" ? "✅ Ready" : "🚀 Publicado"}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Btn onClick={() => { setStep(useAI ? 2 : 1); setResult(null); setSelectedIdea(null); }}>
                      ✦ Nuevo Post
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
