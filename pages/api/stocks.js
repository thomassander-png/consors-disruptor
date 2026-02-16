// /api/stocks?tickers=SAP,ORCL,CRM
// Yahoo Finance - free, no API key, includes 52-week data

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "tickers required" });

  const tickerList = tickers.split(",").map(t => t.trim().toUpperCase()).slice(0, 30);
  const results = [];

  // Batch fetch for speed
  const promises = tickerList.map(async (ticker) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
      if (!r.ok) {
        // Try .DE suffix
        const r2 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.DE?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (r2.ok) { const d = await r2.json(); return parseChart(d, ticker, "EUR"); }
        return { ticker, error: "not found" };
      }
      const d = await r.json();
      return parseChart(d, ticker, "USD");
    } catch (e) { return { ticker, error: e.message }; }
  });

  const settled = await Promise.all(promises);
  res.status(200).json({ stocks: settled.filter(Boolean), time: new Date().toISOString() });
}

function parseChart(data, ticker, defaultCurrency) {
  try {
    const meta = data.chart?.result?.[0]?.meta;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const highs = data.chart?.result?.[0]?.indicators?.quote?.[0]?.high || [];
    const lows = data.chart?.result?.[0]?.indicators?.quote?.[0]?.low || [];
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    const validCloses = closes.filter(c => c !== null);
    const high52 = meta.fiftyTwoWeekHigh || Math.max(...validCloses, price);
    const low52 = meta.fiftyTwoWeekLow || Math.min(...validCloses.filter(c => c > 0), price);
    const fromHigh = high52 ? ((price - high52) / high52) * 100 : 0;

    return {
      ticker, price: r(price), change: r(change),
      prevClose: r(prevClose || 0),
      high52: r(high52), low52: r(low52), fromHigh: r(fromHigh),
      currency: meta.currency || defaultCurrency,
      exchange: meta.exchangeName || "",
      marketState: meta.marketState || "",
      name: meta.shortName || meta.symbol || ticker,
      history: validCloses.slice(-20).map(r),
    };
  } catch { return null; }
}

function r(n) { return Math.round((n || 0) * 100) / 100; }
