// /api/products?ticker=SAP&price=198
// Searches for knock-out certificates and put warrants
// Uses free sources: onvista, ariva, finanztreff

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ticker, price } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const currentPrice = parseFloat(price) || 100;
  const products = [];

  try {
    // Try to fetch from onvista search (free)
    const searchUrl = `https://api.onvista.de/api/v1/instruments/search/faceted?searchValue=${ticker}+put+knock+out&pageSize=10`;
    const resp = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (resp.ok) {
      const data = await resp.json();
      // Parse onvista results if available
      if (data?.instruments) {
        for (const inst of data.instruments.slice(0, 8)) {
          products.push({
            type: inst.entityType?.includes("KNOCK") ? "KO-PUT" : "PUT-OS",
            wkn: inst.wkn || "---",
            isin: inst.isin || "---",
            name: inst.name || "---",
            emittent: extractEmittent(inst.name || ""),
            strike: "—",
            hebel: "—",
            bid: "—",
            ask: "—",
            laufzeit: "—",
            source: "onvista",
          });
        }
      }
    }
  } catch (err) {
    // onvista failed, continue with generated products
  }

  // If no real products found, generate realistic ones based on known emittents
  if (products.length === 0) {
    products.push(...generateRealisticProducts(ticker, currentPrice));
  }

  res.status(200).json({ ticker, products, time: new Date().toISOString() });
}

function extractEmittent(name) {
  const emittents = ["BNP", "SocGen", "HSBC", "Citi", "Goldman", "Morgan Stanley", "Vontobel", "UBS"];
  for (const e of emittents) {
    if (name.toLowerCase().includes(e.toLowerCase())) return e;
  }
  return "—";
}

function generateRealisticProducts(ticker, price) {
  // Generate realistic knock-out and put warrant products
  // These are EXAMPLES — user must verify WKN in Consorsbank before buying
  const emittents = [
    { name: "BNP Paribas", prefix: "PZ" },
    { name: "Société Générale", prefix: "SH" },
    { name: "HSBC", prefix: "HS" },
    { name: "Citi", prefix: "KG" },
    { name: "Goldman Sachs", prefix: "GK" },
    { name: "Vontobel", prefix: "VU" },
  ];

  const products = [];
  const strikes = [
    price * 1.05,
    price * 1.10,
    price * 1.15,
    price * 1.20,
  ];

  // Knock-Outs
  for (let i = 0; i < 3; i++) {
    const em = emittents[i % emittents.length];
    const strike = strikes[i];
    const hebel = Math.round((price / (strike - price)) * 10) / 10;
    const koPrice = Math.round((strike - price) / 10 * 100) / 100;
    const wkn = em.prefix + randomWKN();
    
    products.push({
      type: "KO-PUT",
      wkn,
      isin: "DE000" + wkn + "0",
      name: `${em.name} KO-Put ${ticker} ${strike.toFixed(0)}`,
      emittent: em.name,
      strike: strike.toFixed(2),
      hebel: Math.abs(hebel).toFixed(1),
      bid: koPrice.toFixed(2),
      ask: (koPrice + 0.02).toFixed(2),
      laufzeit: "Open-End",
      source: "generated",
      isExample: true,
    });
  }

  // Put Optionsscheine
  const months = ["Mär", "Jun", "Sep", "Dez"];
  for (let i = 0; i < 3; i++) {
    const em = emittents[(i + 3) % emittents.length];
    const strike = strikes[i];
    const timeValue = 0.3 + Math.random() * 0.5;
    const intrinsic = Math.max(0, strike - price) / 10;
    const osPrice = Math.round((intrinsic + timeValue) * 100) / 100;
    const wkn = em.prefix + randomWKN();
    const month = months[(new Date().getMonth() + 2 + i) % 4];
    const year = new Date().getFullYear() + (i > 1 ? 1 : 0);

    products.push({
      type: "PUT-OS",
      wkn,
      isin: "DE000" + wkn + "0",
      name: `${em.name} Put ${ticker} ${strike.toFixed(0)} ${month}${year}`,
      emittent: em.name,
      strike: strike.toFixed(2),
      hebel: (Math.abs(price / (osPrice * 10)) * (strike > price ? 1.5 : 0.8)).toFixed(1),
      bid: osPrice.toFixed(2),
      ask: (osPrice + 0.03).toFixed(2),
      laufzeit: `${month} ${year}`,
      source: "generated",
      isExample: true,
    });
  }

  return products;
}

function randomWKN() {
  const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
