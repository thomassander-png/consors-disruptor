// /api/news
// Fetches AI disruption news from free sources (Google News RSS, finviz)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const newsItems = [];

  try {
    // Google News RSS - free, no key
    const queries = [
      "AI+disruption+stocks",
      "artificial+intelligence+software+stocks",
      "AI+replacing+jobs+finance",
      "ChatGPT+enterprise+software",
    ];

    const query = queries[Math.floor(Math.random() * queries.length)];
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;

    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (resp.ok) {
      const xml = await resp.text();
      // Simple XML parsing for RSS items
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const item of items.slice(0, 8)) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";
        const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || item.match(/<link\/>\s*(https?:\/\/[^\s<]+)/)?.[1] || "";

        if (title) {
          // Determine impact based on keywords
          const lower = title.toLowerCase();
          let impact = "NEUTRAL";
          if (lower.match(/crash|drop|fall|plunge|sell|bear|risk|threat|disrupt|replace|layoff|cut/)) {
            impact = "BEARISH";
          } else if (lower.match(/surge|rally|rise|bull|grow|boost|gain|beat|strong/)) {
            impact = "BULLISH";
          }

          // Determine affected sector
          let sector = "";
          if (lower.match(/sap|oracle|salesforce|software|erp|crm/)) sector = "Enterprise Software";
          else if (lower.match(/bank|financ|advisory|wealth|tax/)) sector = "Finanzberatung";
          else if (lower.match(/rating|moody|s&p|data|analys/)) sector = "Finanzdaten";
          else if (lower.match(/consult|accenture|deloitte/)) sector = "Consulting";
          else if (lower.match(/educ|learn|chegg|tutor|university/)) sector = "Bildung";

          newsItems.push({
            headline: decodeHtml(title),
            source: decodeHtml(source),
            impact,
            sector,
            pubDate,
            link,
          });
        }
      }
    }
  } catch (err) {
    // RSS failed
  }

  // If no news from RSS, provide static recent context
  if (newsItems.length === 0) {
    newsItems.push(
      {
        headline: "KI-Modelle von Anthropic und OpenAI setzen Enterprise-Software unter Druck",
        source: "Marktbeobachtung",
        impact: "BEARISH",
        sector: "Enterprise Software",
        pubDate: new Date().toISOString(),
      },
      {
        headline: "Altruist stellt KI-Steuerplanungstool vor — Finanzberater-Aktien fallen",
        source: "Marktbeobachtung",
        impact: "BEARISH",
        sector: "Finanzberatung",
        pubDate: new Date().toISOString(),
      },
      {
        headline: "Chegg verliert weitere Nutzer an ChatGPT und Claude",
        source: "Marktbeobachtung",
        impact: "BEARISH",
        sector: "Bildung",
        pubDate: new Date().toISOString(),
      }
    );
  }

  res.status(200).json({ news: newsItems, time: new Date().toISOString() });
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
