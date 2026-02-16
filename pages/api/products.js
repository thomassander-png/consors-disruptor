// /api/products?ticker=SAP&price=198 — same as v1
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { ticker, price } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker required" });
  const p = parseFloat(price) || 100;
  const products = generateProducts(ticker, p);
  res.status(200).json({ ticker, products, time: new Date().toISOString() });
}

function generateProducts(ticker, price) {
  const ems = [
    { name: "BNP Paribas", pre: "PZ" }, { name: "Société Générale", pre: "SH" },
    { name: "HSBC", pre: "HS" }, { name: "Citi", pre: "KG" },
    { name: "Goldman Sachs", pre: "GK" }, { name: "Vontobel", pre: "VU" },
  ];
  const prods = [];
  // KO-Puts
  for (let i = 0; i < 3; i++) {
    const em = ems[i]; const strike = price * (1.05 + i * 0.05);
    const h = Math.abs(Math.round((price / (strike - price)) * 10) / 10);
    const pr = Math.round((strike - price) / 10 * 100) / 100;
    prods.push({ type: "KO-PUT", wkn: em.pre + rw(), emittent: em.name, strike: strike.toFixed(2), hebel: h.toFixed(1), bid: pr.toFixed(2), ask: (pr + .02).toFixed(2), laufzeit: "Open-End", isExample: true });
  }
  // Put-OS
  const ms = ["Mär", "Jun", "Sep", "Dez"];
  for (let i = 0; i < 2; i++) {
    const em = ems[i + 3]; const strike = price * (1.03 + i * 0.05);
    const pr = Math.round((0.3 + Math.random() * .5 + Math.max(0, strike - price) / 10) * 100) / 100;
    const m = ms[(new Date().getMonth() + 2 + i) % 4]; const y = new Date().getFullYear() + (i > 0 ? 1 : 0);
    prods.push({ type: "PUT-OS", wkn: em.pre + rw(), emittent: em.name, strike: strike.toFixed(2), hebel: (price / (pr * 10)).toFixed(1), bid: pr.toFixed(2), ask: (pr + .03).toFixed(2), laufzeit: `${m} ${y}`, isExample: true });
  }
  // Call-OS (for Buy-the-Dip)
  for (let i = 0; i < 2; i++) {
    const em = ems[(i + 2) % ems.length]; const strike = price * (0.95 - i * 0.05);
    const pr = Math.round((0.4 + Math.random() * .4 + Math.max(0, price - strike) / 10) * 100) / 100;
    const m = ms[(new Date().getMonth() + 3 + i) % 4]; const y = new Date().getFullYear() + (i > 0 ? 1 : 0);
    prods.push({ type: "CALL-OS", wkn: em.pre + rw(), emittent: em.name, strike: strike.toFixed(2), hebel: (price / (pr * 10)).toFixed(1), bid: pr.toFixed(2), ask: (pr + .03).toFixed(2), laufzeit: `${m} ${y}`, isExample: true });
  }
  return prods;
}

function rw() { const c = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; let r = ""; for (let i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
