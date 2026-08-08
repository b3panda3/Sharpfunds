import { useState, useEffect, useCallback, useRef } from "react";
import {
  Newspaper,
  Search,
  RefreshCw,
  Clock,
  ExternalLink,
  Sparkles,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getNews, getNewsAIChatResponse } from "../lib/api";
import { classifyArticle, type NewsCategory } from "../lib/newsClassifier";
import type { NewsArticle } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useWatchlist } from "../contexts/WatchlistContext";
import NewsAIChatbot from "../components/news/NewsAIChatbot";

const FILTER_TAGS: { label: string; value: NewsCategory | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Stocks", value: "Stocks" },
  { label: "Crypto", value: "Crypto" },
  { label: "Forex", value: "Forex" },
  { label: "Macro", value: "Macro" },
  { label: "Earnings", value: "Earnings" },
];

const CATEGORY_STYLES: Record<NewsCategory, { bg: string; text: string }> = {
  Stocks: { bg: "bg-blue-500/10", text: "text-blue-400" },
  Crypto: { bg: "bg-purple-500/10", text: "text-purple-400" },
  Forex: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  Macro: { bg: "bg-amber-500/10", text: "text-amber-400" },
  Earnings: { bg: "bg-green-500/10", text: "text-green-400" },
};

export default function News() {
  const { user } = useAuth();
  const { items: watchlist } = useWatchlist();
  const [news, setNews] = useState<(NewsArticle & { category: NewsCategory })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NewsCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Side panel state — article detail + AI response
  const [selectedArticle, setSelectedArticle] = useState<(NewsArticle & { category: NewsCategory }) | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getNews();
      // Classify and sort by date descending (most recent first)
      const classified = data
        .map((article) => ({
          ...article,
          category: classifyArticle(article.title, article.description),
        }))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setNews(classified);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 min
  useEffect(() => {
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = news.filter((article) => {
    if (activeFilter !== "All" && article.category !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        article.title.toLowerCase().includes(q) ||
        article.description.toLowerCase().includes(q) ||
        article.source.toLowerCase().includes(q) ||
        article.relatedSymbols?.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAskAI = async (article: NewsArticle & { category: NewsCategory }) => {
    setSelectedArticle(article);
    setAiResponse(null);
    setIsAiLoading(true);

    try {
      const headlines = news.slice(0, 5).map((n) => n.title);
      const response = await getNewsAIChatResponse(
        `What does "${article.title}" mean for my portfolio?`,
        {
          displayName: user?.displayName ?? "Investor",
          trackedAssets: watchlist.map((w) => ({
            symbol: w.symbol,
            name: w.name,
            assetClass: w.assetClass,
          })),
          riskTolerance: user?.riskTolerance ?? "balanced",
          experienceLevel: user?.experienceLevel ?? "intermediate",
        },
        headlines
      );
      setAiResponse(response);
    } catch {
      setAiResponse("Sorry, I couldn't analyze that article right now. Please try again. _Informational only. Not investment advice._");
    } finally {
      setIsAiLoading(false);
    }
  };

  const closePanel = () => {
    setSelectedArticle(null);
    setAiResponse(null);
  };

  const sentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp size={14} className="text-success" />;
      case "negative":
        return <TrendingDown size={14} className="text-destructive" />;
      default:
        return <Minus size={14} className="text-muted-lighter" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Market News</h1>
          <p className="mt-1 text-sm text-muted">
            Curated financial headlines
            {user?.assetClasses.length ? ` • ${user.assetClasses.join(", ")}` : ""}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition-all hover:border-accent/30 hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-accent/50">
          <Search size={16} className="text-muted-lighter" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news by keyword, source, or ticker..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => setActiveFilter(tag.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                activeFilter === tag.value
                  ? "bg-accent text-background"
                  : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-lighter">
          <Clock size={12} />
          Updated {lastUpdated.toLocaleTimeString()}
          {filtered.length > 0 && (
            <span className="ml-auto">
              {filtered.length} of {news.length} articles
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main news list */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-3 w-16 rounded bg-surface-elevated" />
                    <div className="h-3 w-12 rounded bg-surface-elevated" />
                  </div>
                  <div className="mb-2 h-5 w-3/4 rounded bg-surface-elevated" />
                  <div className="mb-1 h-4 w-full rounded bg-surface-elevated" />
                  <div className="h-4 w-2/3 rounded bg-surface-elevated" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
                <Newspaper size={28} className="text-muted-lighter" />
              </div>
              <h2 className="font-heading text-lg font-semibold text-foreground">No articles found</h2>
              <p className="mt-2 text-sm text-muted">
                {searchQuery
                  ? "Try a different search term or clear your query"
                  : news.length === 0
                    ? "Financial news requires a NewsAPI key. Set VITE_NEWS_API_KEY on Vercel to enable live news."
                    : "Try a different category filter"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((article) => (
                <div
                  key={`${article.id}-${article.category}`}
                  className="glass-card p-5 glass-card-hover animate-fade-in"
                  style={{ animationDelay: `${Math.random() * 0.15}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="mb-2 flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-medium text-muted-lighter uppercase tracking-wider">
                          {article.source}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[article.category].bg} ${CATEGORY_STYLES[article.category].text}`}
                        >
                          {article.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-lighter">
                          {sentimentIcon(article.sentiment)}
                        </span>
                        <span className="text-xs text-muted-lighter">
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-heading text-base font-semibold text-foreground leading-snug mb-1.5">
                        {article.title}
                      </h3>

                      {/* Summary */}
                      <p className="text-sm text-muted line-clamp-2">{article.description}</p>

                      {/* Symbols */}
                      {article.relatedSymbols && article.relatedSymbols.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {article.relatedSymbols.map((s) => (
                            <span
                              key={s}
                              className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                    >
                      <ExternalLink size={13} />
                      Read more
                    </a>
                    <button
                      onClick={() => handleAskAI(article)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                    >
                      <Sparkles size={13} />
                      Ask AI about this
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop side panel */}
        {selectedArticle && (
          <div
            ref={panelRef}
            className="hidden w-96 shrink-0 lg:block animate-slide-up"
          >
            <div className="sticky top-6 glass-card p-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
              {/* Panel header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-foreground">Article Analysis</h3>
                <button
                  onClick={closePanel}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                  aria-label="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Article excerpt */}
              <div className="mb-4 rounded-lg bg-surface-elevated/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted-lighter uppercase">{selectedArticle.source}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[selectedArticle.category].bg} ${CATEGORY_STYLES[selectedArticle.category].text}`}
                  >
                    {selectedArticle.category}
                  </span>
                </div>
                <h4 className="mb-1 font-heading text-sm font-semibold text-foreground">
                  {selectedArticle.title}
                </h4>
                <p className="text-xs text-muted line-clamp-3">{selectedArticle.description}</p>
                {selectedArticle.relatedSymbols && selectedArticle.relatedSymbols.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedArticle.relatedSymbols.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Response */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span className="text-xs font-medium text-foreground">AI Analysis</span>
                </div>

                {isAiLoading ? (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/5 p-3">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span className="text-xs text-muted-lighter">Analyzing impact on your portfolio...</span>
                  </div>
                ) : (
                  <div className="rounded-lg bg-accent/5 p-3">
                    <p className="text-xs leading-relaxed text-muted whitespace-pre-wrap">
                      {aiResponse}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile article modal (overlays on small screens) */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePanel} />
          <div className="relative z-10 max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-surface border border-border shadow-2xl animate-slide-up">
            <div className="p-5">
              {/* Panel header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-foreground">Article Analysis</h3>
                <button
                  onClick={closePanel}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Article excerpt */}
              <div className="mb-4 rounded-lg bg-surface-elevated/50 p-4">
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-lighter uppercase">{selectedArticle.source}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[selectedArticle.category].bg} ${CATEGORY_STYLES[selectedArticle.category].text}`}
                  >
                    {selectedArticle.category}
                  </span>
                </div>
                <h4 className="mb-1 font-heading text-sm font-semibold text-foreground">
                  {selectedArticle.title}
                </h4>
                <p className="text-xs text-muted line-clamp-3">{selectedArticle.description}</p>
              </div>

              {/* AI Response */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span className="text-xs font-medium text-foreground">AI Analysis</span>
                </div>

                {isAiLoading ? (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/5 p-3">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span className="text-xs text-muted-lighter">Analyzing impact...</span>
                  </div>
                ) : (
                  <div className="rounded-lg bg-accent/5 p-3">
                    <p className="text-xs leading-relaxed text-muted whitespace-pre-wrap">
                      {aiResponse}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <p className="text-[10px] text-muted-lighter italic">
                  Informational only. Not investment advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* News-specific floating chatbot */}
      <NewsAIChatbot
        user={user ?? { id: "", email: "", displayName: "Investor", assetClasses: [], riskTolerance: "balanced", experienceLevel: "intermediate", onboardingComplete: false, createdAt: new Date().toISOString() }}
        watchlist={watchlist}
        recentHeadlines={news.slice(0, 5).map((n) => n.title)}
      />
    </div>
  );
}