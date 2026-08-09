import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Star, ArrowLeft, Clock,
  BarChart3, Globe, Activity, Send,
  AlertTriangle, ExternalLink, Bot,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useWatchlist } from "../contexts/WatchlistContext";
import {
  getAssetBySymbol,
  getPriceHistory,
  getKeyStats,
  getFundamentals,
  getAssetRelatedNews,
  getAISynthesis,
  getAIChatResponse,
} from "../lib/api";
import { FALLBACK_DISCLAIMER } from "../lib/constants";
import type { MarketMover, AssetFundamentals, NewsArticle, ChatMessage, ChartPoint, TimeRange } from "../types";

/* ───── Formatting Helpers ───── */

function fmtPrice(v: number): string {
  if (v < 0.0001) return `$${v.toExponential(2)}`;
  if (v < 1) return `$${v.toFixed(6)}`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLarge(n: number | undefined | null): string {
  if (n == null) return "--";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function fmtSupply(n: number | undefined | null): string {
  if (n == null) return "--";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((now.getTime() - d.getTime()) / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

const RANGES: TimeRange[] = ["1D", "7D", "30D", "90D", "1Y"];

/* ───── Skeleton ───── */

function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-surface-elevated" style={{ opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  );
}

/* ───── Fund Row ───── */

function FundRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-lighter">{label}</p>
      <p className="mt-0.5 font-heading text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ───── Stat Card ───── */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-elevated/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-lighter">{label}</p>
      <p className="mt-0.5 font-heading text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ───── Component ───── */

export default function AssetInsights() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { items, addItem, removeItem, isTracked } = useWatchlist();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data state
  const [asset, setAsset] = useState<MarketMover | null>(null);
  const [assetLoading, setAssetLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30D");
  const [keyStats, setKeyStats] = useState<{
    high52w: number; low52w: number; ma50: number; ma200: number;
  } | null>(null);
  const [fundamentals, setFundamentals] = useState<AssetFundamentals | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(true);
  const [assetError, setAssetError] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (!symbol) return;
    const sym: string = symbol;
    let cancelled = false;

    async function load() {
      setAssetLoading(true);
      setSynthesisLoading(true);
      setAssetError(false);

      const assetData = await getAssetBySymbol(sym);
      if (cancelled) return;

      if (!assetData) {
        setAssetError(true);
        setAssetLoading(false);
        return;
      }
      setAsset(assetData);
      setAssetLoading(false);

      // Load each data source independently so one failure doesn't block others
      const [statsData, fundData, newsData, synthData] = await Promise.all([
        getKeyStats(sym).catch(() => null),
        getFundamentals(sym).catch(() => null),
        getAssetRelatedNews(sym).catch(() => []),
        getAISynthesis(sym).catch(() => "AI analysis is temporarily unavailable. _Informational only. Not investment advice._"),
      ]);
      if (cancelled) return;

      setKeyStats(statsData);
      setFundamentals(fundData);
      setNews(newsData);
      setSynthesis(synthData);
      setSynthesisLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [symbol]);

  // Load chart data when range changes
  useEffect(() => {
    if (!symbol || !asset) return;
    const sym: string = symbol;
    let cancelled = false;

    async function loadChart() {
      setChartLoading(true);
      try {
        const data = await getPriceHistory(sym, range);
        if (!cancelled) {
          setChartData(data);
        }
      } catch (err) {
        console.warn("[AssetInsights] Chart load failed:", err);
        if (!cancelled) setChartData([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }
    loadChart();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Watchlist toggle
  const handleWatchlistToggle = useCallback(() => {
    if (!symbol || !asset) return;
    if (isTracked(symbol)) {
      const item = items.find((i) => i.symbol === symbol);
      if (item) removeItem(item.id);
    } else {
      addItem(symbol, asset.name, asset.assetClass);
    }
  }, [symbol, asset, items, isTracked, addItem, removeItem]);

  // Chat submit
  const handleChatSubmit = useCallback(async () => {
    const q = chatInput.trim();
    if (!q || !symbol) return;
    setChatInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    const conversation = [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const reply = await getAIChatResponse(symbol, conversation, q);

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
    setChatLoading(false);
  }, [chatInput, chatMessages, symbol]);

  // Loading state
  if (assetLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 rounded bg-surface-elevated" />
          <div className="h-56 rounded-2xl bg-surface-elevated" />
          <div className="h-40 rounded-2xl bg-surface-elevated" />
          <div className="h-32 rounded-2xl bg-surface-elevated" />
        </div>
      </div>
    );
  }

  // Error state
  if (assetError || !asset) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="glass-card p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-warning" />
          <p className="mt-4 text-lg font-medium text-foreground">Asset not found</p>
          <p className="mt-2 text-sm text-muted">
            We couldn&apos;t find data for &ldquo;{symbol}&rdquo;
          </p>
        </div>
      </div>
    );
  }

  const tracked = symbol ? isTracked(symbol) : false;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6 lg:pb-36">
      {/* ════════ HEADER ════════ */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={handleWatchlistToggle}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
            tracked
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:border-accent/30 hover:text-foreground"
          }`}
        >
          <Star size={16} className={tracked ? "fill-accent text-accent" : ""} />
          {tracked ? "Tracked" : "Track Asset"}
        </button>
      </div>

      {/* ════════════════════════════════════════
          SECTION 1 — PRICE ACTION
          ════════════════════════════════════════ */}
      <section className="glass-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-block rounded-md bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium uppercase text-muted-lighter">
              {asset.assetClass === "meme_coins" ? "MEME" : asset.assetClass}
            </span>
            <h1 className="mt-1 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              {asset.symbol}
            </h1>
            <p className="mt-1 text-base text-muted">{asset.name}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-4xl font-bold text-foreground sm:text-5xl">
              {fmtPrice(asset.price)}
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {asset.changePercent >= 0 ? (
                <TrendingUp size={20} className="text-success" />
              ) : (
                <TrendingDown size={20} className="text-destructive" />
              )}
              <span className={`text-xl font-bold ${asset.changePercent >= 0 ? "text-success" : "text-destructive"}`}>
                {asset.changePercent >= 0 ? "+" : ""}
                {asset.changePercent.toFixed(2)}%
              </span>
              <span className="text-sm text-muted-lighter">
                ({asset.change >= 0 ? "+" : ""}${Math.abs(asset.change).toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        {/* Time range selector */}
        <div className="mt-6 flex items-center gap-1 border-b border-border pb-3">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                range === r
                  ? "bg-accent text-background"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="mt-4 h-[220px] w-full sm:h-[260px]">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-48 w-full animate-pulse rounded bg-surface-elevated" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted">No chart data available for this time range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 10 }}
                  tickFormatter={(v: string) => {
                    if (range === "1D") return new Date(v).toLocaleTimeString([], { hour: "2-digit" });
                    if (range === "7D" || range === "30D") return v.slice(5);
                    return v.slice(0, 7);
                  }}
                  minTickGap={40}
                />
                <YAxis
                  domain={["dataMin - 1%", "dataMax + 1%"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 10 }}
                  tickFormatter={(v: number) => fmtPrice(v)}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "#252525",
                    border: "1px solid #333",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#F8FAFC",
                  }}
                  formatter={(value: unknown) => [fmtPrice(value as number), "Price"]}
                  labelFormatter={(label: unknown) => String(label)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  fill="url(#priceGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#C9A84C", stroke: "#1A1A1A", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Key stats row */}
        {keyStats && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="52W High" value={fmtPrice(keyStats.high52w)} />
            <StatCard label="52W Low" value={fmtPrice(keyStats.low52w)} />
            <StatCard label="50-Day MA" value={fmtPrice(keyStats.ma50)} />
            <StatCard label="200-Day MA" value={fmtPrice(keyStats.ma200)} />
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════
          SECTION 2 — FUNDAMENTALS
          ════════════════════════════════════════ */}
      <section className="mt-6 glass-card p-6 sm:p-8">
        <h2 className="font-heading text-base font-semibold text-foreground">
          <BarChart3 size={16} className="mr-2 inline-block text-accent" />
          Fundamentals
        </h2>

        {!fundamentals ? (
          <div className="mt-4 text-center py-6">
            <p className="text-sm text-muted">No fundamental data available for this asset.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {/* Stocks / ETF */}
            {fundamentals.sector && (
              <>
                <FundRow label="Sector" value={fundamentals.sector} />
                {fundamentals.marketCap != null && <FundRow label="Market Cap" value={fmtLarge(fundamentals.marketCap)} />}
                {fundamentals.peRatio != null && <FundRow label="P/E Ratio" value={fundamentals.peRatio.toFixed(1)} />}
                {fundamentals.dividendYield != null && <FundRow label="Div. Yield" value={`${fundamentals.dividendYield}%`} />}
                {fundamentals.beta != null && <FundRow label="Beta" value={fundamentals.beta.toFixed(2)} />}
              </>
            )}

            {/* Crypto — Binance volume data (no CoinGecko enrichment) */}
            {fundamentals.volume24h != null && fundamentals.circulatingSupply == null && (
              <>
                {fundamentals.marketCap != null && <FundRow label="Market Cap" value={fmtLarge(fundamentals.marketCap)} />}
                <FundRow label="24h Volume" value={fmtLarge(fundamentals.volume24h)} />
                {fundamentals.allTimeHigh != null && <FundRow label="All-Time High" value={fmtPrice(fundamentals.allTimeHigh)} />}
              </>
            )}

            {/* Crypto */}
            {fundamentals.circulatingSupply != null && (
              <>
                {fundamentals.marketCap != null && <FundRow label="Market Cap" value={fmtLarge(fundamentals.marketCap)} />}
                <FundRow label="Circ. Supply" value={fmtSupply(fundamentals.circulatingSupply)} />
                {fundamentals.totalSupply != null && <FundRow label="Total Supply" value={fmtSupply(fundamentals.totalSupply)} />}
                {fundamentals.allTimeHigh != null && <FundRow label="All-Time High" value={fmtPrice(fundamentals.allTimeHigh)} />}
              </>
            )}

            {/* Meme tokens */}
            {fundamentals.liquidity != null && (
              <>
                {fundamentals.marketCap != null && <FundRow label="Market Cap" value={fmtLarge(fundamentals.marketCap)} />}
                <FundRow label="Liquidity" value={fmtLarge(fundamentals.liquidity)} />
                {fundamentals.volume24h != null && <FundRow label="24h Volume" value={fmtLarge(fundamentals.volume24h)} />}
                {fundamentals.holderCount != null && <FundRow label="Holders" value={fundamentals.holderCount.toLocaleString()} />}
              </>
            )}

            {/* Forex */}
            {fundamentals.yearHigh != null && (
              <>
                <FundRow label="1Y High" value={fmtPrice(fundamentals.yearHigh)} />
                {fundamentals.yearLow != null && <FundRow label="1Y Low" value={fmtPrice(fundamentals.yearLow)} />}
                {fundamentals.centralBankRate != null && (
                  <FundRow label="Central Bank Rate" value={`${fundamentals.centralBankRate}%`} />
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════
          SECTION 3 — RECENT NEWS
          ════════════════════════════════════════ */}
      <section className="mt-6 glass-card p-6 sm:p-8">
        <h2 className="font-heading text-base font-semibold text-foreground">
          <Globe size={16} className="mr-2 inline-block text-accent" />
          Recent News
        </h2>

        {news.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No recent news items found for {symbol}.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {news.slice(0, 5).map((article) => (
              <li key={article.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-snug">{article.title}</p>
                    <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{article.description}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-lighter">
                      <span>{article.source}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(article.publishedAt)}
                      </span>
                      {article.sentiment && (
                        <span
                          className={
                            article.sentiment === "positive"
                              ? "text-success"
                              : article.sentiment === "negative"
                              ? "text-destructive"
                              : "text-muted"
                          }
                        >
                          {article.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 shrink-0 text-muted-lighter transition-colors hover:text-foreground"
                    aria-label="Open article"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ════════════════════════════════════════
          SECTION 4 — AI SYNTHESIS
          ════════════════════════════════════════ */}
      <section className="mt-6 glass-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-8 -translate-y-8 rounded-full bg-accent/5 blur-3xl" />
        <h2 className="relative font-heading text-base font-semibold text-foreground">
          <Bot size={16} className="mr-2 inline-block text-accent" />
          AI Market Synthesis
        </h2>

        <div className="relative mt-4">
          {synthesisLoading ? (
            <div className="space-y-4">
              <SectionSkeleton lines={3} />
              <p className="animate-pulse text-xs text-accent-dim">Analyzing market data&hellip;</p>
            </div>
          ) : synthesis ? (
            <>
              {synthesis.split("\n\n").map((para, i) => {
                const rendered = para
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/_(.+?)_/g, "<em>$1</em>");
                return (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_em]:text-muted-lighter"
                    dangerouslySetInnerHTML={{ __html: rendered }}
                  />
                );
              })}
              <p className="mt-4 text-xs text-muted-lighter italic">{FALLBACK_DISCLAIMER}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Synthesis unavailable for this asset.</p>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════
          CHAT CONVERSATION
          ════════════════════════════════════════ */}
      {chatMessages.length > 0 && (
        <section className="mt-6 glass-card p-6 sm:p-8">
          <h2 className="font-heading text-base font-semibold text-foreground mb-4">
            <Activity size={16} className="mr-2 inline-block text-accent" />
            Conversation
          </h2>
          <div className="space-y-4">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-background"
                      : "bg-surface-elevated text-muted"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#F8FAFC'>$1</strong>")
                          .replace(/_(.+?)_/g, "<em>$1</em>"),
                      }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-surface-elevated px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent-dim" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent-dim" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-accent-dim" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </section>
      )}

      {/* ── Chat input bar (fixed bottom) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/80 px-4 pb-4 pt-3 backdrop-blur-xl sm:pl-72">
        <form
          onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }}
          className="mx-auto flex max-w-4xl items-center gap-3"
        >
          <div className="relative flex flex-1 items-center">
            <Bot size={16} className="absolute left-3 text-muted-lighter" />
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask a follow-up question about ${symbol}`}
              className="w-full rounded-xl border border-border bg-surface-elevated py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-lighter transition-all duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              disabled={chatLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-background transition-all duration-150 hover:bg-accent-hover active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}