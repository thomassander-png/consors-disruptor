// /api/signal?ticker=SAP&price=198&change=-5.2&sector=Enterprise+Software
// Generates trading signals based on rules - NO API calls, runs locally

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ticker, price, change, sector } = req.query;
  if (!ticker || !price) return res.status(400).json({ error: "ticker and price required" });

  const p = parseFloat(price);
  const ch = parseFloat(change) || 0;

  const signal = generateSignal(ticker, p, ch, sector || "");

  res.status(200).json(signal);
}

function generateSignal(ticker, price, change, sector) {
  // ── Disruption Score Calculation ──
  // Based on: magnitude of drop, sector vulnerability, momentum
  let score = 0;
  let reasons = [];

  // 1. Price momentum (40% weight)
  if (change <= -10) { score += 40; reasons.push(`Starker Kurseinbruch (${change.toFixed(1)}%)`); }
  else if (change <= -5) { score += 30; reasons.push(`Deutlicher Rückgang (${change.toFixed(1)}%)`); }
  else if (change <= -3) { score += 20; reasons.push(`Moderater Rückgang (${change.toFixed(1)}%)`); }
  else if (change <= -1) { score += 10; reasons.push(`Leichter Rückgang`); }
  else { score += 0; reasons.push(`Kein negativer Trend`); }

  // 2. Sector vulnerability (30% weight)
  const sectorScores = {
    "Enterprise Software": 28, // High: direct replacement by AI tools
    "Finanzberatung": 26,      // High: Altruist, robo-advisors
    "Finanzdaten": 22,         // Medium-High: AI analysis
    "Consulting": 20,          // Medium: AI coding, automation
    "Bildung": 24,             // High: ChatGPT tutoring
  };
  const sectorScore = sectorScores[sector] || 15;
  score += sectorScore;
  if (sectorScore >= 24) reasons.push(`Sektor "${sector}" stark KI-gefährdet`);
  else if (sectorScore >= 20) reasons.push(`Sektor "${sector}" moderat KI-gefährdet`);

  // 3. Ticker-specific vulnerability (30% weight)
  const tickerScores = {
    // Enterprise Software
    "SAP": 25, "WDAY": 22, "CRM": 18, "ORCL": 16,
    // Financial Data
    "FDS": 24, "MCO": 20, "SPGI": 18, "NDAQ": 15,
    // Financial Advisory
    "SCHW": 18, "LPLA": 22, "AMP": 20, "RJF": 22,
    // Consulting
    "ACN": 18, "EPAM": 26, "IT": 16, "GLOB": 24,
    // Education
    "CHGG": 28, "DUOL": 14, "COUR": 22,
  };
  const tickerScore = tickerScores[ticker] || 15;
  score += tickerScore;

  // ── Signal Generation ──
  let signal, confidence;
  if (score >= 75) {
    signal = "SHORT";
    confidence = Math.min(10, Math.round(score / 10));
    reasons.push("Starkes Short-Signal: hohe Disruptions-Gefahr kombiniert mit Kursrückgang");
  } else if (score >= 55) {
    signal = "WATCH";
    confidence = Math.min(7, Math.round(score / 12));
    reasons.push("Unter Beobachtung: Disruption möglich, aber Timing unsicher");
  } else {
    signal = "KEIN_TRADE";
    confidence = Math.max(1, Math.round(score / 15));
    reasons.push("Kein Trade: Disruptions-Risiko zu gering oder Kurs stabil");
  }

  // ── Price Levels ──
  const stopLoss = signal === "SHORT"
    ? (price * 1.05).toFixed(2)  // 5% above for shorts
    : "—";
  const target = signal === "SHORT"
    ? (price * 0.85).toFixed(2)  // 15% below
    : "—";
  const entry = signal === "SHORT" ? "Sofort bei Markteröffnung" : "Abwarten";

  // ── Product Recommendation ──
  let productRec = "";
  if (signal === "SHORT") {
    if (change <= -5) {
      productRec = `KO-Put mit Strike ${(price * 1.10).toFixed(0)}, Open-End — in Consorsbank nach "${ticker} Knock-Out Put" suchen`;
    } else {
      productRec = `Put-Optionsschein mit Strike ${(price * 1.05).toFixed(0)}, Laufzeit 2-3 Monate — in Consorsbank nach "${ticker} Put" suchen`;
    }
  } else if (signal === "WATCH") {
    productRec = "Noch kein Produkt — erst bei klarerem Signal";
  }

  return {
    ticker,
    price,
    change,
    sector,
    signal,
    confidence,
    score,
    entry,
    stopLoss,
    target,
    product: productRec,
    risk: score >= 75 ? "Hoch — enge Stop-Loss setzen" : score >= 55 ? "Mittel" : "Niedrig",
    reasons,
    time: new Date().toISOString(),
  };
}
