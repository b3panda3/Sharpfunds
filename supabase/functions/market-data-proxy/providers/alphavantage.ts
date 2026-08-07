/**
 * Alpha Vantage provider — secondary/fallback source for stocks, forex,
 * technical indicators, and historical data.
 * Docs: https://www.alphavantage.co/documentation/
 */

import { cacheGet, cacheSet, TTL } from "../utils/cache.ts";
import {
  normalizeAVQuote,
  normalizeAVHistory,
  normalizeAVOverview,
  type QuoteResult,
  type HistoryPoint,
  type FundamentalsResult,
} from "../utils/normalizer.ts";

function getKey(): string {
  return Deno.env.get("ALPHA_VANTAGE_API_KEY") ?? "";
}

const BASE = "https://www.alphavantage.co/query";

async function fetchJson(
  params: Record<string, string>,
  retries = 1,
): Promise<Record<string, unknown>> {
  const url = `${BASE}?${new URLSearchParams({
    ...params,
    apikey: getKey(),
  }).toString()}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[AlphaVantage] HTTP ${res.status} on ${params.function}`);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const data = await res.json() as Record<string, unknown>;

    // Alpha Vantage returns errors in the JSON body
    if (data.Information || data.Note) {
      console.warn(`[AlphaVantage] API message: ${(data.Information ?? data.Note) as string}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return {};
    }
    return data;
  }
  return {};
}

/** Get a stock/ETF quote from Alpha Vantage (GLOBAL_QUOTE endpoint) */
export async function getQuote(symbol: string): Promise<QuoteResult | null> {
  const cacheKey = `av_quote_${symbol}`;
  const cached = cacheGet<QuoteResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson({ function: "GLOBAL_QUOTE", symbol, datatype: "json" });
    const gq = data["Global Quote"] as Record<string, string> | null;
    const quote = normalizeAVQuote(gq, symbol);
    if (quote && quote.price > 0) {
      cacheSet(cacheKey, quote, TTL.QUOTE);
      return quote;
    }
    return null;
  } catch (err) {
    console.error(`[AlphaVantage] getQuote error for ${symbol}:`, err);
    return null;
  }
}

/** Get daily adjusted historical data */
export async function getHistory(
  symbol: string,
  range: string,
): Promise<HistoryPoint[] | null> {
  const cacheKey = `av_history_${symbol}_${range}`;
  const cached = cacheGet<HistoryPoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const outputsize = range === "1Y" || range === "90D" ? "full" : "compact";
    const data = await fetchJson({
      function: "TIME_SERIES_DAILY_ADJUSTED",
      symbol,
      outputsize,
    });

    const ts = data["Time Series (Daily)"] as Record<string, Record<string, string>> | null;
    const points = normalizeAVHistory(ts);

    if (points.length > 0) {
      // Trim to requested range
      const dayMap: Record<string, number> = {
        "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365,
      };
      const days = dayMap[range] ?? 30;
      const trimmed = points.slice(-days);
      cacheSet(cacheKey, trimmed, TTL.HISTORY);
      return trimmed;
    }
    return null;
  } catch (err) {
    console.error(`[AlphaVantage] getHistory error for ${symbol}:`, err);
    return null;
  }
}

/** Get company overview (fundamentals) */
export async function getFundamentals(
  symbol: string,
): Promise<FundamentalsResult | null> {
  const cacheKey = `av_fundamentals_${symbol}`;
  const cached = cacheGet<FundamentalsResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson({ function: "OVERVIEW", symbol });
    const overview = normalizeAVOverview(data as Record<string, string>);
    if (overview) {
      cacheSet(cacheKey, overview, TTL.FUNDAMENTALS);
      return overview;
    }
    return null;
  } catch (err) {
    console.error(`[AlphaVantage] getFundamentals error for ${symbol}:`, err);
    return null;
  }
}

/** Forex exchange rate */
export async function getForexQuote(from: string, to: string): Promise<QuoteResult | null> {
  const symbol = `${from}/${to}`;
  const cacheKey = `av_fx_${from}_${to}`;
  const cached = cacheGet<QuoteResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: from,
      to_currency: to,
    });
    const rateData = data["Realtime Currency Exchange Rate"] as Record<string, string> | null;
    if (!rateData) return null;

    const price = parseFloat(rateData["5. Exchange Rate"]) || 0;
    const change = parseFloat(rateData["9. Change"]) || 0;
    const prevClose = parseFloat(rateData["8. Previous Close"]) || price;

    const quote: QuoteResult = {
      symbol,
      name: `${from}/${to}`,
      price,
      change,
      changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
      high24h: parseFloat(rateData["3. High"]) || undefined,
      low24h: parseFloat(rateData["4. Low"]) || undefined,
    };
    cacheSet(cacheKey, quote, TTL.QUOTE);
    return quote;
  } catch (err) {
    console.error(`[AlphaVantage] getForexQuote error for ${from}/${to}:`, err);
    return null;
  }
}