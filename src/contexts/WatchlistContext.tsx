import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { WatchlistItem, AssetClass } from "../types";

interface WatchlistContextType {
  items: WatchlistItem[];
  addItem: (symbol: string, name: string, assetClass: AssetClass) => void;
  removeItem: (id: string) => void;
  isTracked: (symbol: string) => boolean;
  clearAll: () => void;
  setInitialItems: (items: { symbol: string; name: string; assetClass: AssetClass }[]) => void;
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const DEFAULT_ITEMS: WatchlistItem[] = [
  { id: "w1", symbol: "AAPL", name: "Apple Inc.", assetClass: "stocks", addedAt: new Date().toISOString() },
  { id: "w2", symbol: "TSLA", name: "Tesla Inc.", assetClass: "stocks", addedAt: new Date().toISOString() },
  { id: "w3", symbol: "BTC", name: "Bitcoin", assetClass: "crypto", addedAt: new Date().toISOString() },
  { id: "w4", symbol: "ETH", name: "Ethereum", assetClass: "crypto", addedAt: new Date().toISOString() },
  { id: "w5", symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex", addedAt: new Date().toISOString() },
];

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_ITEMS);

  const addItem = useCallback((symbol: string, name: string, assetClass: AssetClass) => {
    setItems((prev) => {
      if (prev.some((i) => i.symbol === symbol)) return prev;
      const newItem: WatchlistItem = {
        id: `w_${Date.now()}`,
        symbol,
        name,
        assetClass,
        addedAt: new Date().toISOString(),
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const isTracked = useCallback(
    (symbol: string) => items.some((i) => i.symbol === symbol),
    [items]
  );

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const setInitialItems = useCallback(
    (newItems: { symbol: string; name: string; assetClass: AssetClass }[]) => {
      setItems(
        newItems.map((item) => ({
          id: `w_${Date.now()}_${item.symbol}`,
          symbol: item.symbol,
          name: item.name,
          assetClass: item.assetClass,
          addedAt: new Date().toISOString(),
        }))
      );
    },
    []
  );

  return (
    <WatchlistContext.Provider value={{ items, addItem, removeItem, isTracked, clearAll, setInitialItems }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}