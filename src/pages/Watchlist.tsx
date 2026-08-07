import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Search, Trash2, Plus, X } from "lucide-react";
import { useWatchlist } from "../contexts/WatchlistContext";
import { getTopMovers } from "../lib/api";
import type { AssetClass, MarketMover } from "../types";

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "meme_coins", label: "Meme" },
];

export default function Watchlist() {
  const navigate = useNavigate();
  const { items, addItem, removeItem, clearAll } = useWatchlist();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketMover[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const allData = await getTopMovers();
    const filtered = allData.filter(
      (a) =>
        a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered);
    setIsSearching(false);
  };

  const handleAddFromSearch = (symbol: string, name: string, assetClass: AssetClass) => {
    addItem(symbol, name, assetClass);
    // Close modal after adding
    setShowAddModal(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="mt-1 text-sm text-muted">Assets you're tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-lighter hover:text-destructive transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover active:scale-[0.97]"
          >
            <Plus size={16} />
            Add Asset
          </button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
            <Star size={28} className="text-muted-lighter" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Your watchlist is empty</h2>
          <p className="mt-2 text-sm text-muted">
            Start tracking assets from the Dashboard or search for them here
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover active:scale-[0.97]"
          >
            Browse Markets
          </button>
        </div>
      ) : (
        <>
          {/* Watchlist items grouped by class */}
          {ASSET_CLASSES.map((cls) => {
            const classItems = items.filter((i) => i.assetClass === cls.value);
            if (classItems.length === 0) return null;

            return (
              <div key={cls.value} className="mb-6">
                <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-lighter">
                  {cls.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {classItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-card flex items-center justify-between p-4 glass-card-hover"
                    >
                      <button
                        onClick={() => navigate(`/asset/${encodeURIComponent(item.symbol)}`)}
                        className="flex-1 text-left"
                      >
                        <p className="font-heading text-base font-semibold text-foreground">{item.symbol}</p>
                        <p className="text-xs text-muted">{item.name}</p>
                      </button>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-lighter transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${item.symbol}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface border border-border p-6 shadow-2xl animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-semibold text-foreground">Add Asset</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent/50">
              <Search size={16} className="text-muted-lighter" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by symbol or name..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="mt-3 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => handleAddFromSearch(result.symbol, result.name, result.assetClass)}
                    className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:border-accent/30 hover:bg-accent/5"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{result.symbol}</p>
                      <p className="text-xs text-muted">{result.name}</p>
                    </div>
                    <Plus size={16} className="text-accent" />
                  </button>
                ))}
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p className="mt-4 text-center text-sm text-muted">No assets found matching "{searchQuery}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}