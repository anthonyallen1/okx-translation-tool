import { useState, useEffect, useRef, useCallback } from "react";

/* ── Brand Palette ── */
const C = {
  bg: "#1a1a1a",
  card: "rgba(255,255,255,0.05)",
  input: "rgba(255,255,255,0.07)",
  dropZone: "rgba(255,255,255,0.025)",
  headerBg: "rgba(26,26,26,0.97)",
  border: "rgba(255,255,255,0.12)",
  borderAcc: "rgba(188,255,47,0.35)",
  borderDash: "rgba(255,255,255,0.15)",
  t1: "#f5f5f5",
  tLabel: "rgba(255,255,255,0.35)",
  tField: "rgba(255,255,255,0.7)",
  tPlace: "rgba(255,255,255,0.3)",
  tMuted: "rgba(255,255,255,0.55)",
  acc: "#BCFF2F",
  accBg: "rgba(188,255,47,0.12)",
  accBorder: "rgba(188,255,47,0.35)",
  disabledBg: "rgba(255,255,255,0.06)",
  red: "#f87171",
  amber: "#fbbf24",
  green: "#BCFF2F",
  blue: "#60a5fa",
};

const LANGS = [
  ["fr","French","🇫🇷"],["de","German","🇩🇪"],["nl","Dutch","🇳🇱"],["pl","Polish","🇵🇱"],
  ["it","Italian","🇮🇹"],["es","Spanish","🇪🇸"],["pt","Portuguese","🇵🇹"],["cs","Czech","🇨🇿"],
  ["ro","Romanian","🇷🇴"],["no","Norwegian","🇳🇴"],["sv","Swedish","🇸🇪"],["fi","Finnish","🇫🇮"],
  ["ar","Arabic","🇸🇦"],["zh-TW","Traditional Chinese","🇹🇼"],["zh-CN","Simplified Chinese","🇨🇳"],
  ["es-419","LATAM Spanish","🌎"],["pt-BR","Brazilian Portuguese","🇧🇷"],
  ["vi","Vietnamese","🇻🇳"],["id","Indonesian","🇮🇩"],["ru","Russian","🇷🇺"],["uk","Ukrainian","🇺🇦"]
];

const secColor = (s) => {
  if (/product card/i.test(s)) return "#A78BFA";
  if (/^cta/i.test(s)) return C.amber;
  if (/subject|preheader/i.test(s)) return C.blue;
  if (/disclaimer/i.test(s)) return C.tMuted;
  return C.tField;
};
const secTag = (s) => {
  if (/product card/i.test(s)) return "CARD";
  if (/^cta/i.test(s)) return "CTA";
  if (/subject|preheader/i.test(s)) return "META";
  if (/disclaimer/i.test(s)) return "LEGAL";
  return "COPY";
};
const secOrder = (s) => ({ META: 0, COPY: 1, CTA: 2, CARD: 3, LEGAL: 4 }[secTag(s)] ?? 5);
const sortSecs = (keys) => [...keys].sort((a, b) => secOrder(a) - secOrder(b));

async function callAPI(msgs) {
  const r = await fetch("/.netlify/functions/ai-proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, messages: msgs })
  });
  const d = await r.json();
  let txt = (d.content || []).map(c => c.text || "").join("");
  txt = txt.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(txt);
}

/* ── Shared Components ── */
function OKXLogo() {
  // Tight checkerboard: 5 white squares with minimal 1px gap
  const s = 8; const g = 1.2; const u = s + g;
  const squares = [[0,0],[2,0],[1,1],[0,2],[2,2]];
  const grid = 3 * s + 2 * g;
  const pad = 5;
  const total = grid + pad * 2;
  return (
    <svg width={36} height={36} viewBox={`0 0 ${total} ${total}`} fill="none">
      <rect width={total} height={total} rx="7" fill="#000"/>
      {squares.map(([cx,cy], i) => (
        <rect key={i} x={pad + cx * u} y={pad + cy * u} width={s} height={s} rx="0.5" fill="#fff"/>
      ))}
    </svg>
  );
}

function Badge({ tag }) {
  const cl = { META: C.blue, COPY: C.tMuted, CTA: C.amber, CARD: "#A78BFA", LEGAL: C.tMuted };
  const col = cl[tag] || C.tMuted;
  return <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", padding: "2px 6px", borderRadius: 3, background: col + "1A", color: col, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>{tag}</span>;
}

function StepBadge({ n }) {
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, background: C.accBg, border: `1px solid ${C.accBorder}`, color: C.acc, fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", marginRight: 12, flexShrink: 0 }}>{n}</span>;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} style={{ background: "none", border: `1px solid ${C.border}`, color: ok ? C.acc : C.tMuted, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", transition: "all 0.2s" }}>{ok ? "✓ Copied" : "Copy"}</button>;
}

/* ── Gradient Keyframes (injected once) ── */
const GRADIENT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export default function App() {
  const [subj, setSubj] = useState("");
  const [preh, setPreh] = useState("");
  const [img, setImg] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [secs, setSecs] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [langs, setLangs] = useState(new Set());
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState({ cur: "", done: 0, total: 0 });
  const [results, setResults] = useState({});
  const [expanded, setExpanded] = useState({});
  const fileRef = useRef();

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setImg(f); const r = new FileReader(); r.onload = () => setImgPrev(r.result); r.readAsDataURL(f);
  }, []);

  useEffect(() => {
    const h = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i of items) { if (i.type.startsWith("image/")) { handleFile(i.getAsFile()); e.preventDefault(); break; } }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [handleFile]);

  const extract = async () => {
    if (!img) return;
    setExtracting(true);
    try {
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(img); });
      let prompt = `Analyze this OKX marketing email screenshot. Extract translatable text into JSON.\nRules: Skip images/charts/data tables/logos. Use "• " for bullets. Number CTAs: "CTA 1","CTA 2". Product cards: "Product Card N - Title","Product Card N - Subtitle".\nSections: "Subject Line","Preheader","Title H1","Title H2","Body","CTA 1","CTA 2","CTA 3","Product Card N - Title","Product Card N - Subtitle","Description","Sub Copy","Disclaimer".`;
      if (subj) prompt += `\nProvided Subject Line: "${subj}"`;
      if (preh) prompt += `\nProvided Preheader: "${preh}"`;
      prompt += `\nReturn ONLY valid JSON object with section names as keys and text as values. No markdown fencing.`;
      const data = await callAPI([{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: img.type, data: b64 } }, { type: "text", text: prompt }] }]);
      if (subj && !data["Subject Line"]) data["Subject Line"] = subj;
      if (preh && !data["Preheader"]) data["Preheader"] = preh;
      setSecs(data);
    } catch (e) { alert("Extraction failed: " + e.message); }
    setExtracting(false);
  };

  const translate = async () => {
    if (!secs || langs.size === 0) return;
    setTranslating(true);
    const arr = [...langs]; const res = {};
    for (let i = 0; i < arr.length; i++) {
      const l = LANGS.find(x => x[0] === arr[i]);
      const name = l ? l[1] : arr[i];
      setProgress({ cur: name, done: i, total: arr.length });
      try {
        const extra = arr[i] === "es-419" ? "Use Latin American Spanish." : arr[i] === "pt-BR" ? "Use Brazilian Portuguese." : arr[i] === "zh-TW" ? "Use Traditional Chinese for Taiwan/HK." : arr[i] === "zh-CN" ? "Use Simplified Chinese for mainland China." : "";
        const prompt = `Translate these OKX email sections to ${name}. Keep brand names (OKX, Bitcoin, Solana, Ethereum, USDT, etc) and URLs unchanged. Keep "• " bullets. Subject ~33 chars, Preheader ~37 chars, CTAs 1-3 words. ${extra}\n${JSON.stringify(secs)}\nReturn ONLY JSON with same keys, translated values. No markdown.`;
        const data = await callAPI([{ role: "user", content: prompt }]);
        res[arr[i]] = data;
        if (i === 0) setExpanded(p => ({ ...p, [arr[i]]: true }));
      } catch (e) { res[arr[i]] = { error: e.message }; }
      setResults({ ...res });
    }
    setProgress({ cur: "", done: arr.length, total: arr.length });
    setTranslating(false);
  };

  const exportTSV = () => {
    const keys = secs ? sortSecs(Object.keys(secs)) : [];
    let tsv = "Section\tEnglish\t" + [...langs].map(l => LANGS.find(x => x[0] === l)?.[1] || l).join("\t") + "\n";
    keys.forEach(k => {
      let row = `${k}\t${(secs[k] || "").replace(/\t/g, " ")}`;
      [...langs].forEach(l => { row += "\t" + String(results[l]?.[k] || "").replace(/\t/g, " "); });
      tsv += row + "\n";
    });
    const a = document.createElement("a");
    a.href = "data:text/tab-separated-values;charset=utf-8," + encodeURIComponent(tsv);
    a.download = "okx-translations.tsv"; a.click();
  };

  const sortedKeys = secs ? sortSecs(Object.keys(secs)) : [];

  /* ── Shared Styles ── */
  const si = { width: "100%", background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.t1, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
  const cardS = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 26px", marginBottom: 20, animation: "fadeInUp 0.4s ease both" };
  const ctaBtn = (on) => ({
    padding: "12px 24px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", cursor: on ? "pointer" : "default", width: "100%",
    letterSpacing: 0.3, transition: "all 0.3s",
    ...(on ? {
      background: "linear-gradient(90deg, #7a9c00, #BCFF2F, #d4ff73, #BCFF2F, #7a9c00)",
      backgroundSize: "200% auto",
      animation: "shimmer 3s linear infinite",
      color: "#000",
    } : {
      background: C.disabledBg, color: C.tMuted, opacity: 0.4,
    })
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.t1, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{GRADIENT_CSS}</style>

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <OKXLogo />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>Email Translation Agent</div>
              <div style={{ fontSize: 11, color: C.tLabel, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>Global Email Marketing</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.acc, boxShadow: `0 0 8px ${C.acc}66` }}></span>
            <span style={{ fontSize: 11, color: C.tMuted, fontFamily: "'JetBrains Mono',monospace" }}>Online</span>
          </div>
        </div>
      </div>

      {/* ── Hero / Gradient Title ── */}
      <div style={{ textAlign: "center", padding: "52px 24px 36px" }}>
        <h1 style={{
          fontSize: 56, fontWeight: 800, margin: 0, letterSpacing: -1.5, lineHeight: 1.1,
          background: "linear-gradient(90deg, #BCFF2F, #34d399, #60a5fa, #a78bfa, #BCFF2F)",
          backgroundSize: "300% 300%",
          animation: "gradientFlow 6s ease infinite",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>Translate.</h1>
        <p style={{ color: C.tMuted, fontSize: 15, marginTop: 10, fontWeight: 400, letterSpacing: 0.2 }}>
          AI-powered translations across 21 languages
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Step 1: Email Content ── */}
        <div style={{ ...cardS, animationDelay: "0.05s" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <StepBadge n={1} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Email Content</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: C.tField, fontWeight: 500 }}>Subject Line</span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: subj.length > 33 ? C.red : C.tLabel }}>{subj.length}/33</span>
              </div>
              <input style={si} value={subj} onChange={e => setSubj(e.target.value)} placeholder="Enter subject line..." />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: C.tField, fontWeight: 500 }}>Preheader</span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: preh.length > 37 ? C.red : C.tLabel }}>{preh.length}/37</span>
              </div>
              <input style={si} value={preh} onChange={e => setPreh(e.target.value)} placeholder="Enter preheader..." />
            </div>
          </div>

          {!imgPrev ? (
            <div style={{
              border: `2px dashed ${C.borderDash}`, borderRadius: 12, padding: "40px 20px", textAlign: "center",
              cursor: "pointer", color: C.tPlace, fontSize: 13, background: C.dropZone, transition: "all 0.25s"
            }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.acc; e.currentTarget.style.background = C.accBg; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = C.borderDash; e.currentTarget.style.background = C.dropZone; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.borderDash; e.currentTarget.style.background = C.dropZone; handleFile(e.dataTransfer.files[0]); }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
              <div style={{ fontWeight: 500 }}>Drop, click, or paste (Ctrl+V) a screenshot</div>
              <div style={{ fontSize: 11, color: C.tLabel, marginTop: 6 }}>Supports PNG, JPG, WebP</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div style={{ position: "relative", display: "inline-block", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <img src={imgPrev} alt="preview" style={{ maxWidth: "100%", maxHeight: 240, display: "block" }} />
              <button onClick={() => { setImg(null); setImgPrev(null); setSecs(null); }} style={{
                position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff",
                border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)"
              }}>✕</button>
            </div>
          )}

          <div style={{ height: 16 }} />
          <button style={ctaBtn(!!img && !extracting)} onClick={extract} disabled={!img || extracting}>
            {extracting ? "⏳ Extracting content..." : secs ? "🔄 Re-extract" : "⚡ Extract Content"}
          </button>

          {secs && (
            <div style={{ marginTop: 20, background: C.accBg, borderRadius: 12, border: `1px solid ${C.accBorder}`, padding: "18px 20px", animation: "fadeInUp 0.3s ease both" }}>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: C.acc, marginBottom: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.acc }}></span>
                {sortedKeys.length} sections extracted
              </div>
              {sortedKeys.map(k => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: secColor(k), fontWeight: 600 }}>{k}</span>
                    <Badge tag={secTag(k)} />
                  </div>
                  <textarea style={{ ...si, minHeight: 38, resize: "vertical", fontSize: 12, lineHeight: 1.5 }}
                    value={secs[k]} onChange={e => setSecs(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Step 2: Target Languages ── */}
        <div style={{ ...cardS, animationDelay: "0.1s" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <StepBadge n={2} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Target Languages</span>
            {langs.size > 0 && <span style={{ marginLeft: 10, fontSize: 11, background: C.accBg, color: C.acc, padding: "3px 10px", borderRadius: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, border: `1px solid ${C.accBorder}` }}>{langs.size}</span>}
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: C.acc, cursor: "pointer", fontWeight: 600, transition: "opacity 0.2s" }} onClick={() => setLangs(new Set(LANGS.map(l => l[0])))}>Select All</span>
            <span style={{ color: C.tMuted, cursor: "pointer", fontWeight: 500, transition: "opacity 0.2s" }} onClick={() => setLangs(new Set())}>Clear All</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
            {LANGS.map(([code, name, flag]) => {
              const sel = langs.has(code);
              return (
                <label key={code} style={{
                  display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "7px 10px",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                  background: sel ? C.accBg : "transparent",
                  border: `1px solid ${sel ? C.accBorder : "transparent"}`
                }}>
                  <input type="checkbox" checked={sel} onChange={() => { const n = new Set(langs); n.has(code) ? n.delete(code) : n.add(code); setLangs(n); }} style={{ accentColor: C.acc, width: 14, height: 14 }} />
                  <span style={{ fontSize: 15 }}>{flag}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: sel ? C.t1 : C.tMuted, fontWeight: sel ? 600 : 400, transition: "all 0.2s" }}>{name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Step 3: Translate ── */}
        <div style={{ ...cardS, animationDelay: "0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <StepBadge n={3} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Translate</span>
          </div>
          <button style={ctaBtn(!!secs && langs.size > 0 && !translating)} onClick={translate} disabled={!secs || langs.size === 0 || translating}>
            {translating ? `⏳ Translating ${progress.cur}... (${progress.done}/${progress.total})` : `🌐 Translate to ${langs.size} Language${langs.size !== 1 ? "s" : ""}`}
          </button>
          {translating && (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", background: `linear-gradient(90deg, #7a9c00, ${C.acc})`, borderRadius: 6, width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: C.tLabel, fontFamily: "'JetBrains Mono',monospace", marginTop: 6, textAlign: "center" }}>
                {progress.done} of {progress.total} languages complete
              </div>
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {Object.keys(results).length > 0 && (
          <div style={{ animation: "fadeInUp 0.4s ease both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Results</span>
              <button onClick={exportTSV} style={{
                background: C.accBg, border: `1px solid ${C.accBorder}`, color: C.acc,
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, transition: "all 0.2s"
              }}>↓ Export TSV</button>
            </div>
            {[...langs].map(code => {
              const l = LANGS.find(x => x[0] === code);
              if (!results[code]) return null;
              const isExp = expanded[code];
              const rKeys = results[code].error ? [] : sortSecs(Object.keys(results[code]));
              return (
                <div key={code} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                  <div onClick={() => setExpanded(p => ({ ...p, [code]: !p[code] }))} style={{
                    display: "flex", alignItems: "center", padding: "14px 18px", cursor: "pointer",
                    justifyContent: "space-between", background: isExp ? "rgba(255,255,255,0.03)" : "transparent", transition: "background 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{l?.[2]}</span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14 }}>{l?.[1]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <CopyBtn text={rKeys.map(k => `${k}: ${results[code][k]}`).join("\n")} />
                      <span style={{ color: C.tLabel, fontSize: 18, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</span>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ padding: "6px 18px 16px" }}>
                      {results[code].error ? (
                        <div style={{ color: C.red, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Error: {results[code].error}</div>
                      ) : rKeys.map(k => (
                        <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ minWidth: 155, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: secColor(k), fontWeight: 600 }}>{k}</span>
                            <div style={{ marginTop: 3 }}><Badge tag={secTag(k)} /></div>
                          </div>
                          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: C.t1, wordBreak: "break-word" }}>{results[code][k]}</div>
                          <CopyBtn text={results[code][k]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
