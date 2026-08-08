import type { MarketMover, AssetClass, NewsArticle, TimeRange, ChartPoint, AssetFundamentals } from "../types";

// ─── In-memory cache ───
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function isCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/* ───── Time-to-live constants ───── */
const PRICE_TTL = 2 * 60 * 1000;       // 2 min for price data
const CHART_TTL = 5 * 60 * 1000;       // 5 min for charts
const NEWS_TTL = 10 * 60 * 1000;       // 10 min for news
const AI_TTL = 30 * 60 * 1000;         // 30 min for AI analysis

// ─── API Keys (from env vars, with fallbacks) ───
const FINNHUB_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FINNHUB_API_KEY) || "d28db1hr01qhg52rbmu0d28db1hr01qhg52rbmug";
const ALPHA_VANTAGE_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ALPHA_VANTAGE_API_KEY) || "J7YQ4V3X8M5Z1W2K";
const COINGECKO_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_COINGECKO_API_KEY) || "";
const NEWS_API_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_NEWS_API_KEY) || "";
const GROQ_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GROQ_API_KEY) || "";
const GEMINI_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) || "";

// ─── Symbol class mapping ───
const SYMBOL_CLASS_MAP: Record<string, AssetClass> = {
  AAPL: "stocks", MSFT: "stocks", GOOGL: "stocks", AMZN: "stocks",
  TSLA: "stocks", NVDA: "stocks", META: "stocks", JPM: "stocks",
  SPY: "sp500", IVV: "sp500", VOO: "sp500", QQQ: "sp500", DIA: "sp500",
  BTC: "crypto", ETH: "crypto", SOL: "crypto", XRP: "crypto", ADA: "crypto", DOGE: "crypto",
  PEPE: "meme_coins", WIF: "meme_coins", BONK: "meme_coins", FLOKI: "meme_coins",
  "EUR/USD": "forex", "GBP/USD": "forex", "USD/JPY": "forex", "USD/CHF": "forex", "AUD/USD": "forex", "USD/CAD": "forex",
  "GC=F": "commodities", "SI=F": "commodities", "CL=F": "commodities", "NG=F": "commodities", "HG=F": "commodities",
};

function getAssetClass(symbol: string): AssetClass {
  return SYMBOL_CLASS_MAP[symbol] || "stocks";
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. STOCK DATA — Finnhub (primary) + Alpha Vantage (fallback)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchStocksFromFinnhub(): Promise<MarketMover[]> {
  const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];
  const results: MarketMover[] = [];

  const promises = symbols.map(async (sym) => {
    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`),
      ]);
      if (!quoteRes.ok) return;
      const quote = await quoteRes.json();
      if (!profileRes.ok) return;
      const profile = await profileRes.json();

      if (quote.c && quote.pc) {
        results.push({
          symbol: sym,
          name: profile.name || sym,
          price: quote.c,
          change: quote.c - quote.pc,
          changePercent: quote.dp || ((quote.c - quote.pc) / quote.pc) * 100,
          volume: quote.t || 0,
          assetClass: "stocks",
        });
      }
    } catch { /* skip failed symbol */ }
  });

  await Promise.all(promises);
  return results;
}

async function fetchStocksFromAlphaVantage(): Promise<MarketMover[]> {
  const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];
  const names: Record<string, string> = { AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", GOOGL: "Alphabet Inc.", AMZN: "Amazon.com Inc.", TSLA: "Tesla Inc.", NVDA: "NVIDIA Corp.", META: "Meta Platforms", JPM: "JPMorgan Chase" };
  const results: MarketMover[] = [];

  for (const sym of symbols) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${ALPHA_VANTAGE_KEY}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const gq = data["Global Quote"];
      if (!gq || !gq["05. price"]) continue;

      const price = parseFloat(gq["05. price"]);
      const prevClose = parseFloat(gq["08. previous close"]) || price;
      const change = price - prevClose;

      results.push({
        symbol: sym,
        name: names[sym] || sym,
        price,
        change,
        changePercent: prevClose ? (change / prevClose) * 100 : 0,
        volume: parseInt(gq["06. volume"]) || 0,
        assetClass: "stocks",
      });
    } catch { /* skip */ }
    // Alpha Vantage free tier: 5 calls/min — add small delay
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. CRYPTO DATA — CoinGecko (primary)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchCryptoFromCoinGecko(): Promise<MarketMover[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (COINGECKO_KEY) headers["x-cg-pro-api-key"] = COINGECKO_KEY;

  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h",
    { headers }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();

  return data.map((c: any) => {
    const sym = c.symbol.toUpperCase();
    const isMeme = ["PEPE", "WIF", "BONK", "FLOKI", "DOGE", "SHIB", "MEME"].includes(sym);
    return {
      symbol: sym,
      name: c.name,
      price: c.current_price,
      change: c.current_price - (c.current_price / (1 + (c.price_change_percentage_24h || 0) / 100)),
      changePercent: c.price_change_percentage_24h || 0,
      volume: c.total_volume || 0,
      assetClass: (isMeme ? "meme_coins" : "crypto") as AssetClass,
    };
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. FOREX DATA — Frankfurter API (free, no key)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchForexFromFrankfurter(): Promise<MarketMover[]> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD,CAD");
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  const data = await res.json();

  const pairs: [string, string, string][] = [
    ["EUR", "EUR/USD", "Euro / US Dollar"],
    ["GBP", "GBP/USD", "British Pound / USD"],
    ["JPY", "USD/JPY", "US Dollar / Japanese Yen"],
    ["CHF", "USD/CHF", "US Dollar / Swiss Franc"],
    ["AUD", "AUD/USD", "Australian Dollar / USD"],
    ["CAD", "USD/CAD", "US Dollar / Canadian Dollar"],
  ];

  // Fetch previous day for change calculation
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];
  let prevRates: Record<string, number> = {};
  try {
    const prevRes = await fetch(`https://api.frankfurter.app/${yStr}?from=USD&to=EUR,GBP,JPY,CHF,AUD,CAD`);
    if (prevRes.ok) {
      const prevData = await prevRes.json();
      prevRates = prevData.rates || {};
    }
  } catch { /* no prev data */ }

  return pairs.map(([code, symbol, name]) => {
    const rate = data.rates[code];
    // For JPY, CHF, CAD: we invert (USD/JPY = 1/JPY rate)
    const price = ["JPY", "CHF", "CAD"].includes(code) ? 1 / rate : rate;
    const prevRate = prevRates[code];
    const prevPrice = prevRate ? (["JPY", "CHF", "CAD"].includes(code) ? 1 / prevRate : prevRate) : price;
    const change = price - prevPrice;
    return { symbol, name, price, change, changePercent: prevPrice ? (change / prevPrice) * 100 : 0, volume: 0, assetClass: "forex" as const };
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. S&P 500 / ETF — Finnhub quotes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchSP500FromFinnhub(): Promise<MarketMover[]> {
  const etfs = [
    { sym: "SPY", name: "SPDR S&P 500 ETF" },
    { sym: "QQQ", name: "Invesco QQQ Trust" },
    { sym: "DIA", name: "SPDR Dow Jones ETF" },
    { sym: "IVV", name: "iShares Core S&P 500 ETF" },
    { sym: "VOO", name: "Vanguard S&P 500 ETF" },
  ];
  const results: MarketMover[] = [];

  for (const etf of etfs) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${etf.sym}&token=${FINNHUB_KEY}`);
      if (!res.ok) continue;
      const q = await res.json();
      if (q.c && q.pc) {
        results.push({
          symbol: etf.sym, name: etf.name,
          price: q.c, change: q.c - q.pc,
          changePercent: q.dp || ((q.c - q.pc) / q.pc) * 100,
          volume: q.t || 0, assetClass: "sp500",
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. COMMODITIES — Alpha Vantage (primary)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchCommoditiesFromAV(): Promise<MarketMover[]> {
  const commodities = [
    { from: "XAU", to: "USD", sym: "GC=F", name: "Gold Futures" },
    { from: "XAG", to: "USD", sym: "SI=F", name: "Silver Futures" },
    { from: "XCU", to: "USD", sym: "HG=F", name: "Copper Futures" },
  ];
  const results: MarketMover[] = [];

  for (const c of commodities) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${c.from}&to_currency=${c.to}&apikey=${ALPHA_VANTAGE_KEY}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const rate = data["Realtime Currency Exchange Rate"];
      if (!rate) continue;
      const price = parseFloat(rate["5. Exchange Rate"]);
      results.push({ symbol: c.sym, name: c.name, price, change: 0, changePercent: 0, volume: 0, assetClass: "commodities" });
    } catch { /* skip */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. NEWS — NewsAPI.org
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchNewsFromAPI(): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const queries = [
    { q: "stocks OR stock market OR S&P 500 OR NASDAQ", symbols: ["SPY", "QQQ"] },
    { q: "bitcoin OR ethereum OR cryptocurrency", symbols: ["BTC", "ETH"] },
    { q: "forex OR currency OR dollar OR euro", symbols: ["EUR/USD"] },
    { q: "Federal Reserve OR interest rate OR inflation", symbols: ["SPY", "TLT"] },
  ];

  const allArticles: NewsArticle[] = [];

  for (const { q, symbols } of queries) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${NEWS_API_KEY}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.articles) continue;

      for (const a of data.articles) {
        if (!a.title || !a.description) continue;
        allArticles.push({
          id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: a.title,
          description: a.description,
          url: a.url || "#",
          source: a.source?.name || "Unknown",
          publishedAt: a.publishedAt || new Date().toISOString(),
          sentiment: "neutral" as const,
          relatedSymbols: symbols,
        });
      }
    } catch { /* skip */ }
    await new Promise((r) => setTimeout(r, 200));
  }

  return allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. PRICE HISTORY — Alpha Vantage
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchPriceHistoryFromAV(symbol: string, range: TimeRange): Promise<ChartPoint[]> {
  // Map TimeRange to Alpha Vantage function
  const isCrypto = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"].includes(symbol);
  const isForex = symbol.includes("/");
  
  let url: string;
  if (isCrypto) {
    const func = range === "1D" || range === "1W" ? "DIGITAL_CURRENCY_INTRADAY" : "DIGITAL_CURRENCY_DAILY";
    url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_KEY}`;
  } else if (isForex) {
    const [from, to] = symbol.split("/");
    url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=60min&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
  } else {
    const func = range === "1D" || range === "1W" ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY";
    const interval = range === "1D" ? "5min" : "60min";
    url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&interval=${interval}&outputsize=${range === "1M" || range === "3M" || range === "1Y" ? "full" : "compact"}&apikey=${ALPHA_VANTAGE_KEY}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const data = await res.json();

  // Parse time series data
  const timeSeriesKey = Object.keys(data).find((k) => k.includes("Time Series"));
  if (!timeSeriesKey) throw new Error("No time series data");

  const timeSeries = data[timeSeriesKey];
  const points: ChartPoint[] = [];
  const now = Date.now();
  let count = 0;
  const maxPoints = range === "1D" ? 78 : range === "1W" ? 168 : range === "1M" ? 30 : range === "3M" ? 90 : 365;

  for (const [dateStr, values] of Object.entries(timeSeries)) {
    if (count >= maxPoints) break;
    const v = values as Record<string, string>;
    const closeKey = Object.keys(v).find((k) => k.includes("close")) || Object.keys(v)[3];
    if (closeKey) {
      points.push({ date: new Date(dateStr).getTime(), price: parseFloat(v[closeKey]) });
    }
    count++;
  }

  return points.reverse();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. FUNDAMENTALS — Alpha Vantage OVERVIEW
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchFundamentalsFromAV(symbol: string): Promise<AssetFundamentals | null> {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d["Symbol"]) return null;

    const fundamentals: AssetFundamentals = {};
    if (d["MarketCapitalization"]) fundamentals.marketCap = parseInt(d["MarketCapitalization"]);
    if (d["PERatio"]) fundamentals.peRatio = parseFloat(d["PERatio"]);
    if (d["DividendYield"]) fundamentals.dividendYield = parseFloat(d["DividendYield"]) * 100;
    if (d["Beta"]) fundamentals.beta = parseFloat(d["Beta"]);
    if (d["Sector"]) fundamentals.sector = d["Sector"];
    return fundamentals;
  } catch {
    return null;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   9. AI — Groq (primary) + Gemini (fallback)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SYSTEM_PROMPT = `You are Sharpfunds AI, a knowledgeable financial data assistant embedded in the Sharpfunds platform. Your role is to help users understand market data, news context, and financial concepts.

CRITICAL RULES:
- NEVER provide specific buy/sell/hold recommendations
- NEVER predict specific price targets
- Always include "_Informational only. Not investment advice._" at the end of responses
- Be concise but informative (2-4 paragraphs max)
- Reference specific data points when available
- Explain financial concepts clearly
- If asked about personal trading decisions, redirect to licensed financial advisors
- You have access to real-time market data via the Sharpfunds platform
- Use markdown formatting for readability (**bold** key terms)
- Be conversational but professional`;

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  if (!GROQ_KEY) throw new Error("No Groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
}

async function callGemini(messages: { role: string; content: string }[]): Promise<string> {
  if (!GEMINI_KEY) throw new Error("No Gemini key");
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
}

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  try {
    return await callGroq(messages);
  } catch {
    try {
      return await callGemini(messages);
    } catch {
      return "I'm having trouble connecting to my AI backend right now. Please try again in a moment. _Informational only. Not investment advice._";
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PUBLIC API FUNCTIONS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function getTopMovers(assetClass?: AssetClass): Promise<MarketMover[]> {
  const cacheKey = `movers_${assetClass ?? "all"}`;
  const cached = isCached<MarketMover[]>(cacheKey);
  if (cached) return cached;

  try {
    let data: MarketMover[] = [];

    if (!assetClass || assetClass === "stocks") {
      try { data.push(...await fetchStocksFromFinnhub()); } catch { data.push(...await fetchStocksFromAlphaVantage()); }
    }
    if (!assetClass || assetClass === "crypto" || assetClass === "meme_coins") {
      try { data.push(...await fetchCryptoFromCoinGecko()); } catch { /* fallback handled by empty array */ }
    }
    if (!assetClass || assetClass === "forex") {
      try { data.push(...await fetchForexFromFrankfurter()); } catch { /* fallback */ }
    }
    if (!assetClass || assetClass === "sp500") {
      try { data.push(...await fetchSP500FromFinnhub()); } catch { /* fallback */ }
    }
    if (!assetClass || assetClass === "commodities") {
      try { data.push(...await fetchCommoditiesFromAV()); } catch { /* fallback */ }
    }

    if (assetClass && data.length > 0) {
      data = data.filter((d) => d.assetClass === assetClass);
    }

    if (data.length > 0) {
      setCache(cacheKey, data, PRICE_TTL);
      return data;
    }
  } catch (err) {
    console.warn("All price APIs failed, using static fallback:", err);
  }

  // Ultimate static fallback
  const fallbacks = {
    stocks: [
      { symbol: "AAPL", name: "Apple Inc.", price: 0, change: 0, changePercent: 0, volume: 0, assetClass: "stocks" as const },
      { symbol: "MSFT", name: "Microsoft Corp.", price: 0, change: 0, changePercent: 0, volume: 0, assetClass: "stocks" as const },
    ],
    crypto: [
      { symbol: "BTC", name: "Bitcoin", price: 0, change: 0, changePercent: 0, volume: 0, assetClass: "crypto" as const },
      { symbol: "ETH", name: "Ethereum", price: 0, change: 0, changePercent: 0, volume: 0, assetClass: "crypto" as const },
    ],
  };
  return assetClass ? (fallbacks as any)[assetClass] || [] : Object.values(fallbacks).flat();
}

export async function getAssetBySymbol(symbol: string): Promise<MarketMover | undefined> {
  const allMovers = await getTopMovers();
  return allMovers.find(
    (m) => m.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export async function getNews(): Promise<NewsArticle[]> {
  const cacheKey = "news_all";
  const cached = isCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    const articles = await fetchNewsFromAPI();
    if (articles.length > 0) {
      setCache(cacheKey, articles, NEWS_TTL);
      return articles;
    }
  } catch (err) {
    console.warn("News API failed:", err);
  }

  return [];
}

/* ───── AI Placard Commentary ───── */

export async function getAIPlacardCommentary(assetClass: AssetClass): Promise<string> {
  const cacheKey = `placard_${assetClass}`;
  const cached = isCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const movers = await getTopMovers(assetClass);
    const topGainers = [...movers].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const topLosers = [...movers].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

    const context = `Market movers for ${assetClass}:
Top gainers: ${topGainers.map((m) => `${m.symbol} +${m.changePercent.toFixed(2)}%`).join(", ")}
Top losers: ${topLosers.map((m) => `${m.symbol} ${m.changePercent.toFixed(2)}%`).join(", ")}`;

    const response = await callAI([
      { role: "user", content: `Give a brief 2-sentence market commentary for the ${assetClass} asset class based on current data. Be specific about names and numbers. ${context}` }
    ]);

    setCache(cacheKey, response, AI_TTL);
    return response;
  } catch {
    const fallbacks: Record<string, string> = {
      stocks: "Equity markets are showing mixed signals today with tech stocks leading on strong AI sentiment while traditional sectors await clearer rate guidance.",
      crypto: "Crypto markets are active with Bitcoin maintaining key support levels as institutional demand through ETFs continues to provide a structural bid.",
      forex: "Currency markets are driven by central bank policy divergence, with the dollar index reflecting shifting rate cut expectations across major economies.",
      sp500: "S&P 500 index ETFs are tracking broad market sentiment, with sector rotation between growth and value creating selective opportunities.",
      meme_coins: "Meme coin activity remains elevated, driven by social sentiment and community engagement rather than fundamental developments.",
      commodities: "Commodity markets are responding to geopolitical tensions and supply-demand dynamics, with precious metals benefiting from safe-haven flows.",
    };
    return fallbacks[assetClass] || "Markets are active. Monitor key levels and news flow for direction.",
  }
}

/* ───── Price History ───── */

export async function getPriceHistory(symbol: string, range: TimeRange): Promise<ChartPoint[]> {
  const cacheKey = `chart_${symbol}_${range}`;
  const cached = isCached<ChartPoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const points = await fetchPriceHistoryFromAV(symbol, range);
    if (points.length > 0) {
      setCache(cacheKey, points, CHART_TTL);
      return points;
    }
  } catch (err) {
    console.warn(`Price history fetch failed for ${symbol}:`, err);
  }

  // Generate deterministic fallback chart data
  const points: ChartPoint[] = [];
  const now = Date.now();
  const numPoints = range === "1D" ? 78 : range === "1W" ? 168 : range === "1M" ? 30 : range === "3M" ? 90 : 365;
  const intervalMs = range === "1D" ? 5 * 60 * 1000 : range === "1W" ? 60 * 60 * 1000 : range === "1M" ? 24 * 60 * 60 * 1000 : range === "3M" ? 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const mover = await getAssetBySymbol(symbol);
  const basePrice = mover?.price || 100;

  let price = basePrice;
  for (let i = 0; i < numPoints; i++) {
    const volatility = 0.003;
    price = price * (1 + (Math.sin(i * 0.1) * volatility));
    points.push({ date: now - (numPoints - i) * intervalMs, price });
  }
  return points;
}

/* ───── Key Stats ───── */

export async function getKeyStats(symbol: string): Promise<{ high52w: number; low52w: number; ma50: number; ma200: number } | null> {
  const cacheKey = `stats_${symbol}`;
  const cached = isCached<{ high52w: number; low52w: number; ma50: number; ma200: number }>(cacheKey);
  if (cached) return cached;

  try {
    const points = await getPriceHistory(symbol, "1Y");
    if (points.length < 10) return null;

    const prices = points.map((p) => p.price);
    const high52w = Math.max(...prices);
    const low52w = Math.min(...prices);

    const ma50 = prices.length >= 50
      ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50
      : prices.reduce((a, b) => a + b, 0) / prices.length;
    const ma200 = prices.length >= 200
      ? prices.slice(-200).reduce((a, b) => a + b, 0) / 200
      : ma50;

    const stats = { high52w, low52w, ma50, ma200 };
    setCache(cacheKey, stats, PRICE_TTL);
    return stats;
  } catch {
    return null;
  }
}

/* ───── Fundamentals ───── */

export async function getFundamentals(symbol: string): Promise<AssetFundamentals | null> {
  const cacheKey = `fundamentals_${symbol}`;
  const cached = isCached<AssetFundamentals>(cacheKey);
  if (cached) return cached;

  const assetClass = getAssetClass(symbol);
  if (assetClass === "forex" || assetClass === "meme_coins") return null;

  try {
    const data = await fetchFundamentalsFromAV(symbol);
    if (data) {
      setCache(cacheKey, data, PRICE_TTL);
      return data;
    }
  } catch { /* fallback */ }

  // For crypto, fetch from CoinGecko
  if (assetClass === "crypto") {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (COINGECKO_KEY) headers["x-cg-pro-api-key"] = COINGECKO_KEY;
      const idMap: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin" };
      const coinId = idMap[symbol];
      if (!coinId) return null;

      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`, { headers });
      if (!res.ok) return null;
      const d = await res.json();

      const fundamentals: AssetFundamentals = {
        marketCap: d.market_data?.market_cap?.usd,
        circulatingSupply: d.market_data?.circulating_supply,
        totalSupply: d.market_data?.total_supply,
        allTimeHigh: d.market_data?.ath?.usd,
      };
      setCache(cacheKey, fundamentals, PRICE_TTL);
      return fundamentals;
    } catch { /* fallback */ }
  }

  return null;
}

/* ───── Related News ───── */

export async function getAssetRelatedNews(symbol: string): Promise<NewsArticle[]> {
  const cacheKey = `news_${symbol}`;
  const cached = isCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    const allNews = await getNews();
    const related = allNews.filter(
      (a) => a.relatedSymbols?.some((s) => s.toLowerCase() === symbol.toLowerCase()) ||
        a.title.toLowerCase().includes(symbol.toLowerCase()) ||
        a.description.toLowerCase().includes(symbol.toLowerCase())
    );
    setCache(cacheKey, related, NEWS_TTL);
    return related;
  } catch {
    return [];
  }
}

/* ───── News AI Chat ───── */

export async function getNewsAIChatResponse(
  userMessage: string,
  userContext: {
    displayName: string;
    trackedAssets: { symbol: string; name: string; assetClass: string }[];
    riskTolerance: string;
    experienceLevel: string;
  },
  recentHeadlines: string[]
): Promise<string> {
  const contextStr = `
User: ${userContext.displayName}
Risk tolerance: ${userContext.riskTolerance}
Experience: ${userContext.experienceLevel}
Tracked assets: ${userContext.trackedAssets.map((a) => `${a.symbol} (${a.assetClass})`).join(", ")}
Recent headlines: ${recentHeadlines.slice(0, 5).join(" | ")}`;

  return callAI([
    { role: "user", content: `${contextStr}\n\nUser question: ${userMessage}` }
  ]);
}

/* ───── AI Synthesis ───── */

export async function getAISynthesis(symbol: string): Promise<string> {
  const cacheKey = `synthesis_${symbol}`;
  const cached = isCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const [mover, fundamentals, stats] = await Promise.all([
      getAssetBySymbol(symbol),
      getFundamentals(symbol),
      getKeyStats(symbol),
    ]);

    const dataContext = `
Asset: ${mover?.name || symbol} (${symbol})
Current Price: $${mover?.price?.toFixed(2) || "N/A"}
Daily Change: ${mover?.changePercent?.toFixed(2) || "N/A"}%
52-Week High: ${stats?.high52w?.toFixed(2) || "N/A"}
52-Week Low: ${stats?.low52w?.toFixed(2) || "N/A"}
MA50: ${stats?.ma50?.toFixed(2) || "N/A"}
MA200: ${stats?.ma200?.toFixed(2) || "N/A"}
Fundamentals: ${fundamentals ? JSON.stringify(fundamentals) : "N/A"}`;

    const response = await callAI([
      { role: "user", content: `Provide a comprehensive AI synthesis for this asset. Structure it as: **Performance drivers:** (key factors), **Key risks and headwinds:** (main concerns), **Forward-looking context:** (outlook). ${dataContext}` }
    ]);

    setCache(cacheKey, response, AI_TTL);
    return response;
  } catch {
    return `**Performance drivers:** ${symbol} is showing active trading with meaningful market participation. Sector-specific catalysts and broader macro conditions are contributing to current price action.

**Key risks and headwinds:** The primary risks include macro sensitivity to interest rate expectations and broader market liquidity conditions. Asset-specific factors present additional uncertainty.

**Forward-looking context:** ${symbol} trades within a broader market context that continues to evolve. The convergence of sector trends, capital flows, and macroeconomic factors will shape the medium-term trajectory. _Informational only. Not investment advice._`;
  }
}

/* ───── AI Chat (per-asset) ───── */

export async function getAIChatResponse(
  symbol: string,
  conversation: { role: string; content: string }[],
  question: string
): Promise<string> {
  try {
    const mover = await getAssetBySymbol(symbol);
    const context = `Chatting about ${mover?.name || symbol} (${symbol}), current price $${mover?.price?.toFixed(2) || "N/A"}, daily change ${mover?.changePercent?.toFixed(2) || "N/A"}%.`;

    const messages = [
      { role: "user", content: `${context}\n\nConversation so far: ${conversation.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nUser question: ${question}` }
    ];

    return await callAI(messages);
  } catch {
    return `Looking at ${symbol}, the current market data shows active trading. Key levels to monitor include recent support and resistance areas. _Informational only. Not investment advice._`;
  }
}

/* ───── Legacy AI Commentary (Global AI fallback) ───── */

export async function getAIResponse(
  message: string,
  userContext?: { trackedAssets: string[]; riskTolerance: string }
): Promise<string> {
  try {
    const contextStr = userContext
      ? `User tracks: ${userContext.trackedAssets.join(", ")}. Risk: ${userContext.riskTolerance}.`
      : "";
    return await callAI([
      { role: "user", content: `${contextStr} ${message}` }
    ]);
  } catch {
    return "I'm having trouble connecting right now. Please try again. _Informational only. Not investment advice._";
  }
}
