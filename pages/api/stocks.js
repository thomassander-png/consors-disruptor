// /api/stocks?tickers=SAP,ORCL,CRM
// Yahoo Finance - Enhanced with fundamental data (P/E, Volume, MarketCap, EPS, Dividend)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "tickers required" });

  const tickerList = tickers.split(",").map(t => t.trim().toUpperCase()).slice(0, 30);

  const promises = tickerList.map(async (ticker) => {
    try {
      // Fetch chart data (price history)
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`;
      const chartResp = await fetch(chartUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });

      let chartData = null;
      let currency = "USD";

      if (chartResp.ok) {
        chartData = await chartResp.json();
      } else {
        // Try .DE suffix for German stocks
        const deResp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.DE?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (deResp.ok) { chartData = await deResp.json(); currency = "EUR"; }
      }

      if (!chartData) return { ticker, error: "not found" };

      // Fetch fundamental data (P/E, MarketCap, Volume, EPS, etc.)
      let fundamentals = {};
      try {
        const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,financialData,summaryDetail,earningsQuarterlyGrowth,calendarEvents`;
        const quoteResp = await fetch(quoteUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
        if (quoteResp.ok) {
          const quoteData = await quoteResp.json();
          const result = quoteData?.quoteSummary?.result?.[0];
          fundamentals = parseFundamentals(result);
        }
      } catch {}

      // Also try v6 quote for real-time basics
      let quoteBasics = {};
      try {
        const q6Url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${ticker}`;
        const q6Resp = await fetch(q6Url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (q6Resp.ok) {
          const q6Data = await q6Resp.json();
          const q = q6Data?.quoteResponse?.result?.[0];
          if (q) {
            quoteBasics = {
              pe: q.trailingPE || null,
              forwardPe: q.forwardPE || null,
              marketCap: q.marketCap || null,
              volume: q.regularMarketVolume || null,
              avgVolume: q.averageDailyVolume3Month || null,
              eps: q.epsTrailingTwelveMonths || null,
              dividendYield: q.dividendYield || null,
              earningsDate: q.earningsTimestamp ? new Date(q.earningsTimestamp * 1000).toISOString().split("T")[0] : null,
              shortRatio: q.shortRatio || null,
              analystRating: q.averageAnalystRating || null,
              targetPrice: q.targetMeanPrice || null,
              sector: q.sector || null,
              industry: q.industry || null,
            };
          }
        }
      } catch {}

      const parsed = parseChart(chartData, ticker, currency);
      if (!parsed) return { ticker, error: "parse error" };

      // Merge all data
      return {
        ...parsed,
        ...fundamentals,
        ...quoteBasics,
        // Override with best available data
        pe: quoteBasics.pe || fundamentals.pe || null,
        volume: quoteBasics.volume || fundamentals.volume || null,
        avgVolume: quoteBasics.avgVolume || fundamentals.avgVolume || null,
        marketCap: quoteBasics.marketCap || fundamentals.marketCap || null,
      };

    } catch (e) { return { ticker, error: e.message }; }
  });

  const settled = await Promise.all(promises);
  res.status(200).json({ stocks: settled.filter(Boolean), time: new Date().toISOString() });
}

function parseFundamentals(result) {
  if (!result) return {};
  const stats = result.defaultKeyStatistics || {};
  const fin = result.financialData || {};
  const summary = result.summaryDetail || {};
  const cal = result.calendarEvents || {};

  const val = (obj) => obj?.raw || obj?.fmt || null;

  // Next earnings date
  let nextEarnings = null;
  const earningsDates = cal?.earnings?.earningsDate;
  if (earningsDates && earningsDates.length > 0) {
    nextEarnings = earningsDates[0]?.fmt || null;
  }

  return {
    pe: val(summary.trailingPE),
    forwardPe: val(stats.forwardPE || summary.forwardPE),
    pegRatio: val(stats.pegRatio),
    priceToBook: val(stats.priceToBook),
    marketCap: val(summary.marketCap),
    enterpriseValue: val(stats.enterpriseValue),
    volume: val(summary.volume),
    avgVolume: val(summary.averageVolume),
    eps: val(stats.trailingEps),
    forwardEps: val(stats.forwardEps),
    dividendYield: val(summary.dividendYield),
    payoutRatio: val(summary.payoutRatio),
    beta: val(stats.beta),
    shortRatio: val(stats.shortRatio),
    shortPercentFloat: val(stats.shortPercentOfFloat),
    profitMargin: val(fin.profitMargins),
    revenueGrowth: val(fin.revenueGrowth),
    earningsGrowth: val(fin.earningsGrowth),
    operatingMargin: val(fin.operatingMargins),
    returnOnEquity: val(fin.returnOnEquity),
    debtToEquity: val(fin.debtToEquity),
    freeCashflow: val(fin.freeCashflow),
    targetPrice: val(fin.targetMeanPrice),
    analystRating: fin.recommendationKey || null,
    numberOfAnalysts: val(fin.numberOfAnalystOpinions),
    nextEarnings,
  };
}

function parseChart(data, ticker, defaultCurrency) {
  try {
    const meta = data.chart?.result?.[0]?.meta;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const volumes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.volume || [];
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    const validCloses = closes.filter(c => c !== null);
    const high52 = meta.fiftyTwoWeekHigh || Math.max(...validCloses, price);
    const low52 = meta.fiftyTwoWeekLow || Math.min(...validCloses.filter(c => c > 0), price);
    const fromHigh = high52 ? ((price - high52) / high52) * 100 : 0;

    // Volume from chart
    const validVolumes = volumes.filter(v => v !== null && v > 0);
    const lastVolume = validVolumes.length > 0 ? validVolumes[validVolumes.length - 1] : null;
    const avgVol = validVolumes.length > 0 ? Math.round(validVolumes.reduce((a,b) => a+b, 0) / validVolumes.length) : null;

    return {
      ticker, price: rd(price), change: rd(change),
      prevClose: rd(prevClose || 0),
      high52: rd(high52), low52: rd(low52), fromHigh: rd(fromHigh),
      currency: meta.currency || defaultCurrency,
      exchange: meta.exchangeName || "",
      marketState: meta.marketState || "",
      name: meta.shortName || meta.symbol || ticker,
      history: validCloses.slice(-20).map(rd),
      volume: lastVolume,
      avgVolume: avgVol,
    };
  } catch { return null; }
}

function rd(n) { return Math.round((n || 0) * 100) / 100; }
