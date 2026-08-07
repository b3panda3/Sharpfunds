/**
 * Market Data Proxy Edge Function — Single File
 * Multi-provider: Finnhub (primary stocks/forex), Alpha Vantage (fallback),
 * CoinGecko (crypto). All API keys stored as Supabase secrets.
 *
 * API: POST /functions/v1/market-data-proxy
 * Body: { type, symbol?, assetClass?, range?, query? }
 * Types: quote, movers, history, news, fundamentals, search
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── TYPES ───

interface QuoteResult {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; high24h?: number; low24h?: number;
  volume?: number; marketCap?: number;
}
interface HistoryPoint { timestamp: string; value: number; }
interface NewsArticle {
  id: string; title: string; description: string; url: string;
  source: string; publishedAt: string; thumbnailUrl?: string;
  sentiment?: string; relatedSymbols?: string[];
}
interface FundamentalsResult {
  marketCap?: number; peRatio?: number; dividendYield?: number;
  beta?: number; sector?: string; industry?: string;
  circulatingSupply?: number; totalSupply?: number; allTimeHigh?: number;
}
interface SearchResult { symbol: string; name: string; assetClass: string; }

// ─── CORS ───

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function err(message: string, status = 400): Response { return json({ error: message }, status); }

// ─── CACHE ───

const _cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL_VALS = { QUOTE: 30_000, MOVERS: 60_000, HISTORY: 300_000, NEWS: 300_000, FUNDAMENTALS: 600_000, SEARCH: 600_000 };
function cGet<T>(key: string): T | null { const e = _cache.get(key); if (!e) return null; if (Date.now() < e.expiresAt) return e.data as T; _cache.delete(key); return null; }
function cSet(key: string, data: unknown, ttlMs: number) { _cache.set(key, { data, expiresAt: Date.now() + ttlMs }); }

setInterval(() => { const n = Date.now(); for (const [k, v] of _cache) { if (n >= v.expiresAt) _cache.delete(k); } }, 60_000);

// ─── UTILITY ───

function assetClass(symbol: string): string {
  const u = symbol.toUpperCase();
  const cr = new Set(["BTC","ETH","SOL","XRP","ADA","DOGE","DOT","AVAX","MATIC","LINK","UNI","ATOM","LTC","BCH","FIL","ALGO","NEAR","APT","ARB","OP","SHIB","PEPE","WIF","BONK","FLOKI"]);
  if (cr.has(u)) return "crypto";
  if (u.includes("/")) return "forex";
  if (u.endsWith("=F") || u.endsWith("=X")) return "commodities";
  const et = new Set(["SPY","QQQ","DIA","IWM","VTI","VOO","IVV","BND","GLD","VWO","EFA","TLT","XLF","XLK","XLV","XLE","XLI","XLY","XLP","XLU"]);
  if (et.has(u)) return "sp500";
  return "stocks";
}

function slp(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── FINNHUB ───

namespace FH {
  const k = () => Deno.env.get("FINNHUB_API_KEY") ?? "";
  const B = "https://finnhub.io/api/v1";
  async function get(url: string, r = 2): Promise<any> {
    for (let a = 0; a <= r; a++) { const res = await fetch(url); if (res.ok) return await res.json(); if (res.status === 429) { await slp(Math.min(1000 * 2 ** a, 4000)); continue; } if (res.status >= 500) { await slp(500 * 2 ** a); continue; } throw new Error(`FH ${res.status}`); }
    throw new Error("FH exhausted");
  }
  export async function q(sym: string): Promise<QuoteResult | null> {
    const ck = `fq_${sym}`; const c = cGet<QuoteResult>(ck); if (c) return c;
    try { const d = await get(`${B}/quote?symbol=${sym}&token=${k()}`); if (d.c === 0 || d.c == null) return null; const r: QuoteResult = { symbol: sym, name: "", price: d.c, change: d.d ?? 0, changePercent: d.dp ?? 0, high24h: d.h, low24h: d.l, volume: d.v }; cSet(ck, r, TTL_VALS.QUOTE); return r; }
    catch (e) { console.error(`[FH] q ${sym}:`, e); return null; }
  }
  export async function prof(sym: string): Promise<{ name: string; marketCap?: number; sector?: string } | null> {
    const ck = `fp_${sym}`; const c = cGet<any>(ck); if (c) return c;
    try { const d = await get(`${B}/stock/profile2?symbol=${sym}&token=${k()}`); if (!d.name) return null; const r = { name: d.name, marketCap: d.marketCapitalization, sector: d.finnhubIndustry }; cSet(ck, r, TTL_VALS.FUNDAMENTALS); return r; }
    catch (e) { console.error(`[FH] p ${sym}:`, e); return null; }
  }
  export async function fin(sym: string): Promise<{ peRatio?: number; dividendYield?: number; beta?: number }> {
    const ck = `ff_${sym}`; const c = cGet<any>(ck); if (c) return c;
    try { const d = await get(`${B}/stock/metric?symbol=${sym}&metric=all&token=${k()}`); const m = d?.metric ?? {}; const r = { peRatio: m.peRatio, dividendYield: (m.dividendYield ?? 0) * 100, beta: m.beta }; cSet(ck, r, TTL_VALS.FUNDAMENTALS); return r; }
    catch (e) { console.error(`[FH] f ${sym}:`, e); return {}; }
  }
  export async function n(sym?: string): Promise<NewsArticle[]> {
    const ck = `fn_${sym ?? "a"}`; const c = cGet<NewsArticle[]>(ck); if (c) return c;
    try { const q = sym ? `symbol=${sym}` : "category=general"; const d = await get(`${B}/news?${q}&token=${k()}`); const a: NewsArticle[] = (d ?? []).slice(0,50).map((x: any, i: number) => ({ id: `fh_${i}_${Date.now()}`, title: x.headline ?? "", description: x.summary ?? "", url: x.url ?? "", source: x.source ?? "Finnhub", publishedAt: new Date((x.datetime ?? 0) * 1000).toISOString(), thumbnailUrl: x.image, sentiment: x.sentiment ?? "neutral", relatedSymbols: (x.related ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) })); cSet(ck, a, TTL_VALS.NEWS); return a; }
    catch (e) { console.error("[FH] n:", e); return []; }
  }
  export async function candles(sym: string, fr: number, to: number, res: string): Promise<HistoryPoint[] | null> {
    try { const d = await get(`${B}/stock/candle?symbol=${sym}&resolution=${res}&from=${fr}&to=${to}&token=${k()}`); if (d?.s !== "ok") return null; const ts = d.t as number[] ?? [], cl = d.c as number[] ?? []; return ts.map((t: number, i: number) => ({ timestamp: new Date(t * 1000).toISOString().slice(0, 10), value: cl[i] ?? 0 })).filter((p: HistoryPoint) => p.value > 0); }
    catch (e) { console.error(`[FH] c ${sym}:`, e); return null; }
  }
  export async function srch(qry: string): Promise<SearchResult[]> {
    const ck = `fs_${qry}`; const c = cGet<SearchResult[]>(ck); if (c) return c;
    try { const d = await get(`${B}/search?q=${encodeURIComponent(qry)}&token=${k()}`); const r = (d?.result ?? []).map((x: any) => ({ symbol: x.symbol ?? "", name: x.description ?? "", assetClass: x.type === "ETF" || x.type === "Index" ? "sp500" : "stocks" })); cSet(ck, r, TTL_VALS.SEARCH); return r; }
    catch (e) { console.error(`[FH] s ${qry}:`, e); return []; }
  }
}

// ─── ALPHA VANTAGE ───

namespace AV {
  const k = () => Deno.env.get("ALPHA_VANTAGE_API_KEY") ?? "";
  const B = "https://www.alphavantage.co/query";
  async function gj(params: Record<string, string>, r = 1): Promise<any> {
    for (let a = 0; a <= r; a++) {
      const res = await fetch(`${B}?${new URLSearchParams({ ...params, apikey: k() })}`);
      if (!res.ok) { await slp(1000); continue; }
      const d = await res.json();
      if (d.Information || d.Note) { console.warn(`[AV] ${d.Information ?? d.Note}`); if (a < r) { await slp(2000); continue; } return {}; }
      return d;
    }
    return {};
  }
  export async function q(sym: string): Promise<QuoteResult | null> {
    const ck = `avq_${sym}`; const c = cGet<QuoteResult>(ck); if (c) return c;
    try { const d = await gj({ function: "GLOBAL_QUOTE", symbol: sym }); const gq = d["Global Quote"]; if (!gq) return null; const price = parseFloat(gq["05. price"]) || 0, change = parseFloat(gq["09. change"]) || 0, prev = parseFloat(gq["08. previous close"]) || price; const r: QuoteResult = { symbol: sym, name: "", price, change, changePercent: prev > 0 ? (change / prev) * 100 : 0, high24h: parseFloat(gq["03. high"]) || undefined, low24h: parseFloat(gq["04. low"]) || undefined, volume: parseInt(gq["06. volume"]) || undefined }; if (r.price > 0) { cSet(ck, r, TTL_VALS.QUOTE); return r; } return null; }
    catch (e) { console.error(`[AV] q ${sym}:`, e); return null; }
  }
  export async function hist(sym: string, range: string): Promise<HistoryPoint[] | null> {
    const ck = `avh_${sym}_${range}`; const c = cGet<HistoryPoint[]>(ck); if (c) return c;
    try { const os = range === "1Y" || range === "90D" ? "full" : "compact"; const d = await gj({ function: "TIME_SERIES_DAILY_ADJUSTED", symbol: sym, outputsize: os }); const ts = d["Time Series (Daily)"]; if (!ts) return null; const pts: HistoryPoint[] = Object.entries(ts).map(([date, vals]: any) => ({ timestamp: date, value: parseFloat(vals["4. close"]) || 0 })); if (pts.length === 0) return null; const dm: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 }; const days = dm[range] ?? 30; const tr = pts.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-days); cSet(ck, tr, TTL_VALS.HISTORY); return tr; }
    catch (e) { console.error(`[AV] h ${sym}:`, e); return null; }
  }
  export async function fn(sym: string): Promise<FundamentalsResult | null> {
    const ck = `avfn_${sym}`; const c = cGet<FundamentalsResult>(ck); if (c) return c;
    try { const d = await gj({ function: "OVERVIEW", symbol: sym }); if (!d.Symbol) return null; const r: FundamentalsResult = { marketCap: parseFloat(d.MarketCapitalization) || undefined, peRatio: parseFloat(d.PERatio) || undefined, dividendYield: parseFloat(d.DividendYield) || undefined, beta: parseFloat(d.Beta) || undefined, sector: d.Sector, industry: d.Industry }; cSet(ck, r, TTL_VALS.FUNDAMENTALS); return r; }
    catch (e) { console.error(`[AV] fn ${sym}:`, e); return null; }
  }
  export async function fx(from: string, to: string): Promise<QuoteResult | null> {
    const sym = `${from}/${to}`; const ck = `avfx_${from}_${to}`; const c = cGet<QuoteResult>(ck); if (c) return c;
    try { const d = await gj({ function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to }); const r = d["Realtime Currency Exchange Rate"]; if (!r) return null; const price = parseFloat(r["5. Exchange Rate"]) || 0, change = parseFloat(r["9. Change"]) || 0, prev = parseFloat(r["8. Previous Close"]) || price; const qr: QuoteResult = { symbol: sym, name: sym, price, change, changePercent: prev > 0 ? (change / prev) * 100 : 0, high24h: parseFloat(r["3. High"]) || undefined, low24h: parseFloat(r["4. Low"]) || undefined }; cSet(ck, qr, TTL_VALS.QUOTE); return qr; }
    catch (e) { console.error(`[AV] fx ${from}/${to}:`, e); return null; }
  }
}

// ─── COINGECKO ───

namespace CG {
  const k = () => Deno.env.get("COINGECKO_API_KEY") ?? "";
  const B = "https://api.coingecko.com/api/v3";
  function hd(): Record<string, string> { const h: Record<string, string> = { Accept: "application/json" }; const kk = k(); if (kk) h["x-cg-pro-api-key"] = kk; return h; }
  async function get(path: string, r = 2): Promise<any> {
    for (let a = 0; a <= r; a++) {
      const res = await fetch(`${B}${path}`, { headers: hd() });
      if (res.ok) return await res.json();
      if (res.status === 429) { await slp(Math.min(2000 * 2 ** a, 8000)); continue; }
      if (res.status >= 500) { await slp(1000); continue; }
      console.error(`[CG] ${res.status}`); return null;
    }
    return null;
  }
  const ID: Record<string, string> = { BTC:"bitcoin",ETH:"ethereum",SOL:"solana",XRP:"ripple",ADA:"cardano",DOGE:"dogecoin",DOT:"polkadot",AVAX:"avalanche-2",MATIC:"matic-network",LINK:"chainlink",UNI:"uniswap",ATOM:"cosmos",LTC:"litecoin",BCH:"bitcoin-cash",FIL:"filecoin",ALGO:"algorand",NEAR:"near",APT:"aptos",ARB:"arbitrum",OP:"optimism",SHIB:"shiba-inu",PEPE:"pepe",WIF:"dogwifhat",BONK:"bonk",FLOKI:"floki" };
  function id(s: string): string { return ID[s.toUpperCase()] ?? s.toLowerCase(); }

  export async function q(sym: string): Promise<QuoteResult | null> {
    const ck = `cgq_${sym}`; const c = cGet<QuoteResult>(ck); if (c) return c;
    try { const d = await get(`/coins/${id(sym)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`); if (!d?.id) return null; const md = d.market_data ?? {}; const price = md.current_price?.usd ?? 0; const cp = md.price_change_percentage_24h ?? 0; const r: QuoteResult = { symbol: sym.toUpperCase(), name: d.name ?? sym, price, change: price * (cp / 100), changePercent: cp, high24h: md.high_24h?.usd, low24h: md.low_24h?.usd, volume: md.total_volume?.usd, marketCap: md.market_cap?.usd }; cSet(ck, r, TTL_VALS.QUOTE); return r; }
    catch (e) { console.error(`[CG] q ${sym}:`, e); return null; }
  }
  export async function hist(sym: string, range: string): Promise<HistoryPoint[] | null> {
    const ck = `cgh_${sym}_${range}`; const c = cGet<HistoryPoint[]>(ck); if (c) return c;
    try { const dm: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 }; const days = dm[range] ?? 30; const d = await get(`/coins/${id(sym)}/market_chart?vs_currency=usd&days=${days}`); if (!d?.prices) return null; const pts: HistoryPoint[] = (d.prices as [number, number][]).map(([ts, val]) => ({ timestamp: new Date(ts).toISOString().slice(0, 10), value: val })); if (pts.length > 0) cSet(ck, pts, TTL_VALS.HISTORY); return pts; }
    catch (e) { console.error(`[CG] h ${sym}:`, e); return null; }
  }
  export async function movers(limit = 30): Promise<QuoteResult[]> {
    const ck = "cgmv"; const c = cGet<QuoteResult[]>(ck); if (c) return c;
    try { const data = await get(`/coins/markets?vs_currency=usd&order=volume_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage_24h`); if (!Array.isArray(data)) return []; const r: QuoteResult[] = (data as any[]).map(item => { const price = item.current_price ?? 0; const cp = item.price_change_percentage_24h ?? 0; return { symbol: (item.symbol ?? "").toUpperCase(), name: item.name ?? "", price, change: price * (cp / 100), changePercent: cp, marketCap: item.market_cap, volume: item.total_volume }; }).filter(q => q.price > 0); cSet(ck, r, TTL_VALS.MOVERS); return r; }
    catch (e) { console.error("[CG] mv:", e); return []; }
  }
  export async function srch(qry: string): Promise<SearchResult[]> {
    const ck = `cgs_${qry}`; const c = cGet<SearchResult[]>(ck); if (c) return c;
    try { const d = await get(`/search?query=${encodeURIComponent(qry)}`); const coins = d?.coins ?? []; const r = coins.slice(0, 10).map((c: any) => ({ symbol: (c.symbol ?? "").toUpperCase(), name: c.name ?? "", assetClass: "crypto" })); cSet(ck, r, TTL_VALS.SEARCH); return r; }
    catch (e) { console.error(`[CG] s ${qry}:`, e); return []; }
  }
}

// ─── ROUTE HANDLERS ───

async function hQuote(sym: string, ac: string): Promise<QuoteResult | null> {
  if (ac === "crypto") return CG.q(sym);
  if (ac === "forex") { const p = sym.split("/"); if (p.length === 2) { const fh = await FH.q(`${p[0]}${p[1]}`); if (fh?.price > 0) return fh; return AV.fx(p[0], p[1]); } }
  const fh = await FH.q(sym); if (fh?.price > 0) return fh; return AV.q(sym);
}

async function hMovers(ac?: string): Promise<QuoteResult[]> {
  if (ac === "crypto") return CG.movers();
  let syms: string[];
  if (ac === "stocks") syms = ["AAPL","MSFT","GOOGL","AMZN","TSLA","NVDA","META","JPM","V","JNJ"];
  else if (ac === "forex") syms = ["EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","USD/CAD"];
  else if (ac === "sp500") syms = ["SPY","QQQ","DIA","IWM","VTI","VOO","GLD"];
  else if (ac === "commodities") syms = ["GC=F","SI=F","CL=F","NG=F"];
  else return [...await hMovers("stocks"), ...await hMovers("crypto"), ...await hMovers("forex"), ...await hMovers("sp500"), ...await hMovers("commodities")];
  const ck = `mv_${ac}`; const c = cGet<QuoteResult[]>(ck); if (c) return c;
  const r: QuoteResult[] = [];
  for (const s of syms) { const q = await hQuote(s, assetClass(s)); if (q) { if (!q.name && assetClass(s) === "stocks") { const p = await FH.prof(s); if (p) q.name = p.name; } r.push(q); } }
  r.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)); cSet(ck, r, TTL_VALS.MOVERS); return r;
}

async function hHist(sym: string, ac: string, range: string): Promise<HistoryPoint[] | null> {
  if (ac === "crypto") return CG.hist(sym, range);
  const av = await AV.hist(sym, range); if (av && av.length > 0) return av;
  const dm: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };
  const days = dm[range] ?? 30; const res = days <= 7 ? "60" : "D"; const to = Math.floor(Date.now() / 1000); const fr = to - days * 86400;
  return FH.candles(sym, fr, to, res);
}

async function hNews(sym?: string): Promise<NewsArticle[]> { return FH.n(sym); }

async function hFund(sym: string, ac: string): Promise<FundamentalsResult | null> {
  if (ac === "crypto") { const q = await CG.q(sym); return q ? { marketCap: q.marketCap } : null; }
  if (ac === "commodities") return { sector: "Commodities" };
  const p = await FH.prof(sym); if (p) { const f = await FH.fin(sym); return { ...p, peRatio: f.peRatio, dividendYield: f.dividendYield, beta: f.beta }; }
  return AV.fn(sym);
}

async function hSrch(qry: string, ac?: string): Promise<SearchResult[]> {
  const cg = (!ac || ac === "crypto") ? await CG.srch(qry) : [];
  return cg.length > 0 ? cg : FH.srch(qry);
}

// ─── MAIN ───

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  try {
    // Verify JWT
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    let uid: string | null = null;
    if (auth.startsWith("Bearer ")) {
      const { data: { user }, error: ae } = await supabase.auth.getUser(auth.slice(7));
      if (!ae && user) uid = user.id;
      else console.warn("[MDP] auth:", ae?.message);
    }

    const body = await req.json() as Record<string, unknown>;
    const type = body.type as string;
    const sym = (body.symbol as string) ?? "";
    const ac = (body.assetClass as string) ?? assetClass(sym);
    const range = (body.range as string) ?? "30D";
    const qry = (body.query as string) ?? "";

    console.log(`[MDP] type=${type} sym=${sym} ac=${ac} uid=${uid ?? "anon"}`);

    let data: unknown;
    let provider = "unknown";
    switch (type) {
      case "quote": data = await hQuote(sym, ac); provider = ac === "crypto" ? "coingecko" : "finnhub"; break;
      case "movers": data = await hMovers(ac || undefined); provider = ac === "crypto" ? "coingecko" : "finnhub"; break;
      case "history": data = await hHist(sym, ac, range); provider = ac === "crypto" ? "coingecko" : "alphavantage"; break;
      case "news": data = await hNews(sym || undefined); provider = "finnhub"; break;
      case "fundamentals": data = await hFund(sym, ac); provider = ac === "crypto" ? "coingecko" : "finnhub"; break;
      case "search": data = await hSrch(qry, ac || undefined); provider = "multi"; break;
      default: return err(`Unknown type: ${type}`);
    }

    return json({ provider, cached: false, data, meta: { type, symbol: sym, assetClass: ac, requestedAt: new Date().toISOString() } });
  } catch (e) {
    console.error("[MDP]", e);
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
});