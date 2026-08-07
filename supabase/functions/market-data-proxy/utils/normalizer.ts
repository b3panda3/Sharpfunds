/**
 * Normalizer — transforms provider-specific API responses into
 * a single unified format the frontend expects.
 */

export interface QuoteResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
  marketCap?: number;
  currency?: string;
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
}

export interface HistoryResult {
  symbol: string;
  range: string;
  points: HistoryPoint[];
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  thumbnailUrl?: string;
  sentiment?: "positive" | "negative" | "neutral";
  relatedSymbols?: string[];
}

export interface FundamentalsResult {
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  beta?: number;
  sector?: string;
  industry?: string;
  employees?: number;
  // Crypto
  circulatingSupply?: number;
  totalSupply?: number;
  allTimeHigh?: number;
  // Forex
  yearHigh?: number;
  yearLow?: number;
  centralBankRate?: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  assetClass: string;
  exchange?: string;
  currency?: string;
}

/* ───── Finnhub normalizers ───── */

export function normalizeFinnhubQuote(data: Record<string, unknown>, symbol: string): QuoteResult {
  return {
    symbol,
    name: "",
    price: (data.c as number) ?? 0,
    change: (data.d as number) ?? 0,
    changePercent: (data.dp as number) ?? 0,
    high24h: data.h as number | undefined,
    low24h: data.l as number | undefined,
    volume: data.v as number | undefined,
  };
}

export function normalizeFinnhubCompanyProfile(
  data: Record<string, unknown>,
  symbol: string,
): FundamentalsResult & { name: string } {
  return {
    name: (data.name as string) ?? symbol,
    marketCap: data.marketCapitalization as number | undefined,
    sector: (data.sector as string) ?? undefined,
    industry: (data.finnhubIndustry as string) ?? undefined,
    employees: data.totalEmployees as number | undefined,
  };
}

export function normalizeFinnhubFinancials(
  data: Record<string, unknown>,
): { peRatio?: number; dividendYield?: number; beta?: number } {
  const metrics = (data as Record<string, unknown>)?.metric as Record<string, unknown> ?? {};
  return {
    peRatio: metrics.peRatio as number | undefined,
    dividendYield: ((metrics.dividendYield as number) ?? 0) * 100,
    beta: metrics.beta as number | undefined,
  };
}

/* The Finnhub news endpoint returns an array of articles. */
export function normalizeFinnhubNews(articles: Record<string, unknown>[]): NewsArticle[] {
  return articles.map((a, i) => ({
    id: `fh_${i}_${Date.now()}`,
    title: (a.headline as string) ?? "",
    description: (a.summary as string) ?? "",
    url: (a.url as string) ?? "",
    source: (a.source as string) ?? "Finnhub",
    publishedAt: new Date((a.datetime as number) * 1000).toISOString(),
    thumbnailUrl: a.image as string | undefined,
    sentiment: mapSentiment(a.sentiment as string),
    relatedSymbols: (a.related as string)?.split(",").map((s: string) => s.trim()) ?? [],
  }));
}

function mapSentiment(s?: string): "positive" | "negative" | "neutral" {
  if (s === "positive") return "positive";
  if (s === "negative") return "negative";
  return "neutral";
}

/* ───── Alpha Vantage normalizers ───── */

export function normalizeAVQuote(
  globalQuote: Record<string, string> | null,
  symbol: string,
): QuoteResult | null {
  if (!globalQuote) return null;
  const price = parseFloat(globalQuote["05. price"]) || 0;
  const change = parseFloat(globalQuote["09. change"]) || 0;
  const prevClose = parseFloat(globalQuote["08. previous close"]) || price;
  return {
    symbol,
    name: "",
    price,
    change,
    changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
    high24h: parseFloat(globalQuote["03. high"]) || undefined,
    low24h: parseFloat(globalQuote["04. low"]) || undefined,
    volume: parseInt(globalQuote["06. volume"]) || undefined,
  };
}

// Alpha Vantage daily adjusted returns time-series
export function normalizeAVHistory(
  timeSeries: Record<string, Record<string, string>> | null,
): HistoryPoint[] {
  if (!timeSeries) return [];
  const points: HistoryPoint[] = [];
  for (const [date, vals] of Object.entries(timeSeries)) {
    points.push({
      timestamp: date,
      value: parseFloat(vals["4. close"]) || 0,
    });
  }
  return points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function normalizeAVOverview(
  data: Record<string, string>,
): FundamentalsResult | null {
  if (!data || !data.Symbol) return null;
  return {
    marketCap: parseFloat(data.MarketCapitalization) || undefined,
    peRatio: parseFloat(data.PERatio) || undefined,
    dividendYield: parseFloat(data.DividendYield) || undefined,
    beta: parseFloat(data.Beta) || undefined,
    sector: data.Sector ?? undefined,
    industry: data.Industry ?? undefined,
  };
}

export function normalizeAVSearch(
  matches: Record<string, string>[],
): SearchResult[] {
  return matches.map((m) => ({
    symbol: m["1. symbol"] ?? "",
    name: m["2. name"] ?? "",
    assetClass: m["3. type"] === "ETF" ? "sp500" : "stocks",
    exchange: m["4. region"] ?? undefined,
    currency: m["8. currency"] ?? undefined,
  }));
}

/* ───── CoinGecko normalizers ───── */

export function normalizeCGQuote(
  data: Record<string, unknown>,
  symbol: string,
): QuoteResult {
  const usd = (data as Record<string, unknown>)?.market_data as Record<string, unknown> ?? {};
  const price = (usd.current_price as Record<string, number>)?.["usd"] ?? 0;
  const change24h = (usd.price_change_percentage_24h as number) ?? 0;
  return {
    symbol,
    name: (data.name as string) ?? symbol,
    price,
    change: price * (change24h / 100),
    changePercent: change24h,
    high24h: (usd.high_24h as Record<string, number>)?.["usd"] ?? undefined,
    low24h: (usd.low_24h as Record<string, number>)?.["usd"] ?? undefined,
    volume: (usd.total_volume as Record<string, number>)?.["usd"] ?? undefined,
    marketCap: (usd.market_cap as Record<string, number>)?.["usd"] ?? undefined,
  };
}

export function normalizeCGHistory(
  data: Record<string, unknown>,
): HistoryPoint[] {
  const prices = (data.prices as [number, number][]) ?? [];
  return prices.map(([ts, val]) => ({
    timestamp: new Date(ts).toISOString().slice(0, 10),
    value: val,
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function normalizeCGSearch(
  coins: Record<string, unknown>[],
): SearchResult[] {
  return coins.map((c) => ({
    symbol: ((c.symbol as string) ?? "").toUpperCase(),
    name: (c.name as string) ?? "",
    assetClass: "crypto",
  }));
}

export function normalizeCGMovers(
  data: Record<string, unknown>[],
): QuoteResult[] {
  return data.map((item) => {
    const usd = (item as Record<string, unknown>)?.data as Record<string, unknown> ?? {};
    const price = (usd.price as number) ?? 0;
    const change = (usd.price_change_percentage_24h as Record<string, number>)?.["usd"] ?? 0;
    return {
      symbol: ((item.symbol as string) ?? "").toUpperCase(),
      name: (item.name as string) ?? "",
      price,
      change: price * (change / 100),
      changePercent: change,
      marketCap: usd.market_cap as number | undefined,
      volume: usd.total_volume as number | undefined,
    };
  }).filter((q) => q.price > 0);
}