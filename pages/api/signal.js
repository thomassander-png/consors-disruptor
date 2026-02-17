// /api/signal - ADVANCED DUAL STRATEGY ENGINE
// RSI, Trend, Volatilität, Support/Resistance, Risk/Reward, Position Sizing

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { ticker, price, change, sector, week_high, week_low, history } = req.query;
  if (!ticker || !price) return res.status(400).json({ error: "ticker and price required" });

  const p = parseFloat(price);
  const ch = parseFloat(change) || 0;
  const high52 = parseFloat(week_high) || p * 1.3;
  const low52 = parseFloat(week_low) || p * 0.7;
  const fromHigh = ((p - high52) / high52) * 100;
  const fromLow = ((p - low52) / low52) * 100;
  const hist = history ? history.split(",").map(Number).filter(n => !isNaN(n)) : [];

  const signal = analyze(ticker, p, ch, sector || "", fromHigh, fromLow, high52, low52, hist);
  res.status(200).json(signal);
}

function analyze(ticker, price, change, sector, fromHigh, fromLow, high52, low52, history) {

  // ── RSI-Schätzung ──
  let rsi = 50;
  if (history.length >= 5) {
    let gains = 0, losses = 0;
    for (let i = 1; i < history.length; i++) {
      const d = history[i] - history[i-1];
      if (d > 0) gains += d; else losses += Math.abs(d);
    }
    const rs = (gains / (history.length-1)) / ((losses / (history.length-1)) || 0.01);
    rsi = Math.round(100 - (100 / (1 + rs)));
  } else {
    if (change <= -10) rsi = 15; else if (change <= -5) rsi = 25;
    else if (change <= -2) rsi = 35; else if (change >= 5) rsi = 75; else rsi = 50;
  }

  // ── Trend ──
  let trend = "SEITWÄRTS", trendStrength = 0;
  if (history.length >= 5) {
    const r = history.slice(-5), o = history.slice(-10, -5);
    const ra = r.reduce((a,b)=>a+b,0)/r.length;
    const oa = o.length > 0 ? o.reduce((a,b)=>a+b,0)/o.length : ra;
    const tp = ((ra - oa) / oa) * 100;
    if (tp <= -5) { trend = "STARK_ABWÄRTS"; trendStrength = -3; }
    else if (tp <= -2) { trend = "ABWÄRTS"; trendStrength = -2; }
    else if (tp <= -0.5) { trend = "LEICHT_ABWÄRTS"; trendStrength = -1; }
    else if (tp >= 5) { trend = "STARK_AUFWÄRTS"; trendStrength = 3; }
    else if (tp >= 2) { trend = "AUFWÄRTS"; trendStrength = 2; }
  }

  // ── Volatilität ──
  let volatility = "NORMAL";
  if (history.length >= 5) {
    const m = history.reduce((a,b)=>a+b,0)/history.length;
    const v = history.reduce((a,b)=>a+Math.pow(b-m,2),0)/history.length;
    const cv = (Math.sqrt(v)/m)*100;
    if (cv > 5) volatility = "SEHR_HOCH"; else if (cv > 3) volatility = "HOCH";
    else if (cv > 1.5) volatility = "ERHÖHT"; else volatility = "NIEDRIG";
  }

  // ── Support/Resistance (Fibonacci) ──
  const range = high52 - low52;
  const support = low52 + range * 0.236;
  const resistance = low52 + range * 0.618;
  const nearSupport = price < support * 1.03;
  const nearResistance = price > resistance * 0.97;

  // ── Sektor & Ticker Daten ──
  const SEC = {
    "Enterprise Software": { d:85, threat:"Cowork, Cursor, Devin ersetzen Business-Software" },
    "Finanzberatung": { d:80, threat:"Altruist automatisiert Steuer- und Vermögensberatung" },
    "Finanzdaten & Ratings": { d:72, threat:"KI-Analyse ersetzt teure Datenanbieter-Abos" },
    "IT-Beratung": { d:70, threat:"KI-Coding reduziert Beraterbedarf um 30-50%" },
    "Bildung": { d:78, threat:"ChatGPT/Claude als kostenloser Tutor" },
    "Pharma & Biotech": { d:35, threat:"KI beschleunigt Drug Discovery — eher positiv" },
    "Immobilien": { d:25, threat:"Kaum KI-Disruption — Sachwerte" },
    "Energie": { d:20, threat:"KI optimiert Netze — eher positiv" },
    "Automobil": { d:55, threat:"Autonomes Fahren verändert Wertschöpfung" },
    "Medien & Werbung": { d:75, threat:"KI-Content bedroht Studios und Agenturen" },
    "Versicherung": { d:50, threat:"KI-Underwriting und Claims-Automatisierung" },
    "Einzelhandel": { d:60, threat:"KI-Personalisierung verändert Handel" },
  };
  const TK = {
    SAP:{d:85,q:70,m:60},ORCL:{d:65,q:80,m:75},CRM:{d:70,q:75,m:70},WDAY:{d:80,q:65,m:55},
    FDS:{d:82,q:70,m:50},MCO:{d:68,q:85,m:85},SPGI:{d:65,q:90,m:90},NDAQ:{d:55,q:80,m:75},
    SCHW:{d:60,q:75,m:70},LPLA:{d:75,q:55,m:40},AMP:{d:70,q:65,m:55},RJF:{d:72,q:60,m:45},
    ACN:{d:68,q:85,m:75},EPAM:{d:88,q:50,m:30},IT:{d:60,q:70,m:65},GLOB:{d:82,q:45,m:25},
    CHGG:{d:95,q:15,m:10},DUOL:{d:45,q:70,m:60},COUR:{d:78,q:40,m:30},
    PFE:{d:25,q:60,m:65},JNJ:{d:20,q:90,m:85},MRNA:{d:30,q:50,m:55},ABBV:{d:22,q:85,m:80},
    SPG:{d:20,q:75,m:70},AMT:{d:18,q:85,m:80},O:{d:15,q:80,m:75},PLD:{d:22,q:85,m:80},
    XOM:{d:15,q:85,m:80},CVX:{d:12,q:85,m:80},NEE:{d:18,q:80,m:75},ENPH:{d:40,q:55,m:50},
    TM:{d:45,q:85,m:80},TSLA:{d:35,q:60,m:70},F:{d:50,q:50,m:55},
    DIS:{d:65,q:75,m:80},NFLX:{d:40,q:80,m:75},PARA:{d:75,q:35,m:35},WBD:{d:70,q:40,m:40},
    ALL:{d:35,q:70,m:65},MET:{d:40,q:65,m:60},PRU:{d:45,q:65,m:60},
    AMZN:{d:30,q:90,m:90},WMT:{d:25,q:85,m:85},TGT:{d:35,q:65,m:60},BABA:{d:40,q:55,m:65},
  };

  const sec = SEC[sector] || { d:40, threat:"Unklar" };
  const tk = TK[ticker] || { d:40, q:50, m:50 };
  const disruptionScore = Math.round(sec.d * 0.4 + tk.d * 0.6);
  const qualityScore = tk.q;
  const moatScore = tk.m;

  // ═══ SCORING ═══
  let shortScore = 0, dipScore = 0;
  const shortReasons = [], dipReasons = [];

  // SHORT
  if (change <= -10) { shortScore += 25; shortReasons.push(`🔴 Crash (${change.toFixed(1)}%)`); }
  else if (change <= -5) { shortScore += 18; shortReasons.push(`📉 Stark (${change.toFixed(1)}%)`); }
  else if (change <= -3) { shortScore += 12; shortReasons.push(`📉 Rückgang`); }

  if (disruptionScore >= 80) { shortScore += 22; shortReasons.push(`🤖 Extreme Disruption (${disruptionScore})`); }
  else if (disruptionScore >= 65) { shortScore += 15; shortReasons.push(`🤖 Hohe Disruption (${disruptionScore})`); }
  else if (disruptionScore >= 45) { shortScore += 8; }

  if (trendStrength <= -2) { shortScore += 12; shortReasons.push(`📊 Abwärtstrend`); }
  else if (trendStrength <= -1) { shortScore += 7; }
  else if (trendStrength >= 1) shortScore -= 5;

  if (rsi > 65) { shortScore += 8; shortReasons.push(`RSI überkauft (${rsi})`); }
  else if (rsi < 25) shortScore -= 5;

  if (fromHigh > -10) { shortScore += 8; shortReasons.push(`Nahe am Hoch — Fallhöhe`); }
  if (qualityScore < 40) { shortScore += 8; shortReasons.push(`Schwache Qualität`); }
  if (moatScore < 35) { shortScore += 5; shortReasons.push(`Kein Burggraben`); }

  // DIP
  if (fromHigh <= -50) { dipScore += 25; dipReasons.push(`💎 Extrem überverkauft (${fromHigh.toFixed(0)}%)`); }
  else if (fromHigh <= -35) { dipScore += 18; dipReasons.push(`Stark überverkauft (${fromHigh.toFixed(0)}%)`); }
  else if (fromHigh <= -20) { dipScore += 10; dipReasons.push(`${fromHigh.toFixed(0)}% vom Hoch`); }

  if (qualityScore >= 80 && moatScore >= 75) { dipScore += 22; dipReasons.push(`⭐ Premium + Burggraben`); }
  else if (qualityScore >= 65) { dipScore += 15; dipReasons.push(`Gute Qualität`); }
  else if (qualityScore >= 50) { dipScore += 8; }

  if (disruptionScore < 30) { dipScore += 18; dipReasons.push(`🛡️ Kaum Disruption`); }
  else if (disruptionScore < 50) { dipScore += 10; dipReasons.push(`Moderate Disruption`); }

  if (rsi < 25) { dipScore += 12; dipReasons.push(`RSI überverkauft (${rsi})`); }
  else if (rsi < 35) { dipScore += 7; dipReasons.push(`RSI niedrig (${rsi})`); }

  if (change <= -8) { dipScore += 8; dipReasons.push(`Mögliche Überreaktion`); }
  if (nearSupport) { dipScore += 5; dipReasons.push(`Nahe Support ($${support.toFixed(0)})`); }

  // ═══ SIGNAL ═══
  let signal, strategy, confidence;
  if (shortScore >= 55 && shortScore > dipScore + 10) { signal="SHORT"; strategy="short"; confidence=Math.min(10,Math.round(shortScore/8)); }
  else if (dipScore >= 45 && dipScore > shortScore + 8) { signal="KAUFEN"; strategy="dip"; confidence=Math.min(10,Math.round(dipScore/8)); }
  else if (shortScore >= 40 && shortScore > dipScore) { signal="SHORT_WATCH"; strategy="short"; confidence=Math.min(7,Math.round(shortScore/10)); }
  else if (dipScore >= 30 && dipScore > shortScore) { signal="DIP_WATCH"; strategy="dip"; confidence=Math.min(7,Math.round(dipScore/10)); }
  else { signal="NEUTRAL"; strategy="none"; confidence=3; }

  // ═══ TRADE PLAN ═══
  let entry, stopLoss, target, target2, product, riskReward, positionSize;
  const budget = 10000; // Annahme 10k Portfolio

  if (strategy === "short") {
    const sl = price * 1.05, tp1 = price * 0.88, tp2 = price * 0.78;
    entry = change <= -5 ? "Sofort bei Bestätigung" : `Unter $${(price*.98).toFixed(2)}`;
    stopLoss = `$${sl.toFixed(2)} (+5%)`; target = `$${tp1.toFixed(2)} (-12%)`; target2 = `$${tp2.toFixed(2)} (-22%)`;
    riskReward = ((price-tp1)/(sl-price)).toFixed(1);
    positionSize = `${Math.round(budget * 0.02 / (sl-price))} Stück (2% Risiko bei ${budget}€)`;
    product = `Consorsbank → "${ticker} Knock-Out Put" Strike über $${(price*1.08).toFixed(0)} · Oder "${ticker} Put" Laufzeit 3+ Monate`;
  } else if (strategy === "dip") {
    const sl = price * 0.90, tp1 = price * 1.15, tp2 = price * 1.30;
    entry = change <= -8 ? "Sofort — Überreaktion" : `Limit $${(price*.98).toFixed(2)} oder gestaffelt`;
    stopLoss = `$${sl.toFixed(2)} (-10%)`; target = `$${tp1.toFixed(2)} (+15%)`; target2 = `$${tp2.toFixed(2)} (+30%)`;
    riskReward = ((tp1-price)/(price-sl)).toFixed(1);
    positionSize = `${Math.round(budget * 0.02 / (price-sl))} Stück (2% Risiko bei ${budget}€)`;
    product = `Aktie direkt kaufen · Oder "${ticker} Call" Strike nahe Kurs, Laufzeit 6+ Monate`;
  } else {
    entry="Abwarten"; stopLoss="—"; target="—"; target2="—"; riskReward="—"; product="Kein Trade"; positionSize="—";
  }

  let ampel = "⚪";
  if (signal==="SHORT" && confidence>=7) ampel="🔴";
  else if (signal==="SHORT") ampel="🟠";
  else if (signal==="KAUFEN" && confidence>=7) ampel="🟢";
  else if (signal==="KAUFEN") ampel="🟡";

  return {
    ticker, price, change, sector, signal, strategy, confidence, ampel,
    shortScore, dipScore, disruptionScore, qualityScore, moatScore,
    rsi, trend, trendStrength, volatility,
    support:support.toFixed(2), resistance:resistance.toFixed(2), nearSupport, nearResistance,
    entry, stopLoss, target, target2, product, riskReward, positionSize,
    risk: confidence>=8?"HOCH":confidence>=5?"MITTEL":"NIEDRIG",
    fromHigh:Math.round(fromHigh), fromLow:Math.round(fromLow), high52, low52,
    sectorThreat:sec.threat,
    shortReasons, dipReasons,
    reasons: strategy==="short"?shortReasons:strategy==="dip"?dipReasons:["Kein klares Signal"],
    time: new Date().toISOString(),
  };
}
