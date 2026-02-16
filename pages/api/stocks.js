// /api/stocks?tickers=SAP,ORCL,CRM
// Fetches live prices from Yahoo Finance (free, no API key)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "tickers required" });

  const tickerList = tickers.split(",").map((t) => t.trim().toUpperCase());
  const results = [];

  for (const ticker of tickerList) {
    try {
      // Yahoo Finance v8 API - free, no key needed
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!resp.ok) {
        // Try with .DE suffix for German stocks
        const deUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.DE?interval=1d&range=5d`;
        const deResp = await fetch(deUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (deResp.ok) {
          const deData = await deResp.json();
          const parsed = parseYahooChart(deData, ticker);
          if (parsed) results.push({ ...parsed, currency: "EUR" });
          continue;
        }
        results.push({ ticker, error: "not found" });
        continue;
      }

      const data = await resp.json();
      const parsed = parseYahooChart(data, ticker);
      if (parsed) results.push(parsed);
      else results.push({ ticker, error: "parse error" });
    } catch (err) {
      results.push({ ticker, error: err.message });
    }
  }

  res.status(200).json({ stocks: results, time: new Date().toISOString() });
}

function parseYahooChart(data, ticker) {
  try {
    const meta = data.chart?.result?.[0]?.meta;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

    if (!meta || !closes) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    // Get 5-day history for mini chart
    const history = closes.filter((c) => c !== null);

    return {
      ticker,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      prevClose: Math.round((prevClose || 0) * 100) / 100,
      currency: meta.currency || "USD",
      exchange: meta.exchangeName || "",
      marketState: meta.marketState || "",
      history: history.slice(-5).map((h) => Math.round(h * 100) / 100),
    };
  } catch {
    return null;
  }
}
