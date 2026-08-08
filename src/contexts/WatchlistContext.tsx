import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
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

const STORAGE_KEY = "sharpfunds_watchlist";

function loadFromLocalStorage(): WatchlistItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveToLocalStorage(items: WatchlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>(() => loadFromLocalStorage());

  // Persist to localStorage on every change
  useEffect(() => {
    saveToLocalStorage(items);
  }, [items]);

  // Load from Supabase when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    supabase
      .from("watchlist_items")
      .select("*")
      .eq("user_id", user.id)
      .order("added_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const loaded: WatchlistItem[] = data.map((row: any) => ({
            id: row.id,
            symbol: row.symbol,
            name: row.name,
            assetClass: row.asset_class as AssetClass,
            addedAt: row.added_at,
          }));
          setItems(loaded);
        }
      })
      .catch(() => { /* use local state */ });
  }, [isAuthenticated, user?.id]);

  const persistToSupabase = useCallback((updatedItems: WatchlistItem[]) => {
    if (!isAuthenticated || !user?.id) return;
    supabase
      .from("watchlist_items")
      .delete()
      .eq("user_id", user.id)
      .then(() => {
        if (updatedItems.length === 0) return;
        const rows = updatedItems.map((item) => ({
          user_id: user.id,
          symbol: item.symbol,
          name: item.name,
          asset_class: item.assetClass,
          added_at: item.addedAt,
        }));
        return supabase.from("watchlist_items").insert(rows);
      })
      .catch(() => { /* local storage is the fallback */ });
  }, [isAuthenticated, user?.id]);

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
      const updated = [...prev, newItem];
      setTimeout(() => persistToSupabase(updated), 0);
      return updated;
    });
  }, [persistToSupabase]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      setTimeout(() => persistToSupabase(updated), 0);
      return updated;
    });
  }, [persistToSupabase]);

  const isTracked = useCallback(
    (symbol: string) => items.some((i) => i.symbol === symbol),
    [items]
  );

  const clearAll = useCallback(() => {
    setItems([]);
    setTimeout(() => persistToSupabase([]), 0);
  }, [persistToSupabase]);

  const setInitialItems = useCallback(
    (newItems: { symbol: string; name: string; assetClass: AssetClass }[]) => {
      const mapped = newItems.map((item, i) => ({
        id: `w_${Date.now()}_${i}`,
        symbol: item.symbol,
        name: item.name,
        assetClass: item.assetClass,
        addedAt: new Date().toISOString(),
      }));
      setItems(mapped);
      setTimeout(() => persistToSupabase(mapped), 0);
    },
    [persistToSupabase]
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