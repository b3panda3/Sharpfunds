/**
 * CoinGecko provider — primary source for cryptocurrency data.
 * Uses the public API (no key needed) or Pro API if COINGECKO_API_KEY is set.
 * Docs: https://www.coingecko.com/en/api/documentation
 */

import { cacheGet, cacheSet, TTL } from "../utils/cache.ts";
import {
  normalizeCGQuote,
  normalizeCGHistory,
  normalizeCGMovers,
  type QuoteResult,
  type HistoryPoint,
} from "../utils/normalizer.ts";

function getKey(): string {
  return Deno.env.get("COINGECKO_API_KEY") ?? "";
}

const BASE = "https://api.coingecko.com/api/v3";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Accept": "application/json" };
  const key = getKey();
  if (key) h["x-cg-pro-api-key"] = key;
  return h;
}

async function fetchJson(
  path: string,
  retries = 2,
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const url = `${BASE}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: headers() });

    if (res.ok) {
      return await res.json() as Record<string, unknown> | Record<string, unknown>[];
    }

    if (res.status === 429) {
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 8000);
      console.warn(`[CoinGecko] 429 on ${path}, retry ${attempt + 1} in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    console.error(`[CoinGecko] HTTP ${res.status} on ${path}: ${await res.text()}`);
    return {};
  }
  return {};
}

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  FIL: "filecoin",
  ALGO: "algorand",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  WIF: "dogwifhat",
  BONK: "bonk",
  FLOKI: "floki",
};

function symbolToId(symbol: string): string {
  return COINGECKO_ID_MAP[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

/** Get current price and market data for a crypto */
export async function getQuote(symbol: string): Promise<QuoteResult | null> {
  const cacheKey = `cg_quote_${symbol}`;
  const cached = cacheGet<QuoteResult>(cacheKey);
  if (cached) return cached;

  try {
    const id = symbolToId(symbol);
    const data = await fetchJson(
      `/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
    ) as Record<string, unknown>;

    if (!data.id) return null;

    const quote = normalizeCGQuote(data, symbol.toUpperCase());
    cacheSet(cacheKey, quote, TTL.QUOTE);
    return quote;
  } catch (err) {
    console.error(`[CoinGecko] getQuote error for ${symbol}:`, err);
    return null;
  }
}

/** Get price history for a crypto */
export async function getHistory(
  symbol: string,
  range: string,
): Promise<HistoryPoint[] | null> {
  const cacheKey = `cg_history_${symbol}_${range}`;
  const cached = cacheGet<HistoryPoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const id = symbolToId(symbol);
    // CoinGecko uses days parameter
    const dayMap: Record<string, number> = {
      "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365,
    };
    const days = dayMap[range] ?? 30;
    const data = await fetchJson(
      `/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
    ) as Record<string, unknown>;

    const points = normalizeCGHistory(data);
    if (points.length > 0) {
      cacheSet(cacheKey, points, TTL.HISTORY);
      return points;
    }
    return null;
  } catch (err) {
    console.error(`[CoinGecko] getHistory error for ${symbol}:`, err);
    return null;
  }
}

/** Get top movers in crypto */
export async function getTopMovers(limit = 30): Promise<QuoteResult[]> {
  const cacheKey = "cg_movers";
  const cached = cacheGet<QuoteResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson(
      `/coins/markets?vs_currency=usd&order=volume_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`,
    ) as Record<string, unknown>[];
    if (!Array.isArray(data)) return [];
    const movers = normalizeCGMovers(data);
    cacheSet(cacheKey, movers, TTL.MOVERS);
    return movers;
  } catch (err) {
    console.error(`[CoinGecko] getTopMovers error:`, err);
    return [];
  }
}

/** Search crypto by query */
export async function search(query: string): Promise<{ symbol: string; name: string; assetClass: string }[]> {
  const cacheKey = `cg_search_${query}`;
  const cached = cacheGet<{ symbol: string; name: string; assetClass: string }[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson(
      `/search?query=${encodeURIComponent(query)}`,
    ) as Record<string, unknown>;
    const coins = (data.coins as Record<string, unknown>[]) ?? [];
    const results = coins.slice(0, 10).map((c) => ({
      symbol: ((c.symbol as string) ?? "").toUpperCase(),
      name: (c.name as string) ?? "",
      assetClass: "crypto",
    }));
    cacheSet(cacheKey, results, TTL.SEARCH);
    return results;
  } catch (err) {
    console.error(`[CoinGecko] search error:`, err);
    return [];
  }
}