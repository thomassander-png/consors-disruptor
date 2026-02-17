import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

const SECTORS = [
  { id:"sw", name:"Enterprise Software", icon:"⚙️", tickers:["SAP","ORCL","CRM","WDAY"] },
  { id:"fd", name:"Finanzdaten & Ratings", icon:"📊", tickers:["FDS","MCO","SPGI","NDAQ"] },
  { id:"fa", name:"Finanzberatung", icon:"🏦", tickers:["SCHW","LPLA","AMP","RJF"] },
  { id:"co", name:"IT-Beratung", icon:"💼", tickers:["ACN","EPAM","IT","GLOB"] },
  { id:"ed", name:"Bildung", icon:"🎓", tickers:["CHGG","DUOL","COUR"] },
  { id:"ph", name:"Pharma & Biotech", icon:"💊", tickers:["PFE","JNJ","MRNA","ABBV"] },
  { id:"re", name:"Immobilien", icon:"🏠", tickers:["SPG","AMT","O","PLD"] },
  { id:"en", name:"Energie", icon:"⚡", tickers:["XOM","CVX","NEE","ENPH"] },
  { id:"au", name:"Automobil", icon:"🚗", tickers:["TSLA","TM","F"] },
  { id:"me", name:"Medien & Werbung", icon:"🎬", tickers:["DIS","NFLX","PARA","WBD"] },
  { id:"in", name:"Versicherung", icon:"🛡️", tickers:["ALL","MET","PRU"] },
  { id:"rt", name:"Einzelhandel", icon:"🛒", tickers:["AMZN","WMT","TGT","BABA"] },
];

const M = "'IBM Plex Mono',monospace";
const fmt = (n,d=2) => typeof n==="number" ? n.toFixed(d) : "—";
const pct = n => typeof n==="number" ? `${n>0?"+":""}${n.toFixed(1)}%` : "—";
const fmtVol = n => { if(!n||typeof n!=="number") return "—"; if(n>=1e9) return `${(n/1e9).toFixed(1)}B`; if(n>=1e6) return `${(n/1e6).toFixed(1)}M`; if(n>=1e3) return `${(n/1e3).toFixed(0)}K`; return n.toString(); };
const fmtMcap = n => { if(!n||typeof n!=="number") return "—"; if(n>=1e12) return `$${(n/1e12).toFixed(1)}T`; if(n>=1e9) return `$${(n/1e9).toFixed(1)}B`; if(n>=1e6) return `$${(n/1e6).toFixed(0)}M`; return `$${n}`; };

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [prices, setPrices] = useState({});
  const [signals, setSignals] = useState({});
  const [products, setProducts] = useState({});
  const [news, setNews] = useState([]);
  const [tradeIdeas, setTradeIdeas] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState({});
  const [history, setHistory] = useState({});
  const [scanLog, setScanLog] = useState([]);
  const [scanRunning, setScanRunning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [email, setEmail] = useState("");
  const [emailCfg, setEmailCfg] = useState({ service:"", template:"", key:"" });
  const [filter, setFilter] = useState("ALL"); // ALL, SHORT, KAUFEN, WATCH
  const [expandedTicker, setExpandedTicker] = useState(null);

  // Load saved settings on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("consors_settings") || "{}");
      if (saved.email) setEmail(saved.email);
      if (saved.emailCfg) setEmailCfg(saved.emailCfg);
    } catch {}
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    try {
      if (email || emailCfg.service) {
        window.localStorage.setItem("consors_settings", JSON.stringify({ email, emailCfg }));
      }
    } catch {}
  }, [email, emailCfg]);

  useEffect(() => { const t=setInterval(()=>setClock(new Date()),1000); return ()=>clearInterval(t); }, []);

  const fetchPrices = useCallback(async (tickers) => {
    try {
      const r = await fetch(`/api/stocks?tickers=${tickers.join(",")}`);
      const d = await r.json(); const m = {};
      for (const s of d.stocks||[]) { if(!s.error) { m[s.ticker]=s; setHistory(p=>({...p,[s.ticker]:[...(p[s.ticker]||[]).slice(-29),s.price]})); } }
      setPrices(p=>({...p,...m})); return m;
    } catch { return {}; }
  }, []);

  const fetchSignal = useCallback(async (ticker,price,change,sector,high52,low52) => {
    try {
      const hist = (history[ticker] || []).join(",");
      const r = await fetch(`/api/signal?ticker=${ticker}&price=${price}&change=${change}&sector=${encodeURIComponent(sector)}&week_high=${high52||""}&week_low=${low52||""}&history=${hist}`);
      const sig = await r.json();
      setSignals(p=>({...p,[ticker]:sig}));
      if ((sig.signal==="SHORT"||sig.signal==="KAUFEN") && sig.confidence>=6) {
        setTradeIdeas(p => { if(p.find(t=>t.ticker===ticker)) return p; return [{...sig,id:Date.now(),sectorName:sector},...p]; });
        const a = { id:Date.now(), type:sig.signal, msg:`${sig.signal==="SHORT"?"🔴":"🟢"} ${sig.signal}: ${ticker} @ $${price} (${pct(change)}) — Konfidenz ${sig.confidence}/10`, time:new Date() };
        setAlerts(p=>[a,...p.slice(0,39)]);
        if (email) sendAlert(sig);
      }
      return sig;
    } catch { return null; }
  }, [email]);

  const fetchProducts = useCallback(async (ticker,price) => {
    try { const r=await fetch(`/api/products?ticker=${ticker}&price=${price}`); const d=await r.json(); setProducts(p=>({...p,[ticker]:{items:d.products||[],time:new Date()}})); } catch {}
  }, []);

  const fetchNews = useCallback(async () => {
    try { const r=await fetch("/api/news"); const d=await r.json(); if(d.news?.length) setNews(d.news); } catch {}
  }, []);

  const sendAlert = async (sig) => {
    try {
      await fetch("/api/alert", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email, ...sig, emailjs_service:emailCfg.service, emailjs_template:emailCfg.template, emailjs_key:emailCfg.key }) });
    } catch {}
  };

  const scanSector = useCallback(async (sector) => {
    const log = m => setScanLog(p=>[...p,{msg:m,time:new Date()}]);
    log(`🔍 ${sector.name}: Lade Kurse...`);
    setLoading(p=>({...p,[sector.id]:true}));
    const data = await fetchPrices(sector.tickers);
    const loaded = Object.keys(data);
    log(`✅ ${loaded.length} Kurse geladen`);
    const candidates = loaded.filter(t => data[t].change < -2 || data[t].fromHigh < -20);
    if (candidates.length > 0) {
      log(`📉 ${candidates.length} Kandidaten: ${candidates.join(", ")}`);
      for (const t of candidates.slice(0,4)) {
        log(`  🤖 Analysiere ${t}...`);
        await fetchSignal(t, data[t].price, data[t].change, sector.name, data[t].high52, data[t].low52);
        await fetchProducts(t, data[t].price);
      }
    } else { log(`ℹ️ Keine Kandidaten in ${sector.name}`); }
    setLoading(p=>({...p,[sector.id]:false}));
    log(`✅ ${sector.name} fertig`);
  }, [fetchPrices, fetchSignal, fetchProducts]);

  const runFullScan = useCallback(async () => {
    setScanRunning(true); setScanLog([]);
    const log = m => setScanLog(p=>[...p,{msg:m,time:new Date()}]);
    log("🚀 VOLLSCAN — 12 SEKTOREN"); log("━".repeat(35));
    log("📰 News laden..."); await fetchNews(); log("✅ News geladen");
    for (const s of SECTORS) { log(""); await scanSector(s); }
    log(""); log("━".repeat(35)); log("✅ VOLLSCAN ABGESCHLOSSEN");
    setScanRunning(false);
  }, [scanSector, fetchNews]);

  // Auto-scan on first load
  const hasAutoScanned = useRef(false);
  useEffect(() => {
    if (!hasAutoScanned.current) {
      hasAutoScanned.current = true;
      setTimeout(() => runFullScan(), 2000);
    }
  }, [runFullScan]);

  // Auto-scan every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!scanRunning) runFullScan();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [runFullScan, scanRunning]);

  const allStocks = Object.entries(prices).map(([t,d])=>({ticker:t,...d})).sort((a,b)=>a.change-b.change);
  const shortCount = allStocks.filter(s=>s.change<-3).length;
  const dipCount = Object.values(signals).filter(s=>s.signal==="KAUFEN").length;
  const filteredIdeas = filter==="ALL" ? tradeIdeas : tradeIdeas.filter(i=> filter==="SHORT"?i.strategy==="short": filter==="KAUFEN"?i.strategy==="dip":true);

  return (<>
    <Head><title>Consors Disruptor V2</title><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet"/></Head>
    <style jsx global>{`
      :root{--bg:#06060b;--card:#0d0d18;--brd:rgba(255,255,255,.05);--txt:#e2e2ec;--mut:#5f5f78;--red:#ff2d55;--grn:#30d158;--org:#ff9500;--blu:#0a84ff;--yl:#ffd60a;--pur:#bf5af2}
      *{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--txt);font-family:'Outfit',sans-serif}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes glow{0%,100%{box-shadow:0 0 12px #ff2d5510}50%{box-shadow:0 0 28px #ff2d5525}}
      @keyframes glowGreen{0%,100%{box-shadow:0 0 12px #30d15810}50%{box-shadow:0 0 28px #30d15825}}
      .fade{animation:fadeUp .3s ease both}.card{background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:14px;transition:all .2s}
      .badge{padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;font-family:${M};letter-spacing:.03em;display:inline-block}
      button{font-family:'Outfit',sans-serif;cursor:pointer}.mono{font-family:${M}}
      .shimmer{background:linear-gradient(90deg,#0d0d18 25%,#181830 50%,#0d0d18 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px;height:60px}
    `}</style>

    {/* HEADER */}
    <header style={{padding:"10px 18px",borderBottom:"1px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(6,6,11,.94)",backdropFilter:"blur(16px)",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:18}}>⚡</span>
        <div>
          <h1 className="mono" style={{fontSize:14,fontWeight:700,background:"linear-gradient(135deg,#ff2d55,#ff6b35)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CONSORS DISRUPTOR V2</h1>
          <div className="mono" style={{fontSize:7,color:"var(--mut)",letterSpacing:".1em"}}>12 SEKTOREN · DUAL-STRATEGIE · 100% KOSTENLOS</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:3,background:"#30d15810",border:"1px solid #30d15818"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"var(--grn)",animation:"blink 1.5s infinite",display:"inline-block"}}/><span className="mono" style={{fontSize:8,color:"var(--grn)"}}>FREE</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span className="mono" style={{fontSize:10,color:"var(--mut)"}}>{clock.toLocaleTimeString("de-DE")}</span>
        {alerts.length>0&&<span className="mono" style={{fontSize:9,color:"var(--red)"}}>🔔{alerts.length}</span>}
      </div>
    </header>

    {/* TABS */}
    <nav style={{display:"flex",borderBottom:"1px solid var(--brd)",background:"rgba(6,6,11,.5)",padding:"0 14px",overflowX:"auto",gap:0}}>
      {[{id:"dashboard",l:"Dashboard",e:"📊"},{id:"scan",l:"Scanner",e:"🔍"},{id:"trades",l:"Trade-Ideen",e:"🎯",c:tradeIdeas.length},{id:"products",l:"Produkte",e:"🏦",c:Object.keys(products).length},{id:"news",l:"News",e:"📰",c:news.length},{id:"alerts",l:"Alerts",e:"🔔",c:alerts.length},{id:"settings",l:"Einstellungen",e:"⚙️"}].map(t=>(
        <button key={t.id} onClick={()=>{setTab(t.id);if(t.id==="news"&&!news.length)fetchNews();}} style={{padding:"8px 12px",background:"none",border:"none",borderBottom:tab===t.id?"2px solid var(--red)":"2px solid transparent",color:tab===t.id?"var(--txt)":"var(--mut)",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
          {t.e} {t.l}{t.c>0&&<span className="mono" style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:"#ff2d5518",color:"var(--red)"}}>{t.c}</span>}
        </button>
      ))}
    </nav>

    <main style={{padding:18,maxWidth:960,margin:"0 auto",paddingBottom:60}}>

      {/* ═══ DASHBOARD ═══ */}
      {tab==="dashboard"&&(<div className="fade">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><h2 style={{fontSize:18,fontWeight:300}}>Dashboard</h2><p style={{fontSize:11,color:"var(--mut)"}}>12 Branchen · Short + Buy-the-Dip · Yahoo Finance Live</p></div>
          <button onClick={runFullScan} disabled={scanRunning} style={{padding:"8px 18px",background:scanRunning?"#33333a":"linear-gradient(135deg,#ff2d55,#ff6b35)",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,fontFamily:M}}>{scanRunning?"⏳ LÄUFT...":"🚀 VOLLSCAN"}</button>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:16}}>
          {[{l:"AKTIEN",v:allStocks.length,c:"var(--blu)"},{l:"SHORT",v:shortCount,c:"var(--red)"},{l:"BUY DIP",v:dipCount,c:"var(--grn)"},{l:"IDEEN",v:tradeIdeas.length,c:"var(--org)"},{l:"ALERTS",v:alerts.length,c:"var(--yl)"}].map((c,i)=>(
            <div key={i} className="card fade" style={{animationDelay:`${i*.04}s`}}>
              <div className="mono" style={{fontSize:7,letterSpacing:".1em",color:"var(--mut)",marginBottom:4}}>{c.l}</div>
              <div className="mono" style={{fontSize:22,fontWeight:700,color:c.c}}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* Sectors Grid */}
        <div className="mono" style={{fontSize:8,letterSpacing:".1em",color:"var(--mut)",marginBottom:6}}>12 SEKTOREN</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:16}}>
          {SECTORS.map((sec,i)=>{
            const avg=sec.tickers.map(t=>prices[t]?.change).filter(c=>c!==undefined);
            const avgCh=avg.length?avg.reduce((a,b)=>a+b,0)/avg.length:null;
            return(<button key={sec.id} onClick={()=>scanSector(sec)} disabled={scanRunning} className="card fade" style={{border:"1px solid var(--brd)",textAlign:"center",cursor:"pointer",opacity:scanRunning?.5:1,animationDelay:`${i*.03}s`,color:"var(--txt)",padding:10}}>
              <div style={{fontSize:16,marginBottom:2}}>{sec.icon}</div>
              <div style={{fontSize:8,fontWeight:600,marginBottom:2}}>{sec.name}</div>
              {avgCh!==null&&<div className="mono" style={{fontSize:10,fontWeight:700,color:avgCh<0?"var(--red)":"var(--grn)"}}>{pct(avgCh)}</div>}
              {loading[sec.id]&&<div style={{fontSize:7,color:"var(--org)",marginTop:2}}>⏳</div>}
            </button>);
          })}
        </div>

        {/* Stock List */}
        {allStocks.length>0&&(<>
          <div className="mono" style={{fontSize:8,letterSpacing:".1em",color:"var(--mut)",marginBottom:6}}>ALLE AKTIEN ({allStocks.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {allStocks.map((s,i)=>{
              const sig=signals[s.ticker];
              const sigColor=sig?.signal==="SHORT"?"var(--red)":sig?.signal==="KAUFEN"?"var(--grn)":sig?.signal?.includes("WATCH")?"var(--org)":"var(--mut)";
              const isExpanded=expandedTicker===s.ticker;
              return(<div key={s.ticker} className="fade" style={{animationDelay:`${i*.02}s`}}>
                <div onClick={()=>setExpandedTicker(isExpanded?null:s.ticker)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--card)",borderRadius:isExpanded?"6px 6px 0 0":"6px",borderLeft:`2px solid ${s.change<-5?"var(--red)":s.change<-2?"var(--org)":s.change<0?"var(--yl)":"var(--grn)"}`,fontSize:11,cursor:"pointer"}}>
                  <span className="mono" style={{fontWeight:700,minWidth:40,color:s.change<-5?"var(--red)":"var(--txt)"}}>{s.ticker}</span>
                  <MiniChart data={history[s.ticker]||s.history||[s.price]}/>
                  <span style={{fontSize:9,color:"var(--mut)",flex:1}}>{s.name?.slice(0,20)}</span>
                  {s.pe&&<span className="mono" style={{fontSize:8,color:"var(--pur)"}}>KGV {typeof s.pe==="number"?s.pe.toFixed(1):s.pe}</span>}
                  {s.volume&&<span className="mono" style={{fontSize:8,color:"var(--mut)"}}>Vol {fmtVol(s.volume)}</span>}
                  <span className="mono" style={{fontSize:11}}>{s.currency==="EUR"?"€":"$"}{fmt(s.price)}</span>
                  <span className="mono" style={{fontSize:10,fontWeight:700,minWidth:48,textAlign:"right",color:s.change<0?"var(--red)":"var(--grn)"}}>{pct(s.change)}</span>
                  {s.fromHigh&&<span className="mono" style={{fontSize:8,color:"var(--mut)",minWidth:40}}>{s.fromHigh.toFixed(0)}%vH</span>}
                  {sig&&<span className="badge" style={{background:`${sigColor}18`,color:sigColor,fontSize:8}}>{sig.signal}</span>}
                  <span style={{fontSize:8,color:"var(--mut)"}}>{isExpanded?"▲":"▼"}</span>
                </div>
                {isExpanded&&(
                  <div style={{background:"var(--card)",borderRadius:"0 0 6px 6px",borderLeft:`2px solid ${s.change<-5?"var(--red)":"var(--brd)"}`,borderTop:"1px solid var(--brd)",padding:12}}>
                    {/* TradingView Chart */}
                    <div style={{marginBottom:10,borderRadius:6,overflow:"hidden",height:300,background:"#131722"}}>
                      <iframe src={`https://s.tradingview.com/widgetembed/?symbol=${s.ticker}&interval=D&theme=dark&style=1&locale=de&hide_top_toolbar=0&hide_side_toolbar=1&allow_symbol_change=1&save_image=0&withdateranges=1&height=300&width=100%25`} style={{width:"100%",height:300,border:"none"}} />
                    </div>
                    {/* Fundamentals Grid */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:8}}>
                      {[
                        {l:"KGV (P/E)",v:s.pe?typeof s.pe==="number"?s.pe.toFixed(1):s.pe:"—",c:s.pe&&s.pe<15?"var(--grn)":s.pe&&s.pe>35?"var(--red)":"var(--txt)"},
                        {l:"Forward KGV",v:s.forwardPe?typeof s.forwardPe==="number"?s.forwardPe.toFixed(1):s.forwardPe:"—",c:"var(--txt)"},
                        {l:"EPS",v:s.eps?`$${typeof s.eps==="number"?s.eps.toFixed(2):s.eps}`:"—",c:"var(--txt)"},
                        {l:"Marktkapitalisierung",v:s.marketCap?fmtMcap(s.marketCap):"—",c:"var(--blu)"},
                        {l:"Volumen",v:s.volume?fmtVol(s.volume):"—",c:"var(--txt)"},
                        {l:"Ø Volumen",v:s.avgVolume?fmtVol(s.avgVolume):"—",c:"var(--mut)"},
                        {l:"Dividendenrendite",v:s.dividendYield?`${(s.dividendYield*100).toFixed(1)}%`:"—",c:s.dividendYield>0.03?"var(--grn)":"var(--txt)"},
                        {l:"Beta",v:s.beta?typeof s.beta==="number"?s.beta.toFixed(2):s.beta:"—",c:"var(--txt)"},
                        {l:"Short Ratio",v:s.shortRatio||"—",c:s.shortRatio&&s.shortRatio>5?"var(--red)":"var(--txt)"},
                        {l:"Profit Margin",v:s.profitMargin?`${(s.profitMargin*100).toFixed(1)}%`:"—",c:s.profitMargin>0.15?"var(--grn)":"var(--txt)"},
                        {l:"Umsatzwachstum",v:s.revenueGrowth?`${(s.revenueGrowth*100).toFixed(1)}%`:"—",c:s.revenueGrowth>0?"var(--grn)":"var(--red)"},
                        {l:"Analysten-Rating",v:s.analystRating||"—",c:s.analystRating==="buy"||s.analystRating==="strong_buy"?"var(--grn)":s.analystRating==="sell"?"var(--red)":"var(--txt)"},
                        {l:"Kursziel Analysten",v:s.targetPrice?`$${typeof s.targetPrice==="number"?s.targetPrice.toFixed(0):s.targetPrice}`:"—",c:s.targetPrice&&s.targetPrice>s.price?"var(--grn)":"var(--red)"},
                        {l:"Nächste Earnings",v:s.nextEarnings||"—",c:"var(--yl)"},
                        {l:"52W Hoch",v:`$${fmt(s.high52)}`,c:"var(--mut)"},
                        {l:"52W Tief",v:`$${fmt(s.low52)}`,c:"var(--mut)"},
                      ].map((f,j)=>(
                        <div key={j} style={{padding:"4px 6px",background:"rgba(255,255,255,.02)",borderRadius:4}}>
                          <div className="mono" style={{fontSize:6,color:"var(--mut)",letterSpacing:".06em"}}>{f.l.toUpperCase()}</div>
                          <div className="mono" style={{fontSize:10,fontWeight:600,color:f.c,marginTop:1}}>{f.v}</div>
                        </div>
                      ))}
                    </div>
                    {s.sectorThreat&&<div style={{fontSize:9,color:"var(--org)",fontStyle:"italic"}}>⚠️ KI-Bedrohung: {sig?.sectorThreat||"—"}</div>}
                  </div>
                )}
              </div>);
            })}
          </div>
        </>)}
      </div>)}

      {/* ═══ SCANNER ═══ */}
      {tab==="scan"&&(<div className="fade">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h2 style={{fontSize:18,fontWeight:300}}>Markt-Scanner</h2>
          <button onClick={runFullScan} disabled={scanRunning} style={{padding:"8px 18px",background:scanRunning?"#33333a":"linear-gradient(135deg,#ff2d55,#ff6b35)",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,fontFamily:M}}>{scanRunning?"⏳":"🚀 VOLLSCAN"}</button>
        </div>
        <p style={{color:"var(--mut)",fontSize:11,marginBottom:12,lineHeight:1.5}}>Scannt 12 Sektoren (45+ Aktien): Kurse → Kandidaten (fallend ODER überverkauft) → Dual-Signal (Short vs. Buy-the-Dip) → Produkte</p>
        <div className="card mono" style={{fontSize:10,maxHeight:500,overflowY:"auto"}}>
          {scanLog.length===0?<div style={{color:"var(--mut)",textAlign:"center",padding:30}}>Klicke VOLLSCAN</div>:
          scanLog.map((l,i)=>(<div key={i} style={{padding:"2px 0",color:l.msg.startsWith("✅")?"var(--grn)":l.msg.startsWith("🔴")?"var(--red)":l.msg.includes("━")?"var(--mut)":"var(--txt)"}}>
            <span style={{color:"var(--mut)",marginRight:8}}>{l.time.toLocaleTimeString("de-DE")}</span>{l.msg}
          </div>))}
          {scanRunning&&<div style={{marginTop:6,color:"var(--org)"}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--org)",animation:"blink 1s infinite",display:"inline-block",marginRight:6}}/>Aktiv...</div>}
        </div>
      </div>)}

      {/* ═══ TRADE IDEAS ═══ */}
      {tab==="trades"&&(<div className="fade">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <h2 style={{fontSize:18,fontWeight:300}}>Trade-Ideen ({tradeIdeas.length})</h2>
          <div style={{display:"flex",gap:4}}>
            {["ALL","SHORT","KAUFEN"].map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:4,border:"none",fontSize:9,fontWeight:700,fontFamily:M,background:filter===f?(f==="SHORT"?"#ff2d5520":f==="KAUFEN"?"#30d15820":"#0a84ff20"):"rgba(255,255,255,.03)",color:filter===f?(f==="SHORT"?"var(--red)":f==="KAUFEN"?"var(--grn)":"var(--blu)"):"var(--mut)"}}>{f}</button>))}
          </div>
        </div>
        <p style={{color:"var(--mut)",fontSize:10,marginBottom:12}}>🔴 SHORT = auf weiteren Fall wetten · 🟢 KAUFEN = günstig einsteigen nach Überreaktion</p>

        {filteredIdeas.length===0?<div className="card" style={{textAlign:"center",padding:40,color:"var(--mut)",fontSize:11}}>Starte Vollscan für Ideen</div>:
        filteredIdeas.map((idea,i)=>{
          const isShort=idea.strategy==="short";
          const color=isShort?"var(--red)":"var(--grn)";
          const glowClass=idea.confidence>=8?(isShort?"":""):"";
          return(<div key={idea.id} className="card fade" style={{marginBottom:10,animationDelay:`${i*.05}s`,borderColor:idea.confidence>=8?`${color}40`:"var(--brd)",...(idea.confidence>=8?{boxShadow:`0 0 20px ${color}15`,animation:`${isShort?"glow":"glowGreen"} 3s ease-in-out infinite`}:{})}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="mono" style={{fontSize:18,fontWeight:700}}>{idea.ticker}</span>
                <span className="badge" style={{background:`${color}18`,color}}>{idea.signal}</span>
                <span className="badge" style={{background:`${idea.confidence>=8?color:"var(--org)"}18`,color:idea.confidence>=8?color:"var(--org)"}}>{idea.confidence}/10</span>
                <span style={{fontSize:9,color:"var(--mut)"}}>{idea.sectorName}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="mono" style={{fontSize:16,fontWeight:700}}>${fmt(idea.price)}</div>
                <div className="mono" style={{fontSize:11,color}}>{pct(idea.change)}</div>
              </div>
            </div>

            {/* Score bars */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              {[
                {l:"Short",v:idea.shortScore,c:"var(--red)"},{l:"Dip",v:idea.dipScore,c:"var(--grn)"},
                {l:"Disruption",v:idea.disruptionScore,c:"var(--org)"},{l:"Qualität",v:idea.qualityScore||50,c:"var(--blu)"},{l:"Burggraben",v:idea.moatScore||50,c:"var(--pur)"}
              ].map((b,j)=>(<div key={j} style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:7,color:"var(--mut)"}}>{b.l}</span><span className="mono" style={{fontSize:7,color:b.c}}>{b.v}</span></div>
                <div style={{height:3,background:"rgba(255,255,255,.05)",borderRadius:2}}><div style={{height:3,width:`${Math.min(b.v,100)}%`,background:b.c,borderRadius:2}}/></div>
              </div>))}
            </div>

            {/* Technical indicators */}
            <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
              {idea.rsi&&<span className="badge" style={{background:`${idea.rsi<30?"var(--grn)":idea.rsi>70?"var(--red)":"var(--mut)"}18`,color:idea.rsi<30?"var(--grn)":idea.rsi>70?"var(--red)":"var(--mut)"}}>RSI {idea.rsi}</span>}
              {idea.trend&&idea.trend!=="SEITWÄRTS"&&<span className="badge" style={{background:"rgba(255,255,255,.05)",color:"var(--mut)"}}>{idea.trend}</span>}
              {idea.riskReward&&idea.riskReward!=="—"&&<span className="badge" style={{background:"#0a84ff18",color:"var(--blu)"}}>R:R {idea.riskReward}x</span>}
              {idea.ampel&&<span style={{fontSize:12}}>{idea.ampel}</span>}
              {idea.volatility&&idea.volatility!=="NORMAL"&&<span className="badge" style={{background:"#ffd60a18",color:"var(--yl)"}}>Vol: {idea.volatility}</span>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:8}}>
              {[{l:"EINSTIEG",v:idea.entry,c:"var(--txt)"},{l:"STOP-LOSS",v:idea.stopLoss,c:"var(--red)"},{l:"ZIEL 1",v:idea.target,c:"var(--grn)"},{l:"ZIEL 2",v:idea.target2||"—",c:"var(--grn)"},{l:"RISK/REWARD",v:idea.riskReward?`${idea.riskReward}x`:"—",c:"var(--blu)"},{l:"POSITION",v:idea.positionSize||"—",c:"var(--pur)"}].map((f,j)=>(
                <div key={j} style={{padding:"5px 7px",background:"rgba(255,255,255,.02)",borderRadius:4}}>
                  <div className="mono" style={{fontSize:6,color:"var(--mut)",letterSpacing:".08em"}}>{f.l}</div>
                  <div style={{fontSize:9,fontWeight:500,color:f.c,marginTop:1,lineHeight:1.3}}>{f.v}</div>
                </div>
              ))}
            </div>

            <div style={{padding:"5px 7px",background:"rgba(255,255,255,.02)",borderRadius:4,marginBottom:8}}>
              <div className="mono" style={{fontSize:6,color:"var(--mut)",letterSpacing:".08em"}}>PRODUKT</div>
              <div style={{fontSize:9,color:"var(--blu)",marginTop:1,lineHeight:1.4}}>{idea.product}</div>
            </div>

            <div style={{fontSize:10,color:"var(--mut)",lineHeight:1.5,padding:"6px 8px",background:"rgba(255,255,255,.015)",borderRadius:4,borderLeft:`2px solid ${color}`}}>
              {idea.reasons?.join(" · ")}
            </div>
            {idea.sectorThreat&&<div style={{fontSize:8,color:"var(--org)",marginTop:4,fontStyle:"italic"}}>⚠️ {idea.sectorThreat}</div>}
            <div className="mono" style={{fontSize:7,color:"var(--mut)",marginTop:4}}>52W: ${fmt(idea.high52)}↑ / ${fmt(idea.low52)}↓ · Abstand: {idea.fromHigh}% · Support: ${idea.support} · Resistance: ${idea.resistance}</div>
          </div>);
        })}
      </div>)}

      {/* ═══ PRODUCTS ═══ */}
      {tab==="products"&&(<div className="fade">
        <h2 style={{fontSize:18,fontWeight:300,marginBottom:12}}>Consorsbank Produkte</h2>
        {Object.keys(products).length===0?<div className="card" style={{textAlign:"center",padding:40,color:"var(--mut)",fontSize:11}}>Starte Scan für Produkte</div>:
        Object.entries(products).map(([ticker,data])=>(<div key={ticker} style={{marginBottom:14}} className="fade">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span className="mono" style={{fontSize:13,fontWeight:700}}>{ticker}</span>
            {prices[ticker]&&<span className="mono" style={{fontSize:10,color:"var(--mut)"}}>${fmt(prices[ticker].price)} ({pct(prices[ticker].change)})</span>}
            {signals[ticker]&&<span className="badge" style={{background:`${signals[ticker].strategy==="short"?"var(--red)":"var(--grn)"}18`,color:signals[ticker].strategy==="short"?"var(--red)":"var(--grn)",fontSize:8}}>{signals[ticker].signal}</span>}
          </div>
          {data.items.map((p,i)=>(<div key={i} className="card fade" style={{padding:8,marginBottom:3,animationDelay:`${i*.03}s`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:10}}>
              <span className="badge" style={{background:`${p.type.includes("CALL")?"var(--grn)":p.type.includes("KO")?"var(--red)":"var(--org)"}18`,color:p.type.includes("CALL")?"var(--grn)":p.type.includes("KO")?"var(--red)":"var(--org)",fontSize:8}}>{p.type}</span>
              <span className="mono" style={{fontWeight:700,color:"var(--blu)"}}>{p.wkn}</span>
              <span style={{color:"var(--mut)",fontSize:9}}>{p.emittent}</span><span style={{flex:1}}/>
              <span className="mono" style={{fontSize:8,color:"var(--mut)"}}>Strike:{p.strike}</span>
              <span className="mono" style={{fontSize:8,color:"var(--org)"}}>Hebel:{p.hebel}x</span>
              <span className="mono" style={{fontSize:8}}>Bid/Ask:{p.bid}/{p.ask}</span>
              <span style={{fontSize:8,color:"var(--mut)"}}>{p.laufzeit}</span>
              {p.isExample&&<span className="mono" style={{fontSize:6,color:"var(--yl)"}}>BEISPIEL</span>}
            </div>
          </div>))}
        </div>))}
      </div>)}

      {/* ═══ NEWS ═══ */}
      {tab==="news"&&(<div className="fade">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{fontSize:18,fontWeight:300}}>KI-News mit Handelsempfehlung</h2>
          <button onClick={fetchNews} style={{padding:"5px 12px",background:"#0a84ff15",border:"1px solid #0a84ff25",borderRadius:5,color:"var(--blu)",fontSize:10,fontFamily:M}}>🔄 REFRESH</button>
        </div>
        {news.length===0?<div className="card" style={{textAlign:"center",padding:30,color:"var(--mut)",fontSize:11}}>Lade News...</div>:
        news.map((n,i)=>(<div key={i} className="card fade" style={{marginBottom:5,animationDelay:`${i*.03}s`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,lineHeight:1.4,marginBottom:3}}>{n.headline}</div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:9,color:"var(--mut)"}}>{n.source}</span>
                {n.sector&&<span className="badge" style={{background:"rgba(255,255,255,.04)",color:"var(--mut)",fontSize:7}}>{n.sector}</span>}
                {n.tickers?.length>0&&n.tickers.map(t=><span key={t} className="mono" style={{fontSize:8,color:"var(--blu)"}}>{t}</span>)}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
              <span className="badge" style={{background:`${n.sentiment?.includes("BEAR")?"var(--red)":n.sentiment?.includes("BULL")?"var(--grn)":"var(--org)"}18`,color:n.sentiment?.includes("BEAR")?"var(--red)":n.sentiment?.includes("BULL")?"var(--grn)":"var(--org)"}}>{n.sentiment}</span>
              <span className="badge" style={{background:`${n.action==="SHORTEN"?"var(--red)":n.action==="KAUFEN"?"var(--grn)":"var(--yl)"}18`,color:n.action==="SHORTEN"?"var(--red)":n.action==="KAUFEN"?"var(--grn)":"var(--yl)",fontSize:9,fontWeight:700}}>{n.action}</span>
            </div>
          </div>
        </div>))}
      </div>)}

      {/* ═══ ALERTS ═══ */}
      {tab==="alerts"&&(<div className="fade">
        <h2 style={{fontSize:18,fontWeight:300,marginBottom:12}}>Alerts ({alerts.length})</h2>
        {alerts.length===0?<div className="card" style={{textAlign:"center",padding:30,color:"var(--mut)",fontSize:11}}>Starte Scan</div>:
        alerts.map((a,i)=>(<div key={a.id} className="fade" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--card)",borderRadius:5,marginBottom:2,borderLeft:`2px solid ${a.type==="SHORT"?"var(--red)":a.type==="KAUFEN"?"var(--grn)":"var(--org)"}`,animationDelay:`${i*.02}s`}}>
          <span className="mono" style={{fontSize:9,color:"var(--mut)",minWidth:60}}>{a.time.toLocaleTimeString("de-DE")}</span>
          <span style={{fontSize:10}}>{a.msg}</span>
        </div>))}
      </div>)}

      {/* ═══ SETTINGS ═══ */}
      {tab==="settings"&&(<div className="fade">
        <h2 style={{fontSize:18,fontWeight:300,marginBottom:14}}>Einstellungen</h2>

        <div className="card" style={{marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8}}>📧 Email-Alerts (kostenlos via EmailJS)</div>
          <p style={{fontSize:10,color:"var(--mut)",marginBottom:10,lineHeight:1.5}}>
            Erhalte Email-Benachrichtigungen bei SHORT- oder KAUFEN-Signalen. Erstelle einen kostenlosen Account bei <a href="https://www.emailjs.com" target="_blank" style={{color:"var(--blu)"}}>emailjs.com</a> (200 Emails/Monat gratis).
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <input placeholder="Deine Email-Adresse" value={email} onChange={e=>setEmail(e.target.value)} style={{padding:"8px 10px",background:"rgba(255,255,255,.04)",border:"1px solid var(--brd)",borderRadius:5,color:"var(--txt)",fontSize:11,fontFamily:M}}/>
            <input placeholder="EmailJS Service ID" value={emailCfg.service} onChange={e=>setEmailCfg(p=>({...p,service:e.target.value}))} style={{padding:"8px 10px",background:"rgba(255,255,255,.04)",border:"1px solid var(--brd)",borderRadius:5,color:"var(--txt)",fontSize:11,fontFamily:M}}/>
            <input placeholder="EmailJS Template ID" value={emailCfg.template} onChange={e=>setEmailCfg(p=>({...p,template:e.target.value}))} style={{padding:"8px 10px",background:"rgba(255,255,255,.04)",border:"1px solid var(--brd)",borderRadius:5,color:"var(--txt)",fontSize:11,fontFamily:M}}/>
            <input placeholder="EmailJS Public Key" value={emailCfg.key} onChange={e=>setEmailCfg(p=>({...p,key:e.target.value}))} style={{padding:"8px 10px",background:"rgba(255,255,255,.04)",border:"1px solid var(--brd)",borderRadius:5,color:"var(--txt)",fontSize:11,fontFamily:M}}/>
          </div>
          <div className="mono" style={{fontSize:8,color:"var(--mut)",marginTop:8}}>Status: {email?"✅ Email gesetzt":"❌ Keine Email"} · {emailCfg.service?"✅ EmailJS konfiguriert":"⚠️ Nur Browser-Alerts (keine Emails)"}</div>
        </div>

        <div className="card">
          <div style={{fontWeight:600,fontSize:12,marginBottom:8}}>ℹ️ Über das Tool</div>
          <div style={{fontSize:10,color:"var(--mut)",lineHeight:1.6}}>
            <b>Kosten:</b> 0 EUR — Yahoo Finance + Google News RSS + lokale Signal-Logik<br/>
            <b>Sektoren:</b> 12 Branchen, 45+ Aktien<br/>
            <b>Strategie:</b> Dual — SHORT (auf Fall wetten) + BUY DIP (günstig kaufen)<br/>
            <b>Produkte:</b> Beispiel-WKNs — immer in Consorsbank verifizieren<br/>
            <b>Updates:</b> Push zu GitHub → Vercel deployed automatisch<br/>
          </div>
        </div>

        <div className="card" style={{marginTop:12,borderColor:"#ff2d5530"}}>
          <div style={{fontSize:10,color:"var(--red)",fontWeight:600,marginBottom:4}}>⚠️ Disclaimer</div>
          <div style={{fontSize:9,color:"var(--mut)",lineHeight:1.5}}>Keine Anlageberatung. Short-Zertifikate können wertlos verfallen. Max. 2% pro Trade. Immer Stop-Loss setzen.</div>
        </div>
      </div>)}
    </main>

    <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"4px 18px",background:"rgba(6,6,11,.96)",borderTop:"1px solid var(--brd)",fontSize:7,color:"#3a3a4a",textAlign:"center",fontFamily:M,zIndex:50}}>
      ⚡ V2 · 12 Sektoren · Short + Buy-the-Dip · 100% kostenlos · ⚠️ Keine Anlageberatung
    </div>
  </>);
}

function MiniChart({data=[],w=80,h=20}) {
  if(!data||data.length<2) return null;
  const mn=Math.min(...data),mx=Math.max(...data),rg=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rg)*h}`).join(" ");
  const c=data[data.length-1]>=data[0]?"#30d158":"#ff2d55";
  return <svg width={w} height={h} style={{display:"block",flexShrink:0}}><polyline points={pts} fill="none" stroke={c} strokeWidth="1.5"/><circle cx={w} cy={h-((data[data.length-1]-mn)/rg)*h} r="2" fill={c}/></svg>;
}
