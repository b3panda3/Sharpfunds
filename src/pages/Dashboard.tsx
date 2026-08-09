import { useState, useEffect, useCallback, useMemo, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Star, Eye, RefreshCw,
  ArrowUpDown, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";
import { getTopMovers, getAIPlacardCommentary } from "../lib/api";
import { useWatchlist } from "../contexts/WatchlistContext";
import type { MarketMover } from "../types";

/* ───── Stat Card ───── */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs font-medium text-muted-lighter uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/* ───── Floating Placard ───── */

const PlacardCard = forwardRef<HTMLButtonElement, {
  asset: MarketMover;
  commentary: string;
  index: number;
  onViewDetails: () => void;
}>(function PlacardCard({ asset, commentary, index, onViewDetails }, ref) {
  const isPositive = asset.changePercent >= 0;
  const sparkData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        time: `${h}h`,
        value: asset.price + Math.sin(h * 0.5 + index * 0.8) * (asset.price * 0.02) + (Math.random() - 0.5) * (asset.price * 0.01),
      })),
    [asset.price, index]
  );

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      onClick={onViewDetails}
      className={`glass-card glass-card-hover p-4 text-left w-[240px] shrink-0 animate-float cursor-pointer`}
      style={{ animationDelay: `${index * 0.6}s` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{asset.symbol}</span>
          <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-lighter">
            {asset.assetClass === "meme_coins" ? "MEME" : asset.assetClass === "sp500" ? "ETF" : asset.assetClass}
          </span>
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? "text-success" : "text-destructive"}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </div>
      </div>

      {/* Price + Change */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-heading text-xl font-bold text-foreground">
          ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`text-sm font-semibold ${isPositive ? "text-success" : "text-destructive"}`}>
          {isPositive ? "+" : ""}
          {asset.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Mini sparkline */}
      <div className="h-10 w-full mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`sparkGrad${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? "#22C55E" : "#EF4444"} stopOpacity={0.25} />
                <stop offset="100%" stopColor={isPositive ? "#22C55E" : "#EF4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#22C55E" : "#EF4444"}
              strokeWidth={1.5}
              fill={`url(#sparkGrad${index})`}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                background: "#252525",
                border: "1px solid #333",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#F8FAFC",
              }}
              formatter={(value: any) => [`$${value?.toFixed(2) ?? "--"}`, "Price"]}
              labelFormatter={() => ""}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Commentary */}
      <p className="text-[11px] leading-relaxed text-muted line-clamp-2">{commentary}</p>
    </motion.button>
  );
});

/* ───── Top Movers Table ───── */

function TopMoversTable({
  movers,
  onViewDetails,
}: {
  movers: MarketMover[];
  onViewDetails: (symbol: string) => void;
}) {
  const [sortKey, setSortKey] = useState<"symbol" | "changePercent" | "price" | "volume">("changePercent");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...movers];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "changePercent") cmp = a.changePercent - b.changePercent;
      else if (sortKey === "price") cmp = a.price - b.price;
      else if (sortKey === "volume") cmp = (a.volume ?? 0) - (b.volume ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [movers, sortKey, sortAsc]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: typeof sortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-lighter uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown size={12} className={sortKey === field ? "text-accent" : ""} />
    </button>
  );

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart3 size={16} className="text-accent" />
          Top Movers This Hour
        </h3>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted">No movers found for this view</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left">
                  <SortHeader label="Asset" field="symbol" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-lighter uppercase tracking-wide hidden sm:table-cell">
                  Class
                </th>
                <th className="px-3 py-3 text-right">
                  <SortHeader label="Price" field="price" />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortHeader label="24h%" field="changePercent" />
                </th>
                <th className="px-3 py-3 text-right hidden md:table-cell">
                  <SortHeader label="Volume" field="volume" />
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="text-xs font-medium text-muted-lighter uppercase tracking-wide">View</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((asset, i) => {
                const isPos = asset.changePercent >= 0;
                return (
                  <tr
                    key={asset.symbol}
                    className={`transition-colors hover:bg-surface/50 ${
                      i % 2 === 1 ? "bg-surface/20" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{asset.symbol}</span>
                        <span className="text-xs text-muted hidden sm:inline">{asset.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-lighter">
                        {asset.assetClass === "meme_coins" ? "MEME" : asset.assetClass}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-foreground font-heading">
                      ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-sm font-semibold ${
                          isPos ? "text-success" : "text-destructive"
                        }`}
                      >
                        {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isPos ? "+" : ""}
                        {asset.changePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-muted hidden md:table-cell text-xs">
                      {asset.volume ? `${(asset.volume / 1000000).toFixed(1)}M` : "--"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onViewDetails(asset.symbol)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                      >
                        <Eye size={14} />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Watchlist Sidebar ───── */

function WatchlistSidebar({ onViewDetails }: { onViewDetails: (symbol: string) => void }) {
  const { items } = useWatchlist();
  const navigate = useNavigate();

  const topItems = items.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <Star size={16} className="text-accent" />
          Your Watchlist
        </h3>
        {items.length > 0 && (
          <button
            onClick={() => navigate("/watchlist")}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            View all ({items.length})
          </button>
        )}
      </div>

      {topItems.length === 0 ? (
        <div className="py-8 text-center">
          <Star size={24} className="mx-auto mb-2 text-muted-lighter" />
          <p className="text-sm text-muted">No tracked assets yet</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-3 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Start browsing assets
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {topItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewDetails(item.symbol)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-elevated text-[10px] font-bold text-muted-lighter uppercase">
                {item.symbol.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.symbol}</p>
                <p className="text-[11px] text-muted truncate">{item.name}</p>
              </div>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-lighter shrink-0">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* ───── Main Dashboard ───── */

export default function Dashboard() {
  const navigate = useNavigate();
  const [movers, setMovers] = useState<MarketMover[]>([]);
  const [placardCommentaries, setPlacardCommentaries] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const allMovers = await getTopMovers();
      setMovers(allMovers);

      // Pick top placard candidates: 2 biggest gainers + 2 biggest losers + 2 highest abs change
      const sorted = [...allMovers].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
      const placardCandidates = sorted.slice(0, 6);

      // Fetch commentary for each placard's asset class (deduped)
      const classSet = new Set(placardCandidates.map(a => a.assetClass));
      const commentaryMap: Record<string, string> = {};
      await Promise.all(
        Array.from(classSet).map(async (cls) => {
          const text = await getAIPlacardCommentary(cls);
          commentaryMap[cls] = text;
        })
      );
      setPlacardCommentaries(commentaryMap);
      setLastUpdated(new Date());
    } catch {
      setError("Failed to load market data. Pull to refresh.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => fetchData(true);

  const placardMovers = useMemo(() => {
    const sorted = [...movers].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    return sorted.slice(0, 6);
  }, [movers]);

  const topMoversAll = useMemo(() => {
    return [...movers].filter((m) => Math.abs(m.changePercent) > 1);
  }, [movers]);

  // Stats
  const stats = useMemo(() => {
    if (movers.length === 0) return null;
    const gainers = movers.filter((m) => m.changePercent > 0).length;
    const losers = movers.filter((m) => m.changePercent < 0).length;
    const avgChange = movers.reduce((s, m) => s + m.changePercent, 0) / movers.length;
    return { gainers, losers, avgChange, total: movers.length };
  }, [movers]);

  if (isLoading && movers.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-8 max-w-7xl mx-auto w-full">
          {/* Skeleton */}
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-surface-elevated" />
              ))}
            </div>
            <div className="flex gap-4 overflow-x-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-52 w-[240px] shrink-0 rounded-2xl bg-surface-elevated" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-surface-elevated" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">

      <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-8 max-w-7xl mx-auto w-full">
        {/* Refresh + Timestamp inline */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-0.5 text-xs text-muted-lighter">
              {lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : "Updating..."}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-all duration-200 hover:bg-surface hover:text-foreground active:scale-[0.97] disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-3">
            <p className="flex-1 text-sm text-destructive">{error}</p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              Retry
            </button>
          </div>
        )}

        {/* Stat cards */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Assets" value={stats.total.toString()} sub="Tracked markets" />
            <StatCard label="Gainers" value={stats.gainers.toString()} sub="Positive" />
            <StatCard label="Losers" value={stats.losers.toString()} sub="Negative" />
            <StatCard
              label="Avg Change"
              value={`${stats.avgChange >= 0 ? "+" : ""}${stats.avgChange.toFixed(2)}%`}
              sub="Across all assets"
            />
          </div>
        )}

        {/* Floating Placards */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Market Movers</h2>
            <span className="text-[11px] text-muted-lighter">Sorted by volatility</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
            <AnimatePresence mode="popLayout">
              {placardMovers.length === 0 ? (
                <div className="flex items-center justify-center w-full py-12">
                  <p className="text-sm text-muted">No market movers right now</p>
                </div>
              ) : (
                placardMovers.map((asset, i) => (
                  <PlacardCard
                    key={asset.symbol}
                    asset={asset}
                    commentary={placardCommentaries[asset.assetClass] ?? "Loading AI insight..."}
                    index={i}
                    onViewDetails={() => navigate(`/asset/${asset.symbol}`)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Two-column: Top Movers Table + Watchlist */}
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0">
            <TopMoversTable
              movers={topMoversAll.length > 0 ? topMoversAll : movers}
              onViewDetails={(symbol) => navigate(`/asset/${symbol}`)}
            />
          </div>
          <div className="w-full lg:w-72 shrink-0">
            <WatchlistSidebar onViewDetails={(symbol) => navigate(`/asset/${symbol}`)} />
          </div>
        </div>
      </main>
    </div>
  );
}