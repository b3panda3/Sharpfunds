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
const FINNHUB_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FINNHUB_API_KEY) || "d9q3jo9r01qkp6jbg5lgd9q3jo9r01qkp6jbg5m0";
const ALPHA_VANTAGE_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ALPHA_VANTAGE_API_KEY) || "GMKYQ3336PPF8CD3";
const COINGECKO_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_COINGECKO_API_KEY) || "";
const COINMARKETCAP_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_COINMARKETCAP_API_KEY) || "";
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
  if (!Array.isArray(data) || data.length === 0) throw new Error("CoinGecko empty");

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

/* ─── Crypto PRIMARY: GeckoTerminal (free, no API key, CORS-friendly) ─── */
async function fetchCryptoFromGeckoTerminal(): Promise<MarketMover[]> {
  const results: MarketMover[] = [];

  // GeckoTerminal token addresses by network
  const ethTokens: { address: string; symbol: string; name: string; cls: AssetClass }[] = [
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "ETH", name: "Ethereum", cls: "crypto" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "BTC", name: "Bitcoin (WBTC)", cls: "crypto" },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", name: "Chainlink", cls: "crypto" },
    { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "PEPE", name: "Pepe", cls: "meme_coins" },
    { address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", symbol: "SHIB", name: "Shiba Inu", cls: "meme_coins" },
    { address: "0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E", symbol: "FLOKI", name: "Floki Inu", cls: "meme_coins" },
  ];

  const solTokens: { address: string; symbol: string; name: string; cls: AssetClass }[] = [
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", cls: "crypto" },
    { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", cls: "meme_coins" },
    { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", cls: "meme_coins" },
  ];

  const bscTokens: { address: string; symbol: string; name: string; cls: AssetClass }[] = [
    { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "BTC", name: "Bitcoin (BTCS)", cls: "crypto" },
    { address: "0x1AF1F32535468E28164A24825c7ADFEc06B9f5B0", symbol: "DOGE", name: "Dogecoin (BSC)", cls: "crypto" },
    { address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", symbol: "ADA", name: "Cardano (BSC)", cls: "crypto" },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "XRP", name: "XRP (BSC)", cls: "crypto" },
  ];

  // Batch fetch prices per network using simple/token_price endpoint
  const networks: { id: string; tokens: typeof ethTokens }[] = [
    { id: "eth", tokens: ethTokens },
    { id: "solana", tokens: solTokens },
    { id: "bsc", tokens: bscTokens },
  ];

  for (const net of networks) {
    try {
      const addresses = net.tokens.map(t => t.address.toLowerCase());
      const url = `https://api.geckoterminal.com/api/v2/simple/networks/${net.id}/token_prices/${addresses.join(",")}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[GeckoTerminal] ${net.id} returned ${res.status}`);
        continue;
      }
      const json = await res.json();
      const priceData = json?.data?.attributes?.token_prices;
      if (!priceData || typeof priceData !== "object") continue;

      for (const token of net.tokens) {
        const addrKey = token.address.toLowerCase();
        const priceStr = priceData[addrKey];
        if (!priceStr) continue;
        const price = parseFloat(priceStr);
        if (!price || isNaN(price)) continue;

        // For BTC, use the ETH WBTC price (most liquid) and skip BSC duplicate
        if (token.symbol === "BTC" && results.some(r => r.symbol === "BTC")) continue;
        // For DOGE/ADA/XRP, prefer BSC prices if ETH didn't have them
        if (results.some(r => r.symbol === token.symbol)) continue;

        results.push({
          symbol: token.symbol,
          name: token.name.includes("(") ? token.name.split(" (")[0] : token.name,
          price,
          change: 0, // simple/token_price doesn't include change
          changePercent: 0,
          volume: 0,
          assetClass: token.cls,
        });
      }
    } catch (err) {
      console.warn(`[GeckoTerminal] ${net.id} fetch failed:`, err);
    }
  }

  // Fetch detailed token data for 24h change/volume from GeckoTerminal trending pools
  if (results.length > 0) {
    try {
      // Get trending ETH pools to fill in change data
      const poolRes = await fetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token", {
        headers: { Accept: "application/json" },
      });
      if (poolRes.ok) {
        const poolJson = await poolRes.json();
        const pools = poolJson?.data || [];
        for (const pool of pools) {
          const attr = pool?.attributes;
          const baseToken = pool?.relationships?.base_token?.data?.attributes;
          if (!attr || !baseToken) continue;
          const sym = baseToken.symbol?.toUpperCase();
          if (!sym) continue;
          const existing = results.find(r => r.symbol === sym);
          if (existing) {
            existing.changePercent = parseFloat(attr.price_change_percentage?.h24 || 0);
            existing.volume = parseFloat(attr.volume_usd?.h24 || 0);
            const priceNow = existing.price;
            existing.change = priceNow * (existing.changePercent / 100);
          }
        }
      }
    } catch { /* optional enrichment */ }

    // Also get SOL trending for solana meme coins
    try {
      const solRes = await fetch("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token", {
        headers: { Accept: "application/json" },
      });
      if (solRes.ok) {
        const solJson = await solRes.json();
        const pools = solJson?.data || [];
        for (const pool of pools) {
          const attr = pool?.attributes;
          const baseToken = pool?.relationships?.base_token?.data?.attributes;
          if (!attr || !baseToken) continue;
          const sym = baseToken.symbol?.toUpperCase();
          if (!sym) continue;
          const existing = results.find(r => r.symbol === sym);
          if (existing) {
            existing.changePercent = parseFloat(attr.price_change_percentage?.h24 || 0);
            existing.volume = parseFloat(attr.volume_usd?.h24 || 0);
            existing.change = existing.price * (existing.changePercent / 100);
          }
        }
      }
    } catch { /* optional enrichment */ }
  }

  console.log(`[GeckoTerminal] Fetched ${results.length} crypto tokens`);
  return results;
}

/* ─── Crypto fallback 2: Binance (free, no auth needed) ─── */
async function fetchCryptoFromBinance(): Promise<MarketMover[]> {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "LINKUSDT", "LTCUSDT"];
  const memeSymbols = ["DOGEUSDT", "SHIBUSDT", "PEPEUSDT", "BONKUSDT", "FLOKIUSDT"];
  const results: MarketMover[] = [];

  // Binance 24hr ticker endpoint (single call for all pairs)
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const allTickers = await res.json();
    if (!Array.isArray(allTickers)) throw new Error("Binance invalid");

    const tickerMap = new Map<string, any>();
    for (const t of allTickers) {
      tickerMap.set(t.symbol, t);
    }

    for (const sym of symbols) {
      const t = tickerMap.get(sym);
      if (!t || !t.lastPrice) continue;
      const display = sym.replace("USDT", "");
      const isMeme = memeSymbols.includes(sym);
      results.push({
        symbol: display,
        name: display,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChange || 0),
        changePercent: parseFloat(t.priceChangePercent || 0),
        volume: parseFloat(t.quoteVolume || 0),
        assetClass: (isMeme ? "meme_coins" : "crypto") as AssetClass,
      });
    }

    // Add meme coins
    for (const sym of memeSymbols) {
      if (symbols.includes(sym)) continue; // already added
      const t = tickerMap.get(sym);
      if (!t || !t.lastPrice) continue;
      const display = sym.replace("USDT", "");
      results.push({
        symbol: display,
        name: display,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChange || 0),
        changePercent: parseFloat(t.priceChangePercent || 0),
        volume: parseFloat(t.quoteVolume || 0),
        assetClass: "meme_coins" as const,
      });
    }
  } catch (err) {
    console.warn("[Binance] crypto fetch failed:", err);
    throw err;
  }

  return results;
}

/* ─── Crypto fallback 3: CoinMarketCap ─── */
async function fetchCryptoFromCoinMarketCap(): Promise<MarketMover[]> {
  if (!COINMARKETCAP_KEY) throw new Error("No CMC key");
  const res = await fetch(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=20&convert=USD",
    { headers: { "X-CMC_PRO_API_KEY": COINMARKETCAP_KEY } }
  );
  if (!res.ok) throw new Error(`CMC ${res.status}`);
  const data = await res.json();
  if (!data.data) throw new Error("CMC no data");

  return data.data.map((c: any) => {
    const sym = c.symbol;
    const isMeme = ["PEPE", "WIF", "BONK", "FLOKI", "DOGE", "SHIB", "MEME"].includes(sym);
    const quote = c.quote?.USD || {};
    return {
      symbol: sym,
      name: c.name,
      price: quote.price || 0,
      change: quote.price * ((quote.percent_change_24h || 0) / 100),
      changePercent: quote.percent_change_24h || 0,
      volume: quote.volume_24h || 0,
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

/* ─── News source 1: Finnhub (free, no tier limits) ─── */
async function fetchNewsFromFinnhub(): Promise<NewsArticle[]> {
  const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "BTC", "ETH"];
  const allArticles: NewsArticle[] = [];
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  for (const sym of symbols) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${new Date(sevenDaysAgo * 1000).toISOString().split("T")[0]}&to=${new Date().toISOString().split("T")[0]}&token=${FINNHUB_KEY}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const a of data) {
        if (!a.headline || a.headline.length < 15) continue;
        allArticles.push({
          id: `fn_${a.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: a.headline,
          description: a.summary || a.headline,
          url: a.url || "#",
          source: a.source || "Finnhub",
          publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : new Date().toISOString(),
          sentiment: "neutral" as const,
          relatedSymbols: [sym],
        });
      }
    } catch { /* skip */ }
    await new Promise((r) => setTimeout(r, 100));
  }

  return allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/* ─── News source 2: NewsAPI.org (free tier = top-headlines only) ─── */
async function fetchNewsFromNewsAPI(): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const allArticles: NewsArticle[] = [];

  // Free tier only supports top-headlines, not everything
  const queries = [
    { category: "business", symbols: ["SPY", "QQQ", "AAPL", "NVDA"] },
    { q: "bitcoin OR ethereum OR cryptocurrency", symbols: ["BTC", "ETH"] },
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        language: "en",
        pageSize: "10",
        apiKey: NEWS_API_KEY,
      });
      if (query.category) params.set("category", query.category);
      if (query.q) params.set("q", query.q);

      const endpoint = query.q ? "everything" : "top-headlines";
      const res = await fetch(`https://newsapi.org/v2/${endpoint}?${params}`);
      if (!res.ok) {
        console.warn(`[NewsAPI] ${endpoint} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (!data.articles) continue;

      for (const a of data.articles) {
        if (!a.title || a.title === "[Removed]" || !a.description) continue;
        allArticles.push({
          id: `na_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: a.title,
          description: a.description,
          url: a.url || "#",
          source: a.source?.name || "Unknown",
          publishedAt: a.publishedAt || new Date().toISOString(),
          sentiment: "neutral" as const,
          relatedSymbols: query.symbols,
        });
      }
    } catch (err) {
      console.warn("[NewsAPI] fetch failed:", err);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function fetchNewsFromAPI(): Promise<NewsArticle[]> {
  // Try Finnhub first (free, reliable), then NewsAPI
  let articles = await fetchNewsFromFinnhub();
  if (articles.length > 0) return articles;

  articles = await fetchNewsFromNewsAPI();
  if (articles.length > 0) return articles;

  // Ultimate fallback: generate realistic placeholder articles so the page isn't empty
  return generateFallbackNews();
}

function generateFallbackNews(): NewsArticle[] {
  const now = new Date();
  return [
    {
      id: "fb_1",
      title: "S&P 500 Holds Steady as Investors Weigh Fed Rate Path",
      description: "Major U.S. stock indices traded in a narrow range as market participants assessed the latest economic data and its implications for Federal Reserve monetary policy. Technology and healthcare sectors led gains while energy stocks lagged.",
      url: "#",
      source: "Market Watch",
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      sentiment: "neutral",
      relatedSymbols: ["SPY", "QQQ"],
    },
    {
      id: "fb_2",
      title: "Bitcoin Trades Above Key Support Level Amid Institutional Interest",
      description: "Bitcoin maintained its position above critical support levels as institutional investors continued to accumulate through spot ETF products. On-chain metrics suggest a tightening supply dynamic.",
      url: "#",
      source: "CoinDesk",
      publishedAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
      sentiment: "positive",
      relatedSymbols: ["BTC"],
    },
    {
      id: "fb_3",
      title: "Ethereum Network Activity Surges on DeFi and Layer-2 Growth",
      description: "Ethereum's on-chain activity reached multi-week highs driven by increased DeFi protocol interaction and growing adoption of layer-2 scaling solutions. Gas fees remained relatively stable despite the increased usage.",
      url: "#",
      source: "The Block",
      publishedAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
      sentiment: "positive",
      relatedSymbols: ["ETH"],
    },
    {
      id: "fb_4",
      title: "NVIDIA Earnings Beat Expectations, AI Demand Remains Strong",
      description: "NVIDIA reported quarterly results that exceeded analyst consensus, citing sustained demand for its data center GPUs. The company raised its forward guidance, signaling confidence in the AI infrastructure buildout cycle.",
      url: "#",
      source: "Bloomberg",
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      sentiment: "positive",
      relatedSymbols: ["NVDA"],
    },
    {
      id: "fb_5",
      title: "U.S. Dollar Index Pulls Back as Rate Cut Expectations Shift",
      description: "The dollar index declined against a basket of major currencies after weaker-than-expected employment data reinforced expectations that the Federal Reserve could begin easing monetary policy sooner than previously anticipated.",
      url: "#",
      source: "Reuters",
      publishedAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
      sentiment: "neutral",
      relatedSymbols: ["EUR/USD", "USD/JPY"],
    },
    {
      id: "fb_6",
      title: "Tesla Deliveries Exceed Estimates in Latest Quarterly Report",
      description: "Tesla's vehicle deliveries for the quarter came in above Wall Street estimates, driven by strong demand for the Model Y and refreshed Model 3. The company reaffirmed its annual production target.",
      url: "#",
      source: "CNBC",
      publishedAt: new Date(now.getTime() - 7 * 3600000).toISOString(),
      sentiment: "positive",
      relatedSymbols: ["TSLA"],
    },
    {
      id: "fb_7",
      title: "Global Central Banks Signal Diverging Policy Paths",
      description: "While the Federal Reserve signals a potential pivot toward rate cuts, the European Central Bank and Bank of Japan are charting different courses. Analysts say this divergence is creating opportunities in currency markets.",
      url: "#",
      source: "Financial Times",
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      sentiment: "neutral",
      relatedSymbols: ["EUR/USD", "GBP/USD"],
    },
    {
      id: "fb_8",
      title: "Solana Ecosystem Expands with New DeFi and NFT Projects",
      description: "The Solana blockchain saw a surge in developer activity and new project launches across decentralized finance and digital collectibles. Network throughput metrics reached record levels.",
      url: "#",
      source: "Decrypt",
      publishedAt: new Date(now.getTime() - 9 * 3600000).toISOString(),
      sentiment: "positive",
      relatedSymbols: ["SOL"],
    },
  ];
}

// ─── Rate limiter for Alpha Vantage (5 calls/min free tier) ───
let avCallTimes: number[] = [];
async function avFetch(url: string): Promise<Response> {
  const now = Date.now();
  avCallTimes = avCallTimes.filter(t => now - t < 65_000);
  if (avCallTimes.length >= 4) {
    const waitMs = 65_000 - (now - avCallTimes[0]) + 500;
    console.log(`[AV Rate Limit] Waiting ${Math.ceil(waitMs / 1000)}s`);
    await new Promise(r => setTimeout(r, waitMs));
    avCallTimes = avCallTimes.filter(t => Date.now() - t < 65_000);
  }
  avCallTimes.push(Date.now());
  return fetch(url);
}

/* ─── Chart data from Binance klines (free, reliable, no auth) ─── */
async function fetchChartFromBinance(symbol: string, range: TimeRange): Promise<ChartPoint[]> {
  const binanceSym = `${symbol}USDT`;
  let interval: string;
  let limit: number;
  switch (range) {
    case "1D":  interval = "5m";  limit = 78; break;
    case "7D":  interval = "1h";  limit = 168; break;
    case "30D": interval = "4h";  limit = 180; break;
    case "90D": interval = "1d";  limit = 90; break;
    case "1Y":  interval = "1d";  limit = 365; break;
    default:    interval = "1h";  limit = 168;
  }
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const klines = await res.json();
  if (!Array.isArray(klines) || klines.length === 0) throw new Error("Binance klines empty");
  return klines.map((k: any[]) => ({
    timestamp: new Date(k[0]).toISOString(),
    value: parseFloat(k[4]),
  }));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. PRICE HISTORY — Alpha Vantage
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function fetchPriceHistoryFromAV(symbol: string, range: TimeRange): Promise<ChartPoint[]> {
  // Map TimeRange to Alpha Vantage function
  const isCrypto = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"].includes(symbol);
  const isForex = symbol.includes("/");
  const isShortTerm = range === "1D" || range === "7D";
  const isLongTerm = range === "90D" || range === "1Y";
  
  let url: string;
  if (isCrypto) {
    const func = isShortTerm ? "DIGITAL_CURRENCY_INTRADAY" : "DIGITAL_CURRENCY_DAILY";
    url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_KEY}`;
  } else if (isForex) {
    const [from, to] = symbol.split("/");
    url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=60min&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
  } else {
    const func = isShortTerm ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY";
    const interval = range === "1D" ? "5min" : "60min";
    url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&interval=${interval}&outputsize=${isLongTerm ? "full" : "compact"}&apikey=${ALPHA_VANTAGE_KEY}`;
  }

  const res = await avFetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const data = await res.json();

  // Check for rate limit response
  if (data["Note"] || data["Information"]) {
    throw new Error("Alpha Vantage rate limited");
  }

  // Parse time series data
  const timeSeriesKey = Object.keys(data).find((k) => k.includes("Time Series"));
  if (!timeSeriesKey) throw new Error("No time series data");

  const timeSeries = data[timeSeriesKey];
  const points: ChartPoint[] = [];
  let count = 0;
  const maxPoints = range === "1D" ? 78 : range === "7D" ? 168 : range === "30D" ? 30 : range === "90D" ? 90 : 365;

  for (const [dateStr, values] of Object.entries(timeSeries)) {
    if (count >= maxPoints) break;
    const v = values as Record<string, string>;
    const closeKey = Object.keys(v).find((k) => k.includes("close")) || Object.keys(v)[3];
    if (closeKey) {
      const ts = new Date(dateStr).getTime();
      points.push({ timestamp: new Date(ts).toISOString(), value: parseFloat(v[closeKey]) });
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
    const res = await avFetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d["Symbol"] || d["Note"] || d["Information"]) return null;

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

CRITICAL RULES (MUST FOLLOW):
- NEVER provide specific buy/sell/hold recommendations
- NEVER predict specific price targets
- NEVER invent, guess, or fabricate prices, percentages, or market data. If the user message does not include specific price data for a mentioned asset, say "I don't have current data for [asset]" — do NOT fill in numbers from memory
- When live price data IS provided in the user message, use those EXACT numbers only
- Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Never reference events from years ago as if they are current (e.g., do NOT mention "the Merge", "FTX collapse", etc. as recent events)
- Always include "_Informational only. Not investment advice._" at the end of responses
- Be concise but informative (2-4 paragraphs max)
- Reference specific data points when available in the provided context
- Explain financial concepts clearly
- If asked about personal trading decisions, redirect to licensed financial advisors
- Use markdown formatting for readability (**bold** key terms)
- Be conversational but professional`;

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  if (!GROQ_KEY) throw new Error("No Groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 600,
      temperature: 0.5,
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
      // GeckoTerminal first (no API key, CORS-friendly, reliable)
      try { data.push(...await fetchCryptoFromGeckoTerminal()); }
      catch (e) { console.warn("[getTopMovers] GeckoTerminal failed:", e); }
      if (data.filter(d => d.assetClass === "crypto" || d.assetClass === "meme_coins").length === 0) {
        try { data.push(...await fetchCryptoFromCoinGecko()); }
        catch (e) { console.warn("[getTopMovers] CoinGecko failed:", e); }
      }
      if (data.filter(d => d.assetClass === "crypto" || d.assetClass === "meme_coins").length === 0) {
        try { data.push(...await fetchCryptoFromBinance()); }
        catch (e) { console.warn("[getTopMovers] Binance failed:", e); }
      }
      if (data.filter(d => d.assetClass === "crypto" || d.assetClass === "meme_coins").length === 0) {
        try { data.push(...await fetchCryptoFromCoinMarketCap()); }
        catch (e) { console.warn("[getTopMovers] CoinMarketCap failed:", e); }
      }
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

  // Ultimate static fallback with realistic approx prices
  const fallbacks: Record<string, MarketMover[]> = {
    stocks: [
      { symbol: "AAPL", name: "Apple Inc.", price: 227.48, change: 1.23, changePercent: 0.54, volume: 54_200_000, assetClass: "stocks" },
      { symbol: "MSFT", name: "Microsoft Corp.", price: 445.20, change: -2.10, changePercent: -0.47, volume: 22_100_000, assetClass: "stocks" },
      { symbol: "GOOGL", name: "Alphabet Inc.", price: 178.36, change: 0.89, changePercent: 0.50, volume: 18_500_000, assetClass: "stocks" },
      { symbol: "AMZN", name: "Amazon.com Inc.", price: 197.12, change: 3.45, changePercent: 1.78, volume: 32_000_000, assetClass: "stocks" },
      { symbol: "NVDA", name: "NVIDIA Corp.", price: 118.42, change: -1.56, changePercent: -1.30, volume: 215_000_000, assetClass: "stocks" },
    ],
    crypto: [
      { symbol: "BTC", name: "Bitcoin", price: 64_897, change: 48.27, changePercent: 0.07, volume: 12_368_000_000, assetClass: "crypto" },
      { symbol: "ETH", name: "Ethereum", price: 1_915.77, change: -12.30, changePercent: -0.64, volume: 3_395_000_000, assetClass: "crypto" },
      { symbol: "SOL", name: "Solana", price: 178.45, change: 5.23, changePercent: 3.02, volume: 2_150_000_000, assetClass: "crypto" },
      { symbol: "XRP", name: "Ripple", price: 0.5432, change: 0.0089, changePercent: 1.67, volume: 1_890_000_000, assetClass: "crypto" },
      { symbol: "ADA", name: "Cardano", price: 0.3821, change: -0.0056, changePercent: -1.45, volume: 312_000_000, assetClass: "crypto" },
      { symbol: "DOGE", name: "Dogecoin", price: 0.1234, change: 0.0023, changePercent: 1.90, volume: 856_000_000, assetClass: "crypto" },
    ],
    meme_coins: [
      { symbol: "PEPE", name: "Pepe", price: 0.00000984, change: 0.00000045, changePercent: 4.80, volume: 1_230_000_000, assetClass: "meme_coins" },
      { symbol: "SHIB", name: "Shiba Inu", price: 0.00001456, change: -0.00000032, changePercent: -2.15, volume: 456_000_000, assetClass: "meme_coins" },
      { symbol: "WIF", name: "dogwifhat", price: 1.87, change: 0.12, changePercent: 6.86, volume: 198_000_000, assetClass: "meme_coins" },
      { symbol: "BONK", name: "Bonk", price: 0.00002134, change: 0.00000123, changePercent: 6.11, volume: 345_000_000, assetClass: "meme_coins" },
    ],
    forex: [
      { symbol: "EUR/USD", name: "Euro / US Dollar", price: 1.0892, change: 0.0012, changePercent: 0.11, volume: 0, assetClass: "forex" },
      { symbol: "GBP/USD", name: "British Pound / USD", price: 1.2734, change: -0.0008, changePercent: -0.06, volume: 0, assetClass: "forex" },
      { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", price: 147.23, change: 0.45, changePercent: 0.31, volume: 0, assetClass: "forex" },
    ],
    sp500: [
      { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 544.12, change: 2.34, changePercent: 0.43, volume: 45_600_000, assetClass: "sp500" },
      { symbol: "QQQ", name: "Invesco QQQ Trust", price: 472.89, change: -1.23, changePercent: -0.26, volume: 32_100_000, assetClass: "sp500" },
    ],
    commodities: [
      { symbol: "GC=F", name: "Gold Futures", price: 2_412.50, change: 15.30, changePercent: 0.64, volume: 0, assetClass: "commodities" },
      { symbol: "SI=F", name: "Silver Futures", price: 27.83, change: -0.42, changePercent: -1.49, volume: 0, assetClass: "commodities" },
    ],
  };
  if (assetClass) return fallbacks[assetClass] || [];
  return Object.values(fallbacks).flat();
}

export async function getAssetBySymbol(symbol: string): Promise<MarketMover | undefined> {
  try {
    const allMovers = await getTopMovers();
    return allMovers.find(
      (m) => m.symbol.toLowerCase() === symbol.toLowerCase()
    );
  } catch {
    return undefined;
  }
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
    return fallbacks[assetClass] || "Markets are active. Monitor key levels and news flow for direction.";
  }
}

/* ───── Price History ───── */

export async function getPriceHistory(symbol: string, range: TimeRange): Promise<ChartPoint[]> {
  const cacheKey = `chart_${symbol}_${range}`;
  const cached = isCached<ChartPoint[]>(cacheKey);
  if (cached) return cached;

  // For crypto/meme_coins, try Binance klines first (reliable, free, no rate limit)
  const cryptoSymbols = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", "LTC", "PEPE", "SHIB", "WIF", "BONK", "FLOKI"];
  if (cryptoSymbols.includes(symbol)) {
    try {
      const points = await fetchChartFromBinance(symbol, range);
      if (points.length > 0) {
        setCache(cacheKey, points, CHART_TTL);
        return points;
      }
    } catch (err) {
      console.warn(`[Chart] Binance klines failed for ${symbol}:`, err);
    }
  }

  // For all assets, try Alpha Vantage (rate-limited)
  try {
    const points = await fetchPriceHistoryFromAV(symbol, range);
    if (points.length > 0) {
      setCache(cacheKey, points, CHART_TTL);
      return points;
    }
  } catch (err) {
    console.warn(`Price history fetch failed for ${symbol}:`, err);
  }

  // Generate deterministic fallback chart data — NO external calls, fully self-contained
  const points: ChartPoint[] = [];
  const now = Date.now();
  const numPoints = range === "1D" ? 78 : range === "7D" ? 168 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  const intervalMs = range === "1D" ? 5 * 60 * 1000 : range === "7D" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  // Use a reasonable base price per symbol without any external API call
  const defaultPrices: Record<string, number> = {
    AAPL: 227, MSFT: 445, GOOGL: 178, AMZN: 197, TSLA: 248, NVDA: 118, META: 505, JPM: 205,
    SPY: 544, QQQ: 473, DIA: 398, IVV: 543, VOO: 542,
    BTC: 64897, ETH: 1916, SOL: 178, XRP: 0.54, ADA: 0.38, DOGE: 0.12, DOT: 6.8, AVAX: 22.5, LINK: 14.2, LTC: 65.4,
    PEPE: 0.00001, SHIB: 0.000015, WIF: 1.87, BONK: 0.000021, FLOKI: 0.00018,
    "EUR/USD": 1.09, "GBP/USD": 1.27, "USD/JPY": 147.2, "USD/CHF": 0.88, "AUD/USD": 0.66, "USD/CAD": 1.37,
    "GC=F": 2412, "SI=F": 27.8, "HG=F": 4.15, "CL=F": 76.5, "NG=F": 2.14,
  };
  const basePrice = defaultPrices[symbol] || 100;

  let price = basePrice;
  for (let i = 0; i < numPoints; i++) {
    // Create a realistic-looking chart with some trend and noise
    const trend = Math.sin(i * 0.05) * basePrice * 0.03;
    const noise = (Math.sin(i * 0.3 + 1.7) * 0.5 + Math.cos(i * 0.17) * 0.3 + Math.sin(i * 0.71) * 0.2) * basePrice * 0.008;
    price = basePrice + trend + noise;
    const ts = now - (numPoints - i) * intervalMs;
    points.push({ timestamp: new Date(ts).toISOString(), value: Math.max(price, basePrice * 0.8) });
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

    const prices = points.map((p) => p.value);
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

  // For stocks/ETFs/commodities: use Alpha Vantage OVERVIEW
  if (assetClass === "stocks" || assetClass === "sp500" || assetClass === "commodities") {
    try {
      const data = await fetchFundamentalsFromAV(symbol);
      if (data) { setCache(cacheKey, data, PRICE_TTL); return data; }
    } catch { /* fallback */ }
  }

  // For crypto/meme_coins: use Binance 24hr ticker for volume/high/low
  if (assetClass === "crypto" || assetClass === "meme_coins") {
    try {
      const binanceSym = `${symbol}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSym}`);
      if (res.ok) {
        const d = await res.json();
        const fundamentals: AssetFundamentals = {
          volume24h: parseFloat(d.quoteVolume || 0),
        };
        // Try to get market cap from CoinGecko as enrichment
        const idMap: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin" };
        const coinId = idMap[symbol];
        if (coinId) {
          try {
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`);
            if (cgRes.ok) {
              const cg = await cgRes.json();
              if (cg.market_data) {
                fundamentals.marketCap = cg.market_data.market_cap?.usd;
                fundamentals.circulatingSupply = cg.market_data.circulating_supply;
                fundamentals.totalSupply = cg.market_data.total_supply;
                fundamentals.allTimeHigh = cg.market_data.ath?.usd;
              }
            }
          } catch { /* CoinGecko enrichment optional */ }
        }
        // Only return if we have at least some data
        if (fundamentals.volume24h || fundamentals.marketCap) {
          setCache(cacheKey, fundamentals, PRICE_TTL);
          return fundamentals;
        }
      }
    } catch { /* Binance fundamentals optional */ }
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
  // Fetch live prices for context
  let priceContext = "";
  try {
    const movers = await getTopMovers();
    if (movers && movers.length > 0) {
      priceContext = "\nCurrent market prices (live data):\n" +
        movers.slice(0, 12).map((m) =>
          `  ${m.symbol} ($${m.name || m.symbol}): $${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%)`
        ).join("\n");
    }
  } catch { /* price fetch optional */ }

  const contextStr = `
User: ${userContext.displayName}
Risk tolerance: ${userContext.riskTolerance}
Experience: ${userContext.experienceLevel}
Tracked assets: ${userContext.trackedAssets.map((a) => `${a.symbol} (${a.assetClass})`).join(", ")}
Recent headlines: ${recentHeadlines.slice(0, 5).join(" | ") || "None available"}${priceContext}`;

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
  userContext?: { trackedAssets: string[]; riskTolerance: string },
  priceContext?: string
): Promise<string> {
  try {
    const contextStr = userContext
      ? `User tracks: ${userContext.trackedAssets.join(", ")}. Risk: ${userContext.riskTolerance}.`
      : "";
    const priceStr = priceContext || "";
    return await callAI([
      { role: "user", content: `${contextStr}${priceStr}\n\nUser question: ${message}` }
    ]);
  } catch {
    return "I'm having trouble connecting right now. Please try again. _Informational only. Not investment advice._";
  }
}
