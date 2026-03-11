import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg: "#0B0E11", card: "#121417", el: "#1A1D21",
  b1: "#22262B", b2: "#2B3039", t1: "#E1E4E8", t2: "#8A919E", t3: "#5C6470",
  g: "#2DC08D", r: "#CF304A"
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
  if (/^cta/i.test(s)) return "#F59E0B";
  if (/subject|preheader/i.test(s)) return "#60A5FA";
  if (/disclaimer/i.test(s)) return "#6B7280";
  return "#8A919E";
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, messages: msgs })
  });
  const d = await r.json();
  let txt = (d.content || []).map(c => c.text || "").join("");
  txt = txt.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(txt);
}

function Badge({ tag }) {
  const cl = { META: "#60A5FA", COPY: "#8A919E", CTA: "#F59E0B", CARD: "#A78BFA", LEGAL: "#6B7280" };
  return <span style={{ fontSize: 9, fontFamily: "monospace", padding: "1px 5px", borderRadius: 3, background: (cl[tag] || "#8A919E") + "22", color: cl[tag] || "#8A919E", fontWeight: 700, letterSpacing: 1 }}>{tag}</span>;
}

function StepBadge({ n }) {
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 12, background: C.g, color: "#000", fontWeight: 800, fontSize: 12, fontFamily: "monospace", marginRight: 10 }}>{n}</span>;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} style={{ background: "none", border: `1px solid ${C.b2}`, color: ok ? C.g : C.t2, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>{ok ? "✓" : "Copy"}</button>;
}

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
    setImg(f);
    const r = new FileReader();
    r.onload = () => setImgPrev(r.result);
    r.readAsDataURL(f);
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
    const blob = new Blob([tsv], { type: "text/tab-separated-values" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "okx-translations.tsv"; a.click();
  };

  const sortedKeys = secs ? sortSecs(Object.keys(secs)) : [];
  const si = { width: "100%", background: C.el, border: `1px solid ${C.b2}`, borderRadius: 6, padding: "9px 12px", color: C.t1, fontSize: 13, fontFamily: "system-ui", outline: "none", boxSizing: "border-box" };
  const sb = (on) => ({ padding: "10px 22px", borderRadius: 6, border: "none", fontWeight: 700, fontSize: 13, fontFamily: "monospace", cursor: on ? "pointer" : "default", background: on ? C.g : C.b2, color: on ? "#000" : C.t3, opacity: on ? 1 : 0.5, width: "100%" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.t1, fontFamily: "system-ui, sans-serif", padding: "0 0 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", borderBottom: `1px solid ${C.b1}` }}>
        <span style={{ background: "#fff", color: "#000", fontWeight: 900, fontSize: 13, fontFamily: "monospace", padding: "4px 8px", borderRadius: 4, letterSpacing: 1 }}>OKX</span>
        <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "monospace", letterSpacing: -0.5 }}>Email Translator</span>
      </div>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {/* Step 1 */}
        <div style={{ background: C.card, border: `1px solid ${C.b1}`, borderRadius: 10, padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}><StepBadge n={1} />Email Content</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: C.t2, marginBottom: 4, display: "flex", justifyContent: "space-between" }}><span>Subject Line</span><span style={{ color: subj.length > 33 ? C.r : C.t3 }}>{subj.length}/33</span></div>
          <input style={si} value={subj} onChange={e => setSubj(e.target.value)} placeholder="Enter subject line..." />
          <div style={{ height: 10 }} />
          <div style={{ fontSize: 11, fontFamily: "monospace", color: C.t2, marginBottom: 4, display: "flex", justifyContent: "space-between" }}><span>Preheader</span><span style={{ color: preh.length > 37 ? C.r : C.t3 }}>{preh.length}/37</span></div>
          <input style={si} value={preh} onChange={e => setPreh(e.target.value)} placeholder="Enter preheader..." />
          <div style={{ height: 14 }} />
          {!imgPrev ? (
            <div style={{ border: `2px dashed ${C.b2}`, borderRadius: 8, padding: "32px 16px", textAlign: "center", cursor: "pointer", color: C.t3, fontSize: 13 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.g; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = C.b2; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.b2; handleFile(e.dataTransfer.files[0]); }}>
              📸 Drop, click, or paste (Ctrl+V) a screenshot
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={imgPrev} alt="preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 6, border: `1px solid ${C.b2}` }} />
              <button onClick={() => { setImg(null); setImgPrev(null); setSecs(null); }} style={{ position: "absolute", top: 6, right: 6, background: C.r, color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>✕</button>
            </div>
          )}
          <div style={{ height: 14 }} />
          <button style={sb(!!img && !extracting)} onClick={extract} disabled={!img || extracting}>
            {extracting ? "Extracting..." : secs ? "Re-extract" : "Extract Content"}
          </button>
          {secs && (
            <div style={{ marginTop: 16, background: C.el, borderRadius: 8, border: `1px solid ${C.g}33`, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: C.g, marginBottom: 10, fontWeight: 700 }}>✓ Extracted {sortedKeys.length} sections</div>
              {sortedKeys.map(k => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: secColor(k), fontWeight: 600 }}>{k}</span>
                    <Badge tag={secTag(k)} />
                  </div>
                  <textarea style={{ ...si, minHeight: 36, resize: "vertical", fontSize: 12, lineHeight: 1.4 }} value={secs[k]} onChange={e => setSecs(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div style={{ background: C.card, border: `1px solid ${C.b1}`, borderRadius: 10, padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>
            <StepBadge n={2} />Target Languages
            {langs.size > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: C.g + "22", color: C.g, padding: "2px 8px", borderRadius: 10, fontFamily: "monospace" }}>{langs.size}</span>}
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 12, fontFamily: "monospace" }}>
            <span style={{ color: C.g, cursor: "pointer" }} onClick={() => setLangs(new Set(LANGS.map(l => l[0])))}>Select All</span>
            <span style={{ color: C.t3, cursor: "pointer" }} onClick={() => setLangs(new Set())}>Clear All</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 6 }}>
            {LANGS.map(([code, name, flag]) => (
              <label key={code} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "5px 8px", borderRadius: 5, cursor: "pointer", background: langs.has(code) ? C.g + "11" : "transparent", border: `1px solid ${langs.has(code) ? C.g + "44" : "transparent"}` }}>
                <input type="checkbox" checked={langs.has(code)} onChange={() => { const n = new Set(langs); n.has(code) ? n.delete(code) : n.add(code); setLangs(n); }} style={{ accentColor: C.g }} />
                <span>{flag}</span><span style={{ fontFamily: "monospace" }}>{name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ background: C.card, border: `1px solid ${C.b1}`, borderRadius: 10, padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}><StepBadge n={3} />Translate</div>
          <button style={sb(!!secs && langs.size > 0 && !translating)} onClick={translate} disabled={!secs || langs.size === 0 || translating}>
            {translating ? `Translating ${progress.cur}... (${progress.done}/${progress.total})` : `Translate to ${langs.size} Language${langs.size !== 1 ? "s" : ""}`}
          </button>
          {translating && <div style={{ marginTop: 10, background: C.b1, borderRadius: 4, height: 6, overflow: "hidden" }}><div style={{ height: "100%", background: C.g, borderRadius: 4, width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, transition: "width 0.3s" }} /></div>}
        </div>

        {/* Results */}
        {Object.keys(results).length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>Results</span>
              <button onClick={exportTSV} style={{ background: C.el, border: `1px solid ${C.b2}`, color: C.t1, padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Export TSV ↓</button>
            </div>
            {[...langs].map(code => {
              const l = LANGS.find(x => x[0] === code);
              if (!results[code]) return null;
              const isExp = expanded[code];
              const rKeys = results[code].error ? [] : sortSecs(Object.keys(results[code]));
              return (
                <div key={code} style={{ background: C.card, border: `1px solid ${C.b1}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                  <div onClick={() => setExpanded(p => ({ ...p, [code]: !p[code] }))} style={{ display: "flex", alignItems: "center", padding: "12px 16px", cursor: "pointer", justifyContent: "space-between", background: isExp ? C.el : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{l?.[2]}</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13 }}>{l?.[1]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CopyBtn text={rKeys.map(k => `${k}: ${results[code][k]}`).join("\n")} />
                      <span style={{ color: C.t3, fontSize: 16, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ padding: "8px 16px 14px" }}>
                      {results[code].error ? <div style={{ color: C.r, fontSize: 12 }}>Error: {results[code].error}</div> : rKeys.map(k => (
                        <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.b1}` }}>
                          <div style={{ minWidth: 150, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: secColor(k) }}>{k}</span>
                            <div style={{ marginTop: 2 }}><Badge tag={secTag(k)} /></div>
                          </div>
                          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: C.t1, wordBreak: "break-word" }}>{results[code][k]}</div>
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
