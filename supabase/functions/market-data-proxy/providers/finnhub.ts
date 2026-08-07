/**
 * Finnhub provider — primary source for stocks, forex, fundamentals, and news.
 * Docs: https://finnhub.io/docs/api
 */

import { cacheGet, cacheSet, TTL } from "../utils/cache.ts";
import {
  normalizeFinnhubQuote,
  normalizeFinnhubCompanyProfile,
  normalizeFinnhubFinancials,
  normalizeFinnhubNews,
  type QuoteResult,
  type FundamentalsResult,
  type NewsArticle,
} from "../utils/normalizer.ts";

function getKey(): string {
  return Deno.env.get("FINNHUB_API_KEY") ?? "";
}

const BASE = "https://finnhub.io/api/v1";

async function fetchWithRetry(
  url: string,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;

    // Rate limited — wait and retry
    if (res.status === 429) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 4000);
      console.warn(`[Finnhub] 429 on ${url}, retry ${attempt + 1} in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // Other server errors — retry with backoff
    if (res.status >= 500) {
      const waitMs = Math.min(500 * Math.pow(2, attempt), 3000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // 4xx other than 429 — don't retry
    throw new Error(`Finnhub returned ${res.status}: ${await res.text()}`);
  }
  throw new Error(`Finnhub rate limit exceeded after ${retries + 1} attempts`);
}

/** Fetch a stock/forex quote */
export async function getQuote(symbol: string): Promise<QuoteResult | null> {
  const cacheKey = `fh_quote_${symbol}`;
  const cached = cacheGet<QuoteResult>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${BASE}/quote?symbol=${symbol}&token=${getKey()}`);
    const data = await res.json() as Record<string, unknown>;
    if (data.c === 0 || data.c === null || data.c === undefined) return null;
    const quote = normalizeFinnhubQuote(data, symbol);
    cacheSet(cacheKey, quote, TTL.QUOTE);
    return quote;
  } catch (err) {
    console.error(`[Finnhub] getQuote error for ${symbol}:`, err);
    return null;
  }
}

/** Fetch company profile (name, sector, market cap) */
export async function getCompanyProfile(
  symbol: string,
): Promise<(FundamentalsResult & { name: string }) | null> {
  const cacheKey = `fh_profile_${symbol}`;
  const cached = cacheGet<FundamentalsResult & { name: string }>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `${BASE}/stock/profile2?symbol=${symbol}&token=${getKey()}`,
    );
    const data = await res.json() as Record<string, unknown>;
    if (!data.name) return null;
    const profile = normalizeFinnhubCompanyProfile(data, symbol);
    cacheSet(cacheKey, profile, TTL.FUNDAMENTALS);
    return profile;
  } catch (err) {
    console.error(`[Finnhub] getCompanyProfile error for ${symbol}:`, err);
    return null;
  }
}

/** Fetch basic financial metrics (PE ratio, dividend yield, beta) */
export async function getBasicFinancials(
  symbol: string,
): Promise<{ peRatio?: number; dividendYield?: number; beta?: number }> {
  const cacheKey = `fh_financials_${symbol}`;
  const cached = cacheGet<{ peRatio?: number; dividendYield?: number; beta?: number }>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${getKey()}`,
    );
    const data = await res.json() as Record<string, unknown>;
    const normalized = normalizeFinnhubFinancials(data);
    cacheSet(cacheKey, normalized, TTL.FUNDAMENTALS);
    return normalized;
  } catch (err) {
    console.error(`[Finnhub] getBasicFinancials error for ${symbol}:`, err);
    return {};
  }
}

/** Fetch market news (optionally filtered by symbol) */
export async function getNews(symbol?: string): Promise<NewsArticle[]> {
  const cacheKey = `fh_news_${symbol ?? "general"}`;
  const cached = cacheGet<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    const category = symbol
      ? `&symbol=${symbol}`
      : "&category=general";
    const res = await fetchWithRetry(
      `${BASE}/news?${category ? category.slice(1) : "category=general"}&token=${getKey()}`,
    );
    const articles = await res.json() as Record<string, unknown>[];
    const normalized = normalizeFinnhubNews(articles).slice(0, 50);
    cacheSet(cacheKey, normalized, TTL.NEWS);
    return normalized;
  } catch (err) {
    console.error(`[Finnhub] getNews error:`, err);
    return [];
  }
}

/** Search for symbols by name/keyword */
export async function searchSymbol(query: string): Promise<{ symbol: string; name: string; assetClass: string }[]> {
  const cacheKey = `fh_search_${query}`;
  const cached = cacheGet<{ symbol: string; name: string; assetClass: string }[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `${BASE}/search?q=${encodeURIComponent(query)}&token=${getKey()}`,
    );
    const data = await res.json() as Record<string, unknown>;
    const result = ((data.result as Record<string, unknown>[]) ?? []).map(
      (r) => ({
        symbol: (r.symbol as string) ?? "",
        name: (r.description as string) ?? "",
        assetClass: (r.type as string) === "ETF" || (r.type as string) === "Index" ? "sp500" : "stocks",
      }),
    );
    cacheSet(cacheKey, result, TTL.SEARCH);
    return result;
  } catch (err) {
    console.error(`[Finnhub] searchSymbol error for ${query}:`, err);
    return [];
  }
}