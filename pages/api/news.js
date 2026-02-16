// /api/news - Google News RSS with automated sentiment + trade recommendation

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const queries = [
    "AI+disruption+stocks+2026",
    "artificial+intelligence+replacing+software",
    "AI+impact+financial+services",
    "pharma+stocks+AI+drug+discovery",
    "autonomous+vehicles+stocks",
    "AI+education+technology",
    "energy+stocks+market",
    "retail+ecommerce+AI",
    "media+entertainment+AI+disruption",
    "insurance+technology+AI",
  ];

  const allItems = [];

  // Fetch from multiple queries for breadth
  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const query of selectedQueries) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;
      const r = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) continue;

      const xml = await r.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const item of items.slice(0, 5)) {
        const title = clean(item.match(/<title>(.*?)<\/title>/)?.[1] || "");
        const source = clean(item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "");
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const link = item.match(/<link\/>\s*(https?:\/\/[^\s<]+)/)?.[1] || item.match(/<link>(https?:\/\/[^\s<]+)/)?.[1] || "";

        if (title && title.length > 15) {
          const analysis = analyzeHeadline(title);
          allItems.push({
            headline: title, source, pubDate, link,
            ...analysis,
          });
        }
      }
    } catch {}
  }

  // Deduplicate by headline similarity
  const unique = [];
  const seen = new Set();
  for (const item of allItems) {
    const key = item.headline.slice(0, 40).toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }

  // Sort: actionable items first
  unique.sort((a, b) => {
    const order = { KAUFEN: 0, SHORTEN: 1, BEOBACHTEN: 2 };
    return (order[a.action] || 3) - (order[b.action] || 3);
  });

  res.status(200).json({ news: unique.slice(0, 15), time: new Date().toISOString() });
}

function analyzeHeadline(title) {
  const t = title.toLowerCase();

  // ── Sentiment ──
  let sentiment = "NEUTRAL";
  let sentimentScore = 0;

  const bearWords = ["crash", "drop", "fall", "plunge", "sell", "bear", "risk", "threat", "disrupt", "replace", "layoff", "cut", "decline", "lose", "worst", "fear", "warn", "slash", "dump", "tank", "collapse", "crisis"];
  const bullWords = ["surge", "rally", "rise", "bull", "grow", "boost", "gain", "beat", "strong", "record", "soar", "jump", "upgrade", "buy", "outperform", "breakthrough", "profit", "recover", "rebound"];

  for (const w of bearWords) { if (t.includes(w)) sentimentScore -= 1; }
  for (const w of bullWords) { if (t.includes(w)) sentimentScore += 1; }

  if (sentimentScore <= -2) sentiment = "SEHR_BEARISH";
  else if (sentimentScore <= -1) sentiment = "BEARISH";
  else if (sentimentScore >= 2) sentiment = "SEHR_BULLISH";
  else if (sentimentScore >= 1) sentiment = "BULLISH";

  // ── Affected Sector ──
  let sector = "";
  const sectorMap = {
    "Enterprise Software": ["sap", "oracle", "salesforce", "software", "erp", "crm", "workday", "saas"],
    "Finanzberatung": ["bank", "financ", "advisory", "wealth", "tax", "schwab", "fidelity"],
    "Finanzdaten & Ratings": ["rating", "moody", "s&p global", "factset", "data provider", "bloomberg"],
    "IT-Beratung": ["consult", "accenture", "deloitte", "infosys", "epam", "outsourc"],
    "Bildung": ["educ", "learn", "chegg", "tutor", "university", "coursera", "duolingo"],
    "Pharma & Biotech": ["pharma", "biotech", "drug", "pfizer", "moderna", "clinical", "fda", "vaccine"],
    "Immobilien": ["real estate", "reit", "property", "housing", "mortgage", "home"],
    "Energie": ["energy", "oil", "gas", "solar", "wind", "renewable", "exxon", "chevron"],
    "Automobil": ["auto", "car", "vehicle", "tesla", "ev", "electric vehicle", "toyota", "bmw"],
    "Medien & Werbung": ["media", "entertain", "streaming", "netflix", "disney", "advertis", "content"],
    "Versicherung": ["insurance", "insurtech", "underwriting", "claims", "policy"],
    "Einzelhandel": ["retail", "ecommerce", "amazon", "walmart", "shop", "consumer"],
  };

  for (const [sec, keywords] of Object.entries(sectorMap)) {
    for (const kw of keywords) {
      if (t.includes(kw)) { sector = sec; break; }
    }
    if (sector) break;
  }

  // ── Affected Tickers ──
  const tickerMap = {
    SAP: ["sap"], ORCL: ["oracle"], CRM: ["salesforce"], WDAY: ["workday"],
    CHGG: ["chegg"], DUOL: ["duolingo"], COUR: ["coursera"],
    ACN: ["accenture"], EPAM: ["epam"], MCO: ["moody"],
    TSLA: ["tesla"], F: ["ford"], TM: ["toyota"],
    DIS: ["disney"], NFLX: ["netflix"], AMZN: ["amazon"], WMT: ["walmart"],
    PFE: ["pfizer"], MRNA: ["moderna"], JNJ: ["johnson"],
    XOM: ["exxon"], CVX: ["chevron"],
    SCHW: ["schwab"],
  };

  const tickers = [];
  for (const [tick, keywords] of Object.entries(tickerMap)) {
    for (const kw of keywords) {
      if (t.includes(kw)) { tickers.push(tick); break; }
    }
  }

  // ── Trade Action ──
  let action = "BEOBACHTEN";
  if (sentiment === "SEHR_BEARISH" && sector) {
    action = t.includes("ai") || t.includes("artificial") ? "SHORTEN" : "BEOBACHTEN";
  }
  if (sentiment === "SEHR_BULLISH" || (sentiment === "BULLISH" && (t.includes("recover") || t.includes("rebound") || t.includes("oversold")))) {
    action = "KAUFEN";
  }
  if (sentiment === "BEARISH" && (t.includes("overreact") || t.includes("oversold") || t.includes("dip"))) {
    action = "KAUFEN";
  }

  return { sentiment, sentimentScore, sector, tickers, action };
}

function clean(text) {
  return text.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}
