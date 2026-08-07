import { FALLBACK_STOCKS, FALLBACK_CRYPTO, FALLBACK_MEME, FALLBACK_FOREX, FALLBACK_SP500, FALLBACK_COMMODITIES, FALLBACK_NEWS } from "./fallback";
import type { MarketMover, AssetClass, NewsArticle, TimeRange, ChartPoint, AssetFundamentals } from "../types";

// In-memory cache for the frontend
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

/* ───── Price Data (cached 5 min) ───── */
const PRICE_TTL = 5 * 60 * 1000;

export async function getTopMovers(assetClass?: AssetClass): Promise<MarketMover[]> {
  const cacheKey = `movers_${assetClass ?? "all"}`;
  const cached = isCached<MarketMover[]>(cacheKey);
  if (cached) return cached;

  // Simulate API delay
  await new Promise((r) => setTimeout(r, 200));

  let data: MarketMover[];
  switch (assetClass) {
    case "stocks":
      data = FALLBACK_STOCKS;
      break;
    case "crypto":
      data = FALLBACK_CRYPTO;
      break;
    case "meme_coins":
      data = FALLBACK_MEME;
      break;
    case "forex":
      data = FALLBACK_FOREX;
      break;
    case "sp500":
      data = FALLBACK_SP500;
      break;
    case "commodities":
      data = FALLBACK_COMMODITIES;
      break;
    default:
      data = [...FALLBACK_STOCKS, ...FALLBACK_CRYPTO, ...FALLBACK_FOREX, ...FALLBACK_SP500, ...FALLBACK_COMMODITIES];
  }

  // Sort by absolute change percent descending
  setCache(cacheKey, data, PRICE_TTL);
  return [...data].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

export async function getAssetBySymbol(symbol: string): Promise<MarketMover | null> {
  const cacheKey = `asset_${symbol}`;
  const cached = isCached<MarketMover>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 150));

  const all = [...FALLBACK_STOCKS, ...FALLBACK_CRYPTO, ...FALLBACK_MEME, ...FALLBACK_FOREX, ...FALLBACK_SP500, ...FALLBACK_COMMODITIES];
  const asset = all.find((a) => a.symbol === symbol) ?? null;
  if (asset) setCache(cacheKey, asset, PRICE_TTL);
  return asset;
}

/* ───── News (cached 30 min) ───── */
const NEWS_TTL = 30 * 60 * 1000;

export async function getNews(): Promise<NewsArticle[]> {
  const cacheKey = "news";
  const cached = isCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 300));

  setCache(cacheKey, FALLBACK_NEWS, NEWS_TTL);
  return FALLBACK_NEWS;
}

/* ───── Placard Commentary (per-asset, cached 5 min) ───── */

const commentaryCache = new Map<string, { text: string; expiresAt: number }>();

export async function getAIPlacardCommentary(symbol: string): Promise<string> {
  const cached = commentaryCache.get(symbol);
  if (cached && Date.now() < cached.expiresAt) return cached.text;

  // Simulate AI delay
  await new Promise((r) => setTimeout(r, 200));

  const commentaries: Record<string, string> = {
    AAPL: "Strong momentum from services revenue growth, offsetting modest iPhone sales. Institutional buying noted.",
    MSFT: "Cloud revenue continues to drive growth. Azure market share gains supporting the bullish narrative.",
    GOOGL: "Advertising revenue resilient. AI infrastructure investments creating long-term value catalysts.",
    AMZN: "E-commerce margins improving. AWS growth stable with enterprise AI adoption accelerating.",
    TSLA: "Delivery numbers beating estimates. Energy storage division emerging as a significant profit center.",
    NVDA: "Data center demand surging. Next-gen GPU cycle expected to drive another record quarter.",
    META: "Reels monetization improving. Cost discipline yielding strong free cash flow generation.",
    JPM: "Net interest margin holding steady. Investment banking fees recovering faster than expected.",
    BTC: "ETF inflows driving supply shock dynamics. Institutional adoption continuing to accelerate.",
    ETH: "Layer-2 ecosystem maturing. Staking yields attracting long-term holders despite short-term volatility.",
    SOL: "Network activity surging. DeFi TVL growing at a faster pace than competitors this quarter.",
    XRP: "Regulatory clarity improving sentiment. Cross-border payment partnerships expanding steadily.",
    ADA: "Network upgrades driving developer activity. Staking participation rate reaching new highs.",
    DOGE: "Meme-driven volatility persists. Payment integration speculation fueling intermittent rallies.",
    "GC=F": "Safe-haven demand strengthening amid geopolitical uncertainty. Central bank buying robust.",
    "SI=F": "Industrial demand from solar manufacturing supporting prices. Silver lagging gold's rally.",
    "CL=F": "OPEC+ production decisions creating uncertainty. Demand growth forecasts being revised lower.",
    "NG=F": "Seasonal demand patterns driving near-term price action. Storage levels above 5-year average.",
    "EUR/USD": "Rate differential narrowing. ECB policy divergence with Fed shaping the pair's trajectory.",
    "GBP/USD": "UK economic data improving. Services PMI beating expectations, supporting sterling strength.",
    SPY: "Broad market rally led by tech. Rate cut expectations supporting multiple expansion across sectors.",
    QQQ: "Tech-heavy index benefiting from AI enthusiasm. Earnings revision breadth turning positive.",
  };

  const text =
    commentaries[symbol] ??
    `${symbol} showing active price discovery with above-average volume. Sector rotation creating pockets of opportunity. Informational only. Not investment advice.`;

  commentaryCache.set(symbol, { text, expiresAt: Date.now() + 5 * 60 * 1000 });
  return text;
}

/* ───── Price History (per asset, per range) ───── */

function generateMockPrices(basePrice: number, days: number, volatility: number, symbolSeed: number): { timestamp: string; value: number }[] {
  const points: { timestamp: string; value: number }[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    // Deterministic-ish walk
    const drift = (symbolSeed % 7) * 0.001 - 0.003;
    const shock = (Math.sin(i * 1.7 + symbolSeed) * 0.5 + Math.cos(i * 0.3 + symbolSeed * 2) * 0.5) * volatility;
    price = price * (1 + drift + shock);
    if (price < basePrice * 0.5) price = basePrice * 0.5;
    if (price > basePrice * 2) price = basePrice * 2;
    const ts = new Date(now - i * 86400000);
    points.push({ timestamp: ts.toISOString().slice(0, 10), value: Math.round(price * 100) / 100 });
  }
  return points;
}

function getVolatility(assetClass: string): number {
  switch (assetClass) {
    case "crypto": return 0.035;
    case "meme_coins": return 0.06;
    case "stocks": return 0.015;
    case "sp500": return 0.012;
    case "commodities": return 0.02;
    case "forex": return 0.005;
    default: return 0.02;
  }
}

function symbolSeed(symbol: string): number {
  return symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

const DAYS_MAP: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };

export async function getPriceHistory(
  symbol: string,
  price: number,
  assetClass: string,
  range: TimeRange
): Promise<ChartPoint[]> {
  const cacheKey = `history_${symbol}_${range}`;
  const cached = isCached<ChartPoint[]>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 100));

  const days = DAYS_MAP[range] ?? 30;
  const vol = getVolatility(assetClass);
  const data = generateMockPrices(price, days, vol, symbolSeed(symbol));
  setCache(cacheKey, data, PRICE_TTL);
  return data;
}

/* ───── Key Stats (52w high/low, MA) ───── */

export async function getKeyStats(symbol: string, price: number, assetClass: string): Promise<{
  high52w: number;
  low52w: number;
  ma50: number;
  ma200: number;
}> {
  const cacheKey = `stats_${symbol}`;
  const cached = isCached<{ high52w: number; low52w: number; ma50: number; ma200: number }>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 80));

  const vol = getVolatility(assetClass);
  const seed = symbolSeed(symbol);
  const high52w = Math.round(price * (1 + vol * 3 + (seed % 10) * 0.01) * 100) / 100;
  const low52w = Math.round(price * (1 - vol * 2.5 - (seed % 8) * 0.01) * 100) / 100;
  const ma50 = Math.round(price * (1 + (seed % 5 - 2) * 0.005) * 100) / 100;
  const ma200 = Math.round(price * (1 + (seed % 7 - 3) * 0.008) * 100) / 100;
  const stats = { high52w, low52w, ma50, ma200 };
  setCache(cacheKey, stats, PRICE_TTL);
  return stats;
}

/* ───── Fundamentals ───── */

const FUNDAMENTALS_DATA: Record<string, AssetFundamentals> = {
  AAPL: { marketCap: 2850000000000, peRatio: 28.4, dividendYield: 0.52, beta: 1.21, sector: "Technology" },
  MSFT: { marketCap: 3120000000000, peRatio: 35.2, dividendYield: 0.71, beta: 0.89, sector: "Technology" },
  GOOGL: { marketCap: 2150000000000, peRatio: 26.8, dividendYield: 0.44, beta: 1.05, sector: "Technology" },
  AMZN: { marketCap: 1980000000000, peRatio: 44.1, dividendYield: 0, beta: 1.17, sector: "Consumer Cyclical" },
  TSLA: { marketCap: 790000000000, peRatio: 58.6, dividendYield: 0, beta: 2.05, sector: "Automotive" },
  NVDA: { marketCap: 2180000000000, peRatio: 72.3, dividendYield: 0.04, beta: 1.68, sector: "Technology" },
  META: { marketCap: 1290000000000, peRatio: 24.5, dividendYield: 0, beta: 1.22, sector: "Technology" },
  JPM: { marketCap: 570000000000, peRatio: 12.1, dividendYield: 2.15, beta: 1.12, sector: "Financial Services" },
  BTC: { marketCap: 1320000000000, circulatingSupply: 19700000, totalSupply: 21000000, allTimeHigh: 73750 },
  ETH: { marketCap: 415000000000, circulatingSupply: 120200000, totalSupply: null as unknown as undefined, allTimeHigh: 4878 },
  SOL: { marketCap: 65000000000, circulatingSupply: 443000000, totalSupply: null as unknown as undefined, allTimeHigh: 260 },
  XRP: { marketCap: 34000000000, circulatingSupply: 54300000000, totalSupply: 100000000000, allTimeHigh: 3.84 },
  ADA: { marketCap: 16000000000, circulatingSupply: 35000000000, totalSupply: 45000000000, allTimeHigh: 3.10 },
  DOGE: { marketCap: 18000000000, circulatingSupply: 143000000000, totalSupply: null as unknown as undefined, allTimeHigh: 0.74 },
  PEPE: { liquidity: 8500000, volume24h: 580000000, holderCount: 240000 },
  WIF: { liquidity: 4200000, volume24h: 420000000, holderCount: 85000 },
  BONK: { liquidity: 3100000, volume24h: 310000000, holderCount: 620000 },
  FLOKI: { liquidity: 2800000, volume24h: 280000000, holderCount: 410000 },
  "EUR/USD": { yearHigh: 1.12, yearLow: 1.05, centralBankRate: 4.25 },
  "GBP/USD": { yearHigh: 1.32, yearLow: 1.24, centralBankRate: 5.25 },
  "USD/JPY": { yearHigh: 158.00, yearLow: 140.00, centralBankRate: 0.50 },
  "USD/CHF": { yearHigh: 0.92, yearLow: 0.85, centralBankRate: 1.75 },
  "AUD/USD": { yearHigh: 0.69, yearLow: 0.63, centralBankRate: 4.35 },
  SPY: { marketCap: 510000000000, peRatio: 23.5, dividendYield: 1.32, beta: 1.0, sector: "ETF — Broad Market" },
  QQQ: { marketCap: 285000000000, peRatio: 31.2, dividendYield: 0.64, beta: 1.15, sector: "ETF — Technology" },
  "GC=F": { marketCap: null as unknown as undefined, sector: "Precious Metals" },
  "SI=F": { marketCap: null as unknown as undefined, sector: "Precious Metals" },
  "CL=F": { marketCap: null as unknown as undefined, sector: "Energy" },
  "NG=F": { marketCap: null as unknown as undefined, sector: "Energy" },
};

export async function getFundamentals(symbol: string): Promise<AssetFundamentals | null> {
  const cacheKey = `fundamentals_${symbol}`;
  const cached = isCached<AssetFundamentals>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 150));

  const data = FUNDAMENTALS_DATA[symbol] ?? null;
  if (data) setCache(cacheKey, data, PRICE_TTL);
  return data;
}

/* ───── Related News ───── */

export async function getAssetRelatedNews(symbol: string): Promise<NewsArticle[]> {
  const cacheKey = `news_${symbol}`;
  const cached = isCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, 200));

  const allNews = FALLBACK_NEWS.filter((a) => a.relatedSymbols?.includes(symbol));
  setCache(cacheKey, allNews, NEWS_TTL);
  return allNews;
}

/* ───── News AI Chat (context-aware, for news page chatbot) ───── */

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
  await new Promise((r) => setTimeout(r, 1200));

  const lower = userMessage.toLowerCase();
  const trackedSymbols = userContext.trackedAssets.map((a) => a.symbol);
  const trackedStr = trackedSymbols.join(", ");

  // Find which tracked assets are mentioned
  const mentionedAssets = userContext.trackedAssets.filter(
    (a) => lower.includes(a.symbol.toLowerCase()) || lower.includes(a.name.toLowerCase().split(" ")[0])
  );

  // Refuse buy/sell advice
  if (lower.includes("buy") || lower.includes("sell") || lower.includes("should i") || lower.includes("recommend")) {
    return `I understand you're looking for trading guidance${mentionedAssets.length > 0 ? ` regarding ${mentionedAssets.map((a) => a.symbol).join(", ")}` : ""}, but I can't provide specific buy or sell recommendations. My role is to help you understand the news context and how it may relate to your portfolio. Consider speaking with a licensed financial advisor for personalized trading decisions. _Informational only. Not investment advice._`;
  }

  // Build a response that references tracked assets when relevant
  const name = userContext.displayName.split(" ")[0] || "there";

  // Check for crypto questions
  if (lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("ethereum")) {
    const cryptoAssets = userContext.trackedAssets.filter((a) => a.assetClass === "crypto");
    const cryptoRef = cryptoAssets.length > 0
      ? ` I see you're tracking ${cryptoAssets.map((a) => a.symbol).join(", ")} —`
      : "";

    return `Great question, ${name}!${cryptoRef} crypto markets have seen notable activity recently. Bitcoin's ETF inflows continue driving institutional demand, while Ethereum's layer-2 ecosystem is maturing rapidly with transaction volumes reaching new highs. ${cryptoAssets.length > 0 ? `Your tracked crypto assets — ${cryptoAssets.map((a) => `${a.symbol} (${a.name})`).join(", ")} — are positioned within a sector that's showing strong fundamental development, though near-term volatility remains elevated.` : ""} Keep an eye on regulatory developments and macro factors, as these tend to influence crypto prices significantly. _Informational only. Not investment advice._`;
  }

  // Check for stock-specific questions
  if (lower.includes("stock") || lower.includes("equity") || mentionedAssets.some((a) => a.assetClass === "stocks")) {
    const stockAssets = mentionedAssets.filter((a) => a.assetClass === "stocks");
    const targetAssets = stockAssets.length > 0 ? stockAssets : userContext.trackedAssets.filter((a) => a.assetClass === "stocks");
    const stockRef = targetAssets.length > 0
      ? ` Looking specifically at ${targetAssets.map((a) => a.symbol).join(", ")}`
      : "";

    return `Happy to break that down, ${name}!${stockRef} — the equity markets are responding to a mix of factors right now. Strong corporate earnings have been supporting valuations, but sticky inflation data and uncertainty around the Fed's rate path are creating headwinds.${targetAssets.length > 0 ? ` Your tracked stocks ${targetAssets.map((a) => `${a.symbol}`).join(", ")} are in sectors that are benefiting from the current AI investment cycle and consumer resilience, though valuation multiples warrant monitoring.` : ""} The key theme this week is the tug-of-war between positive earnings momentum and macro uncertainty. _Informational only. Not investment advice._`;
  }

  // Check for macro questions
  if (lower.includes("macro") || lower.includes("fed") || lower.includes("rate") || lower.includes("inflation") || lower.includes("economy") || lower.includes("gdp")) {
    return `Great macro question, ${name}! Looking at the headlines, we're seeing a mixed picture: GDP growth was revised up, which is positive, but inflation data came in hotter than expected, which delayed rate cut expectations. For your portfolio, which includes ${trackedStr}, this means: (1) growth-oriented assets could benefit if the economy stays resilient, but (2) higher-for-longer rates could pressure valuations. Your ${userContext.riskTolerance} risk profile is well-suited to navigate this environment by staying diversified. _Informational only. Not investment advice._`;
  }

  // Check for forex questions
  if (lower.includes("forex") || lower.includes("currency") || lower.includes("dollar") || lower.includes("euro") || lower.includes("yen")) {
    const forexAssets = userContext.trackedAssets.filter((a) => a.assetClass === "forex");
    const forexRef = forexAssets.length > 0
      ? ` Since you're tracking ${forexAssets.map((a) => a.symbol).join(", ")},`
      : "";

    return `Good question on currencies!${forexRef} here's what's moving the forex markets: central bank policy divergence is the dominant theme. The ECB and Bank of England are signaling potential cuts, while the Fed remains cautious. The yen is under particular pressure, with USD/JPY testing key levels near 155 — intervention risks are growing. Currency markets are pricing in rate differential expectations, so any shift in central bank language could trigger significant moves. _Informational only. Not investment advice._`;
  }

  // Check for summary request
  if (lower.includes("summar") || lower.includes("overview") || lower.includes("top") || lower.includes("headline")) {
    const headlineSample = recentHeadlines.slice(0, 3).map((h) => `• ${h}`).join("\n");
    return `Here's a quick overview of today's top stories, ${name}:\n\n${headlineSample}\n\nThe common thread across today's news is the market's focus on central bank policy direction and AI-driven sector momentum. For your portfolio (${trackedStr}), the key takeaway is that macro conditions are gradually improving, but patience remains warranted. Sector rotation continues, with technology and AI-related assets leading while traditional sectors await clearer rate signals. _Informational only. Not investment advice._`;
  }

  // Default personalized response
  const headlineRef = recentHeadlines.length > 0
    ? ` Looking at the latest headlines: "${recentHeadlines[0]}" — this is representative of the current market narrative.`
    : "";

  return `Thanks for asking, ${name}! Based on your profile (${userContext.riskTolerance} risk tolerance, ${userContext.experienceLevel} experience) and tracked assets (${trackedStr}), here's my perspective:${headlineRef} The market environment continues to evolve, and the most relevant factor for your portfolio is how the macro backdrop interacts with your specific asset classes. Stay focused on your long-term objectives and use volatility as an opportunity to review your allocation. _Informational only. Not investment advice._`;
}

/* ───── AI Synthesis (per asset, cached 30 min) ───── */

const SYNTHESIS_TTL = 30 * 60 * 1000;
const synthesisCache = new Map<string, { text: string; expiresAt: number }>();

const SYNTHESES: Record<string, string> = {
  AAPL: [
    "**Performance drivers:** Apple's recent price action reflects strong momentum from its services revenue segment, which hit an all-time high of $24.1B in the latest quarter. The steady expansion of high-margin recurring revenue from the App Store, Apple Music, iCloud, and Apple Care has diversified earnings away from iPhone dependence. Additionally, institutional buying has been noted as the company's massive cash flow generation supports continued share buybacks.",
    "**Key risks and headwinds:** iPhone sales continue to show modest declines, particularly in the Greater China region where competition from domestic manufacturers is intensifying. Regulatory scrutiny over the App Store's commission structure remains an ongoing overhang, with both the EU's Digital Markets Act and ongoing US DOJ actions presenting potential revenue headwinds. The stock's premium valuation relative to historical multiples leaves limited margin for execution missteps.",
    "**Forward-looking context:** Apple's growing installed base of over 2 billion active devices provides a durable competitive moat. The potential for AI-driven features in the next iPhone cycle — coupled with anticipated growth in wearables and services — positions the company for mid-single-digit revenue growth. The expanding gross margins in services continue to improve overall profitability. _Informational only. Not investment advice._"
  ].join("\n\n"),
  BTC: [
    "**Performance drivers:** Bitcoin's recent surge past $67,000 has been fueled by record-breaking inflows into spot Bitcoin ETFs, with a single-day record of $1.2B in net new capital. Institutional adoption continues to accelerate, with major asset allocators increasing portfolio allocations to BTC as a digital store of value. The upcoming halving event has historically acted as a supply-side catalyst every four years.",
    "**Key risks and headwinds:** Despite strong institutional inflows, Bitcoin remains highly sensitive to macro liquidity conditions. A sustained hawkish shift from the Federal Reserve could redirect capital away from risk assets, including crypto. Regulatory fragmentation across jurisdictions — particularly differing approaches in the US, EU, and Asia — creates ongoing uncertainty for market participants and custodian operations.",
    "**Forward-looking context:** The supply shock dynamics created by ETF demand absorbing newly mined coins at a faster rate than production could create upward price pressure over the medium term. Growing integration with traditional financial infrastructure, including options markets and prime brokerage services, suggests deepening market maturity. The long-term adoption curve tracks broader digital asset acceptance trends. _Informational only. Not investment advice._"
  ].join("\n\n"),
  NVDA: [
    "**Performance drivers:** NVIDIA's share price continues to benefit from surging data center demand as hyperscale cloud providers compete for limited GPU supply. The latest Blackwell Ultra GPU architecture promises a 40% performance improvement over its predecessor, reinforcing the company's technological lead in AI training and inference hardware. Enterprise AI adoption is accelerating beyond early adopters into traditional industries.",
    "**Key risks and headwinds:** Geopolitical export restrictions to certain markets create a tangible revenue ceiling in specific geographic segments. The risk of customer concentration — with a small number of hyperscalers accounting for a disproportionate share of revenue — presents a demand-side vulnerability. Competitor developments in custom ASIC chips from cloud providers themselves could gradually erode NVIDIA's near-monopoly positioning in AI accelerators.",
    "**Forward-looking context:** The secular trend toward AI infrastructure build-out shows no signs of deceleration, with enterprise AI spending forecasts continuing to be revised upward. NVIDIA's software ecosystem, particularly CUDA, provides a significant stickiness advantage. The company's expanding total addressable market into automotive, robotics, and digital twins supports a multi-year growth runway. _Informational only. Not investment advice._"
  ].join("\n\n"),
  ETH: [
    "**Performance drivers:** Ethereum's price action reflects growing maturity in its layer-2 scaling ecosystem, which recently surpassed the mainnet in daily transaction volume for the first time. Staking yields — currently around 3.5% — continue to attract long-term holders, reducing circulating supply velocity. Institutional interest through the recently approved spot ETH ETFs provides a new demand channel.",
    "**Key risks and headwinds:** Competition from faster and lower-cost layer-1 blockchains such as Solana and Aptos continues to capture developer mindshare and user activity. The transition to a proof-of-stake model has reduced energy consumption but introduced new centralization concerns around validator concentration. Regulatory classification of ETH as a commodity vs. security remains an unresolved legal question in several jurisdictions.",
    "**Forward-looking context:** The continued expansion of the layer-2 ecosystem, combined with EIP improvements enhancing mainnet scalability, positions Ethereum as the settlement layer for a growing DeFi and tokenization economy. Real-world asset tokenization — particularly in private credit and treasuries — represents a significant on-chain growth catalyst. _Informational only. Not investment advice._"
  ].join("\n\n"),
  TSLA: [
    "**Performance drivers:** Tesla's recent delivery numbers have exceeded consensus expectations, driven by strong demand in North America and cost reductions in manufacturing. The energy storage division — including Megapack and Powerwall — is emerging as a meaningful profit center, with margins surpassing the automotive segment in recent quarters. Full Self-Driving software revenue continues to contribute high-margin recurring income.",
    "**Key risks and headwinds:** The increasingly competitive EV landscape, particularly from Chinese manufacturers like BYD, is pressuring global market share. Price cuts implemented throughout the year have compressed automotive margins below 20%, raising questions about sustainable profitability. CEO Elon Musk's attention being split across multiple companies and controversial public statements introduce governance risk that the market continues to price at a discount.",
    "**Forward-looking context:** The long-term thesis rests on three pillars: expanding full autonomy capabilities, next-gen vehicle platform cost reductions, and energy storage scaling. The Cybertruck ramp, while slower than anticipated, opens a new addressable market in the North American pickup segment. Robotaxi network deployment timeline clarity would represent a significant catalyst. _Informational only. Not investment advice._"
  ].join("\n\n"),
};

export async function getAISynthesis(symbol: string): Promise<string> {
  const cached = synthesisCache.get(symbol);
  if (cached && Date.now() < cached.expiresAt) return cached.text;

  await new Promise((r) => setTimeout(r, 800));

  const text =
    SYNTHESES[symbol] ??
    [
      `**Performance drivers:** ${symbol} has shown active price discovery in recent sessions, with above-average volume suggesting meaningful market participation. Sector-specific catalysts and broader macro conditions are contributing to the current price action dynamics. Technical indicators point to established trend channels that warrant observation.`,
      `**Key risks and headwinds:** The primary risks for ${symbol} include macro sensitivity to interest rate expectations and broader market liquidity conditions. Asset-specific factors, including competitive pressures and regulatory developments, present additional uncertainty. Position sizing should account for the inherent volatility of this asset class.`,
      `**Forward-looking context:** ${symbol} trades within a broader market context that continues to evolve. The convergence of sector trends, capital flows, and macroeconomic factors will shape the medium-term trajectory. Continued monitoring of both technical levels and fundamental developments is recommended for a comprehensive view. _Informational only. Not investment advice._`
    ].join("\n\n");

  synthesisCache.set(symbol, { text, expiresAt: Date.now() + SYNTHESIS_TTL });
  return text;
}

/* ───── AI Chat (session-aware, per asset) ───── */

export async function getAIChatResponse(
  symbol: string,
  _conversation: { role: string; content: string }[],
  question: string
): Promise<string> {
  await new Promise((r) => setTimeout(r, 500));

  const lower = question.toLowerCase();

  // Refuse buy/sell recommendations
  if (lower.includes("buy") || lower.includes("sell") || lower.includes("should i") || lower.includes("recommend")) {
    return `I understand you're asking about a trading decision regarding ${symbol}, but I can't provide specific buy or sell recommendations. My role is to provide context, analysis of current conditions, and relevant data — not personalized investment advice. Consider speaking with a licensed financial advisor for personalized guidance. _Informational only. Not investment advice._`;
  }

  // Asset-specific responses
  const responses: Record<string, string[]> = {
    AAPL: [
      `Regarding ${symbol}'s competitive positioning — Apple's services ecosystem creates a powerful moat that competitors find difficult to replicate. The 2B+ active device installed base provides a recurring revenue stream that now represents over 25% of total revenue. This diversification reduces earnings volatility compared to the company's historical iPhone-dependent model.`,
      `On valuation: ${symbol} currently trades at approximately 28x forward earnings, which is above its 5-year average of 22x. The premium multiple reflects the market's confidence in services-led margin expansion and the potential AI-driven upgrade cycle. However, the current valuation leaves limited room for error in execution.`
    ],
    BTC: [
      `On Bitcoin's ETF flows: The sustained institutional inflow into spot ETFs is a structurally bullish development because it creates a persistent buy-side pressure that didn't exist in previous cycles. Unlike retail-dominated exchange flows, ETF inflows represent long-term capital allocations from pension funds, endowments, and institutional asset allocators that tend to have multi-year holding horizons.`,
      `Regarding supply dynamics: Approximately 900 new BTC are mined daily, but ETF demand has been absorbing multiple times that amount. This supply-demand imbalance is a key factor in the current price dynamics. The upcoming halving will further reduce daily issuance to 450 BTC, intensifying this effect.`
    ],
  };

  const assetResponses = responses[symbol];
  if (assetResponses) {
    return assetResponses[_conversation.length % assetResponses.length];
  }

  return `Looking at ${symbol} specifically, the current market data shows active trading with volume patterns that suggest meaningful institutional participation. The asset's price action should be evaluated within the context of its sector trends and broader market conditions. Key levels to monitor include recent support and resistance areas on the daily timeframe. _Informational only. Not investment advice._`;
}

/* ───── Legacy AI Commentary ───── */

export async function getAIResponse(
  _message: string,
  _userContext?: { trackedAssets: string[]; riskTolerance: string }
): Promise<string> {
  // Simulate AI response
  await new Promise((r) => setTimeout(r, 600));

  const responses = [
    "Looking at the current market landscape, we're seeing interesting rotation patterns. Tech stocks continue to show momentum, particularly in the AI sector. **Informational only. Not investment advice.**",
    "Based on your tracked assets and medium risk profile, the current market conditions suggest a cautiously optimistic outlook. The macroeconomic picture is improving with potential rate cuts on the horizon. **Informational only. Not investment advice.**",
    "The crypto market is showing renewed strength, led by Bitcoin's breakout above key resistance levels. Market sentiment indicators point to growing institutional interest. **Informational only. Not investment advice.**",
    "I can see your watchlist includes a mix of growth and value assets. The current market environment favors a balanced approach — but remember, past performance doesn't guarantee future results. **Informational only. Not investment advice.**",
    "Several of your tracked stocks are showing above-average trading volume today, which often precedes significant price movement. Monitor closely for confirmation. **Informational only. Not investment advice.**",
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}