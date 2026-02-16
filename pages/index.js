import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

// ─── CONFIG ─────────────────────────────────────────────────────────
const SECTORS = [
  { id: "sw", name: "Enterprise Software", icon: "⚙️", tickers: ["SAP", "ORCL", "CRM", "WDAY"], threat: "Claude Cowork, Cursor, Devin ersetzen Business-Software" },
  { id: "fd", name: "Finanzdaten & Ratings", icon: "📊", tickers: ["FDS", "MCO", "SPGI", "NDAQ"], threat: "KI-Finanzanalyse ersetzt Datenanbieter" },
  { id: "fa", name: "Finanzberatung", icon: "🏦", tickers: ["SCHW", "LPLA", "AMP", "RJF"], threat: "Altruist Hazel automatisiert Steuerberatung" },
  { id: "co", name: "IT-Beratung", icon: "💼", tickers: ["ACN", "EPAM", "IT", "GLOB"], threat: "KI-Coding bedroht Consulting-Margen" },
  { id: "ed", name: "Bildung", icon: "🎓", tickers: ["CHGG", "DUOL", "COUR"], threat: "ChatGPT als Tutor macht Plattformen obsolet" },
];

const AUTO_REFRESH_MS = 120_000; // 2 min

// ─── HELPERS ────────────────────────────────────────────────────────
const cx = (...args) => args.filter(Boolean).join(" ");
const fmt = (n, d = 2) => (typeof n === "number" ? n.toFixed(d) : "—");
const pct = (n) => (typeof n === "number" ? `${n > 0 ? "+" : ""}${n.toFixed(1)}%` : "—");

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [prices, setPrices] = useState({});
  const [products, setProducts] = useState({});
  const [signals, setSignals] = useState({});
  const [news, setNews] = useState([]);
  const [tradeIdeas, setTradeIdeas] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState({});
  const [history, setHistory] = useState({});
  const [scanLog, setScanLog] = useState([]);
  const [scanRunning, setScanRunning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  // ── Fetch prices from our API route (Yahoo Finance) ──
  const fetchPrices = useCallback(async (tickers) => {
    try {
      const r = await fetch(`/api/stocks?tickers=${tickers.join(",")}`);
      const data = await r.json();
      const map = {};
      for (const s of data.stocks || []) {
        if (!s.error) {
          map[s.ticker] = s;
          setHistory(prev => ({
            ...prev,
            [s.ticker]: [...(prev[s.ticker] || []).slice(-29), s.price],
          }));
        }
      }
      setPrices(prev => ({ ...prev, ...map }));
      return map;
    } catch (e) {
      return {};
    }
  }, []);

  // ── Fetch products from our API route ──
  const fetchProducts = useCallback(async (ticker, price) => {
    try {
      const r = await fetch(`/api/products?ticker=${ticker}&price=${price}`);
      const data = await r.json();
      setProducts(prev => ({ ...prev, [ticker]: { items: data.products || [], time: new Date() } }));
      return data.products || [];
    } catch {
      return [];
    }
  }, []);

  // ── Generate signal from our API route (local logic, no cost) ──
  const fetchSignal = useCallback(async (ticker, price, change, sector) => {
    try {
      const r = await fetch(`/api/signal?ticker=${ticker}&price=${price}&change=${change}&sector=${encodeURIComponent(sector)}`);
      const sig = await r.json();
      setSignals(prev => ({ ...prev, [ticker]: sig }));
      if (sig.signal === "SHORT" && sig.confidence >= 7) {
        setTradeIdeas(prev => {
          if (prev.find(t => t.ticker === ticker)) return prev;
          return [{ ...sig, id: Date.now(), sectorName: sector }, ...prev];
        });
        setAlerts(prev => [{
          id: Date.now(), type: "TRADE",
          msg: `🔴 SHORT ${ticker} @ $${price} (${pct(change)}) — Konfidenz ${sig.confidence}/10`,
          time: new Date(),
        }, ...prev.slice(0, 29)]);
      }
      return sig;
    } catch {
      return null;
    }
  }, []);

  // ── Fetch news ──
  const fetchNews = useCallback(async () => {
    try {
      const r = await fetch("/api/news");
      const data = await r.json();
      if (data.news?.length) setNews(data.news);
    } catch {}
  }, []);

  // ── Full sector scan ──
  const scanSector = useCallback(async (sector) => {
    const log = (m) => setScanLog(p => [...p, { msg: m, time: new Date() }]);
    log(`🔍 ${sector.name}: Lade Kurse...`);
    setLoading(p => ({ ...p, [sector.id]: true }));

    const data = await fetchPrices(sector.tickers);
    const loaded = Object.keys(data);
    log(`✅ ${loaded.length}/${sector.tickers.length} Kurse geladen`);

    const shorts = loaded.filter(t => data[t].change < -2);
    if (shorts.length > 0) {
      log(`📉 ${shorts.length} Short-Kandidaten: ${shorts.join(", ")}`);
      for (const t of shorts.slice(0, 3)) {
        log(`  🏦 Suche Produkte für ${t}...`);
        await fetchProducts(t, data[t].price);
        log(`  🤖 Generiere Signal für ${t}...`);
        await fetchSignal(t, data[t].price, data[t].change, sector.name);
      }
    } else {
      log(`ℹ️ Keine Aktien unter -2%`);
    }

    setLoading(p => ({ ...p, [sector.id]: false }));
    log(`✅ ${sector.name} fertig`);
  }, [fetchPrices, fetchProducts, fetchSignal]);

  // ── Full market scan ──
  const runFullScan = useCallback(async () => {
    setScanRunning(true);
    setScanLog([]);
    const log = (m) => setScanLog(p => [...p, { msg: m, time: new Date() }]);

    log("🚀 VOLLSCAN GESTARTET");
    log("━".repeat(35));

    log("📰 Lade News...");
    await fetchNews();
    log("✅ News geladen");

    for (const sector of SECTORS) {
      log("");
      await scanSector(sector);
    }

    log("");
    log("━".repeat(35));
    log("✅ VOLLSCAN ABGESCHLOSSEN");
    setScanRunning(false);
  }, [scanSector, fetchNews]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      const allTickers = SECTORS.flatMap(s => s.tickers);
      const loaded = allTickers.filter(t => prices[t]);
      if (loaded.length > 0) fetchPrices(loaded);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, prices, fetchPrices]);

  // Derived data
  const allStocks = Object.entries(prices)
    .map(([t, d]) => ({ ticker: t, ...d }))
    .sort((a, b) => a.change - b.change);
  const shortCount = allStocks.filter(s => s.change < -3).length;

  return (
    <>
      <Head>
        <title>Consors Disruptor — KI-Disruption Trading</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        :root {
          --bg: #06060b; --card: #0d0d18; --brd: rgba(255,255,255,.05);
          --txt: #e2e2ec; --mut: #5f5f78; --m: 'IBM Plex Mono', monospace;
          --s: 'Outfit', sans-serif; --red: #ff2d55; --grn: #30d158;
          --org: #ff9500; --blu: #0a84ff; --yl: #ffd60a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--txt); font-family: var(--s); }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideR { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
        @keyframes shimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes glow { 0%,100% { box-shadow:0 0 12px #ff2d5510 } 50% { box-shadow:0 0 28px #ff2d5525 } }
        @keyframes scan { 0% { top:-1px } 100% { top:100% } }
        .shimmer { background:linear-gradient(90deg,#0d0d18 25%,#181830 50%,#0d0d18 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; height:60px; }
        .fade { animation: fadeUp .35s ease both; }
        .card { background:var(--card); border:1px solid var(--brd); border-radius:10px; padding:14px; transition:all .2s; }
        .card-glow { box-shadow:0 0 20px #ff2d5515; border-color:#ff2d5530; animation:glow 3s ease-in-out infinite; }
        .badge { padding:2px 7px; border-radius:3px; font-size:10px; font-weight:700; font-family:var(--m); letter-spacing:.03em; display:inline-block; }
        button { font-family:var(--s); cursor:pointer; }
        .mono { font-family: var(--m); }
      `}</style>

      {/* Scanline */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:100, overflow:"hidden", opacity:.012 }}>
        <div style={{ position:"absolute", width:"100%", height:1, background:"#fff", animation:"scan 5s linear infinite" }} />
      </div>

      {/* ── HEADER ── */}
      <header style={{ padding:"10px 18px", borderBottom:"1px solid var(--brd)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(6,6,11,.94)", backdropFilter:"blur(16px)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:18 }}>⚡</span>
          <div>
            <h1 className="mono" style={{ fontSize:14, fontWeight:700, background:"linear-gradient(135deg,#ff2d55,#ff6b35)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>CONSORS DISRUPTOR</h1>
            <div className="mono" style={{ fontSize:8, color:"var(--mut)", letterSpacing:".1em" }}>100% KOSTENLOS · YAHOO FINANCE · KEINE API-KOSTEN</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:3, background:"#30d15810", border:"1px solid #30d15818" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--grn)", animation:"blink 1.5s infinite", display:"inline-block" }} />
            <span className="mono" style={{ fontSize:8, color:"var(--grn)" }}>FREE</span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:"var(--mut)", cursor:"pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} style={{ accentColor:"var(--grn)" }} />
            Auto-Refresh
          </label>
          <span className="mono" style={{ fontSize:10, color:"var(--mut)" }}>{clock.toLocaleTimeString("de-DE")}</span>
          {alerts.length > 0 && <span className="mono" style={{ fontSize:9, color:"var(--red)" }}>🔔 {alerts.length}</span>}
        </div>
      </header>

      {/* ── TABS ── */}
      <nav style={{ display:"flex", borderBottom:"1px solid var(--brd)", background:"rgba(6,6,11,.5)", padding:"0 18px", overflowX:"auto" }}>
        {[
          { id:"dashboard", l:"Dashboard", e:"📊" },
          { id:"scan", l:"Scanner", e:"🔍" },
          { id:"trades", l:"Trade-Ideen", e:"🎯", c:tradeIdeas.length },
          { id:"products", l:"Produkte", e:"🏦", c:Object.keys(products).length },
          { id:"news", l:"News", e:"📰", c:news.length },
          { id:"alerts", l:"Alerts", e:"🔔", c:alerts.length },
          { id:"howto", l:"Anleitung", e:"📋" },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "news" && !news.length) fetchNews(); }}
            style={{ padding:"9px 13px", background:"none", border:"none", borderBottom:tab === t.id ? "2px solid var(--red)" : "2px solid transparent",
              color:tab === t.id ? "var(--txt)" : "var(--mut)", fontSize:10, fontWeight:600, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
            {t.e} {t.l}
            {t.c > 0 && <span className="mono" style={{ fontSize:8, padding:"1px 4px", borderRadius:3, background:"#ff2d5518", color:"var(--red)" }}>{t.c}</span>}
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <main style={{ padding:18, maxWidth:920, margin:"0 auto", paddingBottom:60 }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "dashboard" && (
          <div className="fade">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:300 }}>Dashboard</h2>
                <p style={{ fontSize:11, color:"var(--mut)" }}>Yahoo Finance Echtzeit-Daten · Kein API-Key nötig</p>
              </div>
              <button onClick={runFullScan} disabled={scanRunning}
                style={{ padding:"8px 18px", background:scanRunning ? "#33333a" : "linear-gradient(135deg,#ff2d55,#ff6b35)",
                  border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, fontFamily:"var(--m)", opacity:scanRunning ? .6 : 1 }}>
                {scanRunning ? "⏳ LÄUFT..." : "🚀 VOLLSCAN"}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:18 }}>
              {[
                { l:"AKTIEN", v:allStocks.length, c:"var(--blu)" },
                { l:"SHORT-SIGNALE", v:shortCount, c:"var(--red)" },
                { l:"TRADE-IDEEN", v:tradeIdeas.length, c:"var(--org)" },
                { l:"ALERTS", v:alerts.length, c:"var(--yl)" },
              ].map((c,i) => (
                <div key={i} className="card fade" style={{ animationDelay:`${i*.05}s` }}>
                  <div className="mono" style={{ fontSize:8, letterSpacing:".1em", color:"var(--mut)", marginBottom:5 }}>{c.l}</div>
                  <div className="mono" style={{ fontSize:24, fontWeight:700, color:c.c }}>{c.v}</div>
                </div>
              ))}
            </div>

            {/* Sector buttons */}
            <div className="mono" style={{ fontSize:8, letterSpacing:".1em", color:"var(--mut)", marginBottom:8 }}>SEKTOREN</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginBottom:18 }}>
              {SECTORS.map((sec,i) => {
                const avg = sec.tickers.map(t => prices[t]?.change).filter(c => c !== undefined);
                const avgCh = avg.length ? avg.reduce((a,b) => a+b, 0) / avg.length : null;
                return (
                  <button key={sec.id} onClick={() => scanSector(sec)} disabled={scanRunning}
                    className="card fade" style={{ border:"1px solid var(--brd)", textAlign:"center", cursor:"pointer",
                      opacity:scanRunning ? .5 : 1, animationDelay:`${i*.04}s`, color:"var(--txt)" }}>
                    <div style={{ fontSize:18, marginBottom:3 }}>{sec.icon}</div>
                    <div style={{ fontSize:9, fontWeight:600, marginBottom:2 }}>{sec.name}</div>
                    {avgCh !== null && <div className="mono" style={{ fontSize:10, fontWeight:700, color:avgCh < 0 ? "var(--red)" : "var(--grn)" }}>{pct(avgCh)}</div>}
                    {loading[sec.id] && <div style={{ fontSize:8, color:"var(--org)", marginTop:2 }}>⏳</div>}
                  </button>
                );
              })}
            </div>

            {/* Stock list */}
            {allStocks.length > 0 && (
              <>
                <div className="mono" style={{ fontSize:8, letterSpacing:".1em", color:"var(--mut)", marginBottom:8 }}>ALLE AKTIEN</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {allStocks.map((s,i) => (
                    <div key={s.ticker} className="fade" style={{
                      display:"flex", alignItems:"center", gap:10, padding:"7px 11px",
                      background:"var(--card)", borderRadius:6,
                      borderLeft:`2px solid ${s.change < -5 ? "var(--red)" : s.change < -2 ? "var(--org)" : s.change < 0 ? "var(--yl)" : "var(--grn)"}`,
                      animationDelay:`${i*.025}s`,
                    }}>
                      <span className="mono" style={{ fontSize:11, fontWeight:700, minWidth:40, color:s.change < -5 ? "var(--red)" : "var(--txt)" }}>{s.ticker}</span>
                      <MiniChart data={history[s.ticker] || s.history || [s.price]} />
                      <span style={{ flex:1 }} />
                      <span className="mono" style={{ fontSize:11 }}>{s.currency === "EUR" ? "€" : "$"}{fmt(s.price)}</span>
                      <span className="mono" style={{ fontSize:10, fontWeight:700, minWidth:50, textAlign:"right", color:s.change < 0 ? "var(--red)" : "var(--grn)" }}>{pct(s.change)}</span>
                      {signals[s.ticker] && (
                        <span className="badge" style={{ background:`${signals[s.ticker].signal === "SHORT" ? "var(--red)" : "var(--org)"}18`, color:signals[s.ticker].signal === "SHORT" ? "var(--red)" : "var(--org)" }}>
                          {signals[s.ticker].signal}
                        </span>
                      )}
                      {products[s.ticker] && <span style={{ fontSize:9, color:"var(--blu)" }}>🏦</span>}
                      <span className="mono" style={{ fontSize:8, color:"var(--mut)" }}>{s.exchange}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ SCANNER ═══ */}
        {tab === "scan" && (
          <div className="fade">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:300 }}>Markt-Scanner</h2>
              <button onClick={runFullScan} disabled={scanRunning}
                style={{ padding:"8px 18px", background:scanRunning ? "#33333a" : "linear-gradient(135deg,#ff2d55,#ff6b35)",
                  border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, fontFamily:"var(--m)" }}>
                {scanRunning ? "⏳ LÄUFT..." : "🚀 VOLLSCAN"}
              </button>
            </div>
            <p style={{ color:"var(--mut)", fontSize:11, marginBottom:14, lineHeight:1.6 }}>
              Scannt alle 5 Sektoren: Kurse von Yahoo Finance → Short-Kandidaten → Consorsbank-Produkte → Signale. Komplett kostenlos.
            </p>
            <div className="card mono" style={{ fontSize:10, maxHeight:500, overflowY:"auto" }}>
              {scanLog.length === 0 ? (
                <div style={{ color:"var(--mut)", textAlign:"center", padding:30 }}>Klicke VOLLSCAN zum Starten</div>
              ) : scanLog.map((l,i) => (
                <div key={i} style={{ padding:"3px 0", color:l.msg.startsWith("✅") ? "var(--grn)" : l.msg.startsWith("🔴") ? "var(--red)" : l.msg.includes("━") ? "var(--mut)" : "var(--txt)" }}>
                  <span style={{ color:"var(--mut)", marginRight:8 }}>{l.time.toLocaleTimeString("de-DE")}</span>{l.msg}
                </div>
              ))}
              {scanRunning && <div style={{ marginTop:8, color:"var(--org)" }}><span style={{ width:6, height:6, borderRadius:"50%", background:"var(--org)", animation:"blink 1s infinite", display:"inline-block", marginRight:6 }} />Scan aktiv...</div>}
            </div>
          </div>
        )}

        {/* ═══ TRADE IDEAS ═══ */}
        {tab === "trades" && (
          <div className="fade">
            <h2 style={{ fontSize:18, fontWeight:300, marginBottom:4 }}>Trade-Ideen</h2>
            <p style={{ color:"var(--mut)", fontSize:11, marginBottom:16 }}>Automatisch generiert — WKN in Consorsbank-App suchen zum Kaufen</p>
            {tradeIdeas.length === 0 ? (
              <div className="card" style={{ textAlign:"center", padding:40, color:"var(--mut)", fontSize:11 }}>
                🔍 Starte einen Vollscan um Trade-Ideen zu generieren
              </div>
            ) : tradeIdeas.map((idea,i) => (
              <div key={idea.id} className={`card fade ${idea.confidence >= 8 ? "card-glow" : ""}`} style={{ marginBottom:10, animationDelay:`${i*.05}s` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span className="mono" style={{ fontSize:18, fontWeight:700 }}>{idea.ticker}</span>
                    <span className="badge" style={{ background:"#ff2d5518", color:"var(--red)" }}>SHORT</span>
                    <span className="badge" style={{ background:`${idea.confidence >= 8 ? "var(--red)" : "var(--org)"}18`, color:idea.confidence >= 8 ? "var(--red)" : "var(--org)" }}>{idea.confidence}/10</span>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div className="mono" style={{ fontSize:16, fontWeight:700 }}>${fmt(idea.price)}</div>
                    <div className="mono" style={{ fontSize:11, color:"var(--red)" }}>{pct(idea.change)}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
                  {[
                    { l:"PRODUKT", v:idea.product, c:"var(--blu)" },
                    { l:"EINSTIEG", v:idea.entry, c:"var(--txt)" },
                    { l:"STOP-LOSS", v:`$${idea.stopLoss}`, c:"var(--red)" },
                    { l:"KURSZIEL", v:`$${idea.target}`, c:"var(--grn)" },
                  ].map((f,j) => (
                    <div key={j} style={{ padding:"6px 8px", background:"rgba(255,255,255,.02)", borderRadius:4 }}>
                      <div className="mono" style={{ fontSize:8, color:"var(--mut)", letterSpacing:".08em" }}>{f.l}</div>
                      <div style={{ fontSize:10, fontWeight:600, color:f.c, marginTop:2, lineHeight:1.4 }}>{f.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:"var(--mut)", lineHeight:1.5, padding:"8px 10px", background:"rgba(255,255,255,.015)", borderRadius:5, borderLeft:"2px solid var(--org)" }}>
                  {idea.reasons?.join(" · ")}
                </div>
                <div className="mono" style={{ fontSize:8, color:"var(--mut)", marginTop:8 }}>
                  ⚠️ Risiko: {idea.risk} · Score: {idea.score}/100
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ PRODUCTS ═══ */}
        {tab === "products" && (
          <div className="fade">
            <h2 style={{ fontSize:18, fontWeight:300, marginBottom:4 }}>Consorsbank Produkte</h2>
            <p style={{ color:"var(--mut)", fontSize:11, marginBottom:16 }}>KO-Zertifikate & Put-Optionsscheine — WKN in Consorsbank suchen</p>
            {Object.keys(products).length === 0 ? (
              <div className="card" style={{ textAlign:"center", padding:40, color:"var(--mut)", fontSize:11 }}>🏦 Starte einen Scan — Produkte werden automatisch gesucht</div>
            ) : Object.entries(products).map(([ticker, data]) => (
              <div key={ticker} style={{ marginBottom:16 }} className="fade">
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span className="mono" style={{ fontSize:14, fontWeight:700 }}>{ticker}</span>
                  {prices[ticker] && <span className="mono" style={{ fontSize:11, color:"var(--mut)" }}>${fmt(prices[ticker].price)}</span>}
                </div>
                {data.items.map((p,i) => (
                  <div key={i} className="card fade" style={{ padding:10, marginBottom:4, animationDelay:`${i*.03}s` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span className="badge" style={{ background:`${p.type.includes("KO") ? "var(--red)" : "var(--org)"}18`, color:p.type.includes("KO") ? "var(--red)" : "var(--org)" }}>{p.type}</span>
                      <span className="mono" style={{ fontSize:12, fontWeight:700, color:"var(--blu)" }}>{p.wkn}</span>
                      <span style={{ fontSize:10, color:"var(--mut)" }}>{p.emittent}</span>
                      <span style={{ flex:1 }} />
                      <span className="mono" style={{ fontSize:9, color:"var(--mut)" }}>Strike: {p.strike}</span>
                      <span className="mono" style={{ fontSize:9, color:"var(--org)" }}>Hebel: {p.hebel}x</span>
                      <span className="mono" style={{ fontSize:9 }}>Bid/Ask: {p.bid}/{p.ask}</span>
                      <span style={{ fontSize:8, color:"var(--mut)" }}>{p.laufzeit}</span>
                      {p.isExample && <span className="mono" style={{ fontSize:7, color:"var(--yl)" }}>BEISPIEL</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ═══ NEWS ═══ */}
        {tab === "news" && (
          <div className="fade">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:300 }}>Disruption News</h2>
              <button onClick={fetchNews} style={{ padding:"6px 12px", background:"#0a84ff15", border:"1px solid #0a84ff25", borderRadius:5, color:"var(--blu)", fontSize:10, fontFamily:"var(--m)" }}>🔄 REFRESH</button>
            </div>
            {news.length === 0 ? (
              <div className="card" style={{ textAlign:"center", padding:40, color:"var(--mut)", fontSize:11 }}>Klicke REFRESH zum Laden</div>
            ) : news.map((n,i) => (
              <div key={i} className="card fade" style={{ marginBottom:6, animationDelay:`${i*.04}s` }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:500, lineHeight:1.4, marginBottom:3 }}>{n.headline}</div>
                    <div style={{ fontSize:9, color:"var(--mut)" }}>{n.source} {n.sector && `· ${n.sector}`}</div>
                  </div>
                  <span className="badge" style={{ background:`${n.impact === "BEARISH" ? "var(--red)" : n.impact === "BULLISH" ? "var(--grn)" : "var(--org)"}18`, color:n.impact === "BEARISH" ? "var(--red)" : n.impact === "BULLISH" ? "var(--grn)" : "var(--org)", flexShrink:0 }}>{n.impact}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ALERTS ═══ */}
        {tab === "alerts" && (
          <div className="fade">
            <h2 style={{ fontSize:18, fontWeight:300, marginBottom:16 }}>Alerts</h2>
            {alerts.length === 0 ? (
              <div className="card" style={{ textAlign:"center", padding:40, color:"var(--mut)", fontSize:11 }}>Noch keine Alerts — starte einen Scan</div>
            ) : alerts.map((a,i) => (
              <div key={a.id} className="fade" style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 11px",
                background:"var(--card)", borderRadius:5, marginBottom:3,
                borderLeft:`2px solid ${a.type === "TRADE" ? "var(--red)" : "var(--org)"}`,
                animationDelay:`${i*.03}s`,
              }}>
                <span className="mono" style={{ fontSize:10, color:"var(--mut)", minWidth:65 }}>{a.time.toLocaleTimeString("de-DE")}</span>
                <span style={{ fontSize:10 }}>{a.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ HOW-TO ═══ */}
        {tab === "howto" && (
          <div className="fade">
            <h2 style={{ fontSize:18, fontWeight:300, marginBottom:16 }}>So funktioniert's</h2>
            {[
              { t:"1. Vollscan starten", d:"Klicke '🚀 VOLLSCAN' — das System holt Echtzeit-Kurse von Yahoo Finance (kostenlos) für alle 5 Sektoren.", e:"📊" },
              { t:"2. Short-Kandidaten", d:"Aktien mit > 2% Verlust werden automatisch als Short-Kandidaten markiert. Je stärker der Rückgang und je höher die KI-Disruptions-Gefahr, desto stärker das Signal.", e:"📉" },
              { t:"3. Produkte finden", d:"Für jeden Kandidaten sucht das System Knock-Out-Puts und Put-Optionsscheine, die bei der Consorsbank handelbar sind.", e:"🏦" },
              { t:"4. Trade-Ideen prüfen", d:"Im Tab 'Trade-Ideen' findest du fertige Vorschläge mit Einstieg, Stop-Loss und Kursziel. Produkte mit WKN zum direkten Suchen.", e:"🎯" },
              { t:"5. In Consorsbank kaufen", d:"Öffne die Consorsbank-App → Suche → WKN eingeben → Kaufen. Immer Stop-Loss setzen!", e:"✅" },
              { t:"Kosten", d:"0 EUR. Yahoo Finance ist kostenlos, die Signal-Logik läuft lokal, Vercel Hobby-Plan ist gratis. Keine API-Keys, keine versteckten Kosten.", e:"💚" },
            ].map((step,i) => (
              <div key={i} className="card fade" style={{ marginBottom:8, animationDelay:`${i*.05}s`, display:"flex", gap:12 }}>
                <span style={{ fontSize:22 }}>{step.e}</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:12, marginBottom:3 }}>{step.t}</div>
                  <div style={{ fontSize:11, color:"var(--mut)", lineHeight:1.5 }}>{step.d}</div>
                </div>
              </div>
            ))}

            <div className="card" style={{ marginTop:16, borderColor:"#ff2d5530" }}>
              <div style={{ fontSize:11, color:"var(--red)", fontWeight:600, marginBottom:6 }}>⚠️ Wichtige Hinweise</div>
              <div style={{ fontSize:10, color:"var(--mut)", lineHeight:1.6 }}>
                • Keine Anlageberatung — nur Informationszwecke<br/>
                • Short-Zertifikate können wertlos verfallen<br/>
                • Immer Stop-Loss setzen, nie mehr als 2% pro Trade riskieren<br/>
                • Beispiel-WKNs müssen vor Kauf in Consorsbank verifiziert werden<br/>
                • Max. 5-10% deines Portfolios für spekulative Trades
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"5px 18px", background:"rgba(6,6,11,.96)", borderTop:"1px solid var(--brd)", fontSize:8, color:"#3a3a4a", textAlign:"center", fontFamily:"var(--m)", zIndex:50 }}>
        ⚡ 100% kostenlos · Yahoo Finance · Keine API-Kosten · ⚠️ Keine Anlageberatung
      </div>
    </>
  );
}

// ── Mini Chart Component ──
function MiniChart({ data = [], w = 90, h = 22 }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-((v-mn)/rg)*h}`).join(" ");
  const c = data[data.length-1] >= data[0] ? "#30d158" : "#ff2d55";
  return <svg width={w} height={h} style={{ display:"block", flexShrink:0 }}><polyline points={pts} fill="none" stroke={c} strokeWidth="1.5" /><circle cx={w} cy={h-((data[data.length-1]-mn)/rg)*h} r="2" fill={c} /></svg>;
}
