// /api/signal?ticker=SAP&price=198&change=-5.2&sector=Enterprise+Software
// DUAL STRATEGY: Short signals AND Buy-the-Dip opportunities

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { ticker, price, change, sector, week_high, week_low } = req.query;
  if (!ticker || !price) return res.status(400).json({ error: "ticker and price required" });

  const p = parseFloat(price);
  const ch = parseFloat(change) || 0;
  const high52 = parseFloat(week_high) || p * 1.3;
  const low52 = parseFloat(week_low) || p * 0.7;
  const fromHigh = ((p - high52) / high52) * 100;

  const signal = generateDualSignal(ticker, p, ch, sector || "", fromHigh, high52, low52);
  res.status(200).json(signal);
}

function generateDualSignal(ticker, price, change, sector, fromHigh, high52, low52) {
  // ── DISRUPTION VULNERABILITY (0-100) ──
  const sectorDisruption = {
    "Enterprise Software": 85, "Finanzberatung": 80, "Finanzdaten & Ratings": 72,
    "IT-Beratung": 70, "Bildung": 78, "Pharma & Biotech": 35,
    "Immobilien": 25, "Energie": 20, "Automobil": 55,
    "Medien & Werbung": 75, "Versicherung": 50, "Einzelhandel": 60,
  };

  const tickerDisruption = {
    SAP: 85, ORCL: 65, CRM: 70, WDAY: 80, FDS: 82, MCO: 68, SPGI: 65,
    NDAQ: 55, SCHW: 60, LPLA: 75, AMP: 70, RJF: 72, ACN: 68, EPAM: 88,
    IT: 60, GLOB: 82, CHGG: 95, DUOL: 45, COUR: 78,
    PFE: 25, JNJ: 20, MRNA: 30, ABBV: 22,
    SPG: 20, AMT: 18, O: 15, PLD: 22,
    XOM: 15, CVX: 12, NEE: 18, ENPH: 40,
    TM: 45, TSLA: 35, F: 50, BMW: 48,
    DIS: 65, NFLX: 40, PARA: 75, WBD: 70,
    ALL: 35, MET: 40, PRU: 45, AIG: 38,
    AMZN: 30, WMT: 25, TGT: 35, BABA: 40,
  };

  const disruptionScore = (sectorDisruption[sector] || 40) * 0.5 + (tickerDisruption[ticker] || 40) * 0.5;

  // ── SHORT SCORE (should we bet on further decline?) ──
  let shortScore = 0;
  const shortReasons = [];

  // Momentum: recent drop strength
  if (change <= -10) { shortScore += 35; shortReasons.push(`Starker Einbruch (${change.toFixed(1)}%)`); }
  else if (change <= -5) { shortScore += 25; shortReasons.push(`Deutlicher Rückgang (${change.toFixed(1)}%)`); }
  else if (change <= -3) { shortScore += 15; shortReasons.push(`Moderater Rückgang`); }

  // Disruption vulnerability
  if (disruptionScore >= 75) { shortScore += 30; shortReasons.push("Sehr hohe KI-Disruptions-Gefahr"); }
  else if (disruptionScore >= 55) { shortScore += 20; shortReasons.push("Erhöhte Disruptions-Gefahr"); }
  else if (disruptionScore >= 35) { shortScore += 10; shortReasons.push("Moderate Disruptions-Gefahr"); }

  // Distance from high (still near high = more room to fall)
  if (fromHigh > -10) { shortScore += 15; shortReasons.push("Noch nahe am 52W-Hoch — Fallhöhe vorhanden"); }
  else if (fromHigh > -25) { shortScore += 8; }

  // ── BUY-THE-DIP SCORE (is this an oversold opportunity?) ──
  let dipScore = 0;
  const dipReasons = [];

  // How far from high (further = more oversold)
  if (fromHigh <= -40) { dipScore += 35; dipReasons.push(`${fromHigh.toFixed(0)}% unter 52W-Hoch — stark überverkauft`); }
  else if (fromHigh <= -25) { dipScore += 25; dipReasons.push(`${fromHigh.toFixed(0)}% unter 52W-Hoch — deutlich überverkauft`); }
  else if (fromHigh <= -15) { dipScore += 15; dipReasons.push(`${fromHigh.toFixed(0)}% unter 52W-Hoch`); }

  // Low disruption = better recovery chance
  if (disruptionScore < 35) { dipScore += 30; dipReasons.push("Geringe KI-Disruption — Erholung wahrscheinlich"); }
  else if (disruptionScore < 55) { dipScore += 20; dipReasons.push("Moderate Disruption — Erholung möglich"); }
  else if (disruptionScore < 70) { dipScore += 10; dipReasons.push("Hohe Disruption — Erholung unsicher"); }

  // Strong recent drop = potential overreaction
  if (change <= -8) { dipScore += 20; dipReasons.push("Starker Tagesverlust — mögliche Überreaktion"); }
  else if (change <= -4) { dipScore += 12; dipReasons.push("Deutlicher Tagesverlust"); }

  // Quality premium (blue chips recover better)
  const blueChips = ["ORCL", "CRM", "SPGI", "MCO", "ACN", "SCHW", "PFE", "JNJ", "XOM", "CVX", "AMZN", "WMT", "DIS", "NFLX", "TM", "TSLA"];
  if (blueChips.includes(ticker)) { dipScore += 12; dipReasons.push("Blue-Chip — höhere Erholungswahrscheinlichkeit"); }

  // ── DETERMINE PRIMARY SIGNAL ──
  let signal, strategy, confidence;

  if (shortScore >= 65 && shortScore > dipScore + 15) {
    signal = "SHORT";
    strategy = "short";
    confidence = Math.min(10, Math.round(shortScore / 9));
  } else if (dipScore >= 55 && dipScore > shortScore + 10) {
    signal = "KAUFEN";
    strategy = "dip";
    confidence = Math.min(10, Math.round(dipScore / 9));
  } else if (shortScore >= 50) {
    signal = "SHORT_WATCH";
    strategy = "short";
    confidence = Math.min(7, Math.round(shortScore / 12));
  } else if (dipScore >= 40) {
    signal = "DIP_WATCH";
    strategy = "dip";
    confidence = Math.min(7, Math.round(dipScore / 12));
  } else {
    signal = "NEUTRAL";
    strategy = "none";
    confidence = 3;
  }

  // ── PRICE LEVELS ──
  let entry, stopLoss, target, product;

  if (strategy === "short") {
    entry = change <= -5 ? "Sofort" : `Bei Unterschreitung von $${(price * 0.97).toFixed(2)}`;
    stopLoss = `$${(price * 1.06).toFixed(2)} (+6%)`;
    target = `$${(price * 0.82).toFixed(2)} (-18%)`;
    product = `In Consorsbank suchen: "${ticker} Knock-Out Put" oder "${ticker} Put Optionsschein"`;
  } else if (strategy === "dip") {
    entry = change <= -8 ? "Sofort (Überreaktion nutzen)" : `Limit-Order bei $${(price * 0.97).toFixed(2)}`;
    stopLoss = `$${(price * 0.88).toFixed(2)} (-12%)`;
    target = `$${(price * 1.20).toFixed(2)} (+20%)`;
    product = `Aktie direkt kaufen oder Call-Optionsschein in Consorsbank: "${ticker} Call"`;
  } else {
    entry = "Abwarten";
    stopLoss = "—";
    target = "—";
    product = "Kein Trade empfohlen";
  }

  const riskLevel = confidence >= 8 ? "Hoch" : confidence >= 5 ? "Mittel" : "Niedrig";

  return {
    ticker, price, change, sector,
    signal, strategy, confidence,
    shortScore, dipScore, disruptionScore: Math.round(disruptionScore),
    entry, stopLoss, target, product,
    risk: riskLevel,
    fromHigh: Math.round(fromHigh),
    high52, low52,
    shortReasons, dipReasons,
    reasons: strategy === "short" ? shortReasons : strategy === "dip" ? dipReasons : ["Kein klares Signal"],
    time: new Date().toISOString(),
  };
}
