import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { X, Sparkles, Send, Loader2, Bot, Trash2, Minus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useWatchlist } from "../../contexts/WatchlistContext";
import { getTopMovers, getAIResponse } from "../../lib/api";
import { EDGE_FUNCTIONS_BASE } from "../../lib/supabase";
import type { ChatMessage, MarketMover } from "../../types";

const SUGGESTIONS = [
  "What's the S&P 500 doing today?",
  "Explain moving averages",
  "Compare BTC and ETH this week",
];

export default function GlobalAIAssistant() {
  const { user } = useAuth();
  const { items: watchlist } = useWatchlist();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm Sharpfunds AI. Ask me about market trends, your watchlist assets, or financial concepts. I'll never give specific buy/sell recommendations — just insights to help you make informed decisions.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showTooltip && !isOpen) {
      const timer = setTimeout(() => setShowTooltip(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip, isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const clearConversation = useCallback(() => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        content:
          "Hi! I'm Sharpfunds AI. Ask me about market trends, your watchlist assets, or financial concepts.",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let aiContent: string;

      // Try edge function first (if deployed)
      if (EDGE_FUNCTIONS_BASE && EDGE_FUNCTIONS_BASE !== "/functions/v1") {
        try {
          const recentHeadlines: string[] = [];
          const currentPrices: { symbol: string; price: number; changePercent: number }[] = [];

          try {
            const movers = await getTopMovers();
            if (movers && movers.length > 0) {
              movers.slice(0, 10).forEach((m: MarketMover) => {
                currentPrices.push({ symbol: m.symbol, price: m.price, changePercent: m.changePercent });
              });
            }
          } catch { /* optional */ }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(`${EDGE_FUNCTIONS_BASE}/global-ai-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: text }],
              userContext: {
                displayName: user?.displayName ?? "Investor",
                trackedAssets: watchlist.map((w) => ({ symbol: w.symbol, name: w.name, assetClass: w.assetClass })),
                riskTolerance: user?.riskTolerance ?? "balanced",
                experienceLevel: user?.experienceLevel ?? "intermediate",
              },
              recentHeadlines,
              currentPrices,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            aiContent = data.response || "";
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch {
          // Edge function failed, fall through to client-side AI
          throw new Error("fallback");
        }
      }

      if (!aiContent) {
        throw new Error("need client fallback");
      }

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: aiContent,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Client-side fallback using Groq/Gemini directly
      try {
        // Fetch real prices for context — include ALL movers for better coverage
        let priceContext = "";
        try {
          const movers = await getTopMovers();
          if (movers && movers.length > 0) {
            const topMovers = movers.slice(0, 15);
            priceContext = "\n\nCurrent market data (live, do NOT fabricate prices for any asset not listed below):\n" +
              topMovers.map((m: MarketMover) =>
                `  ${m.symbol} (${m.name || m.symbol}): $${m.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%)`
              ).join("\n") +
              "\n  If asked about an asset NOT in this list, say you don't have current data for it.";
          }
        } catch { /* price fetch optional */ }

        const aiText = await getAIResponse(text, {
          trackedAssets: watchlist.map((w) => w.symbol),
          riskTolerance: user?.riskTolerance ?? "balanced",
        }, priceContext);
        const aiMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: aiText,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.\n\n_Informational only. Not investment advice._",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, user, watchlist]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => { inputRef.current?.focus(); }, 50);
  };

  if (!isOpen || isMinimized) {
    return (
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {showTooltip && !isOpen && (
          <div className="animate-fade-in rounded-lg bg-surface-elevated border border-border px-3 py-2 text-xs text-foreground shadow-lg whitespace-nowrap">
            <span className="text-accent mr-1">✦</span> Ask Sharpfunds AI
            <div className="absolute right-4 top-full h-2 w-2 -translate-y-1 rotate-45 bg-surface-elevated border-r border-b border-border" />
          </div>
        )}
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); setShowTooltip(false); }}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-accent/20 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={22} />
          <span className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" style={{ animationDuration: "3s" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:p-0 lg:inset-auto lg:bottom-6 lg:right-20 lg:z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)} />
      <div className="relative z-10 flex h-[85vh] w-full flex-col rounded-t-2xl bg-surface border border-border shadow-2xl sm:h-[600px] sm:rounded-2xl lg:h-[580px] lg:w-[420px] lg:rounded-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent/10">
              <Bot size={22} className="text-accent" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-foreground">Sharpfunds AI</h3>
              <p className="text-[11px] text-muted-lighter">Powered by Groq + Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearConversation} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-elevated hover:text-foreground" aria-label="Clear conversation" title="Clear conversation"><Trash2 size={15} /></button>
            <button onClick={() => setIsMinimized(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-elevated hover:text-foreground" aria-label="Minimize" title="Minimize"><Minus size={16} /></button>
            <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-elevated hover:text-foreground" aria-label="Close AI Assistant"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-accent/20 text-foreground rounded-br-md" : "bg-surface-elevated text-muted rounded-bl-md"}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-surface-elevated px-4 py-3">
                <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-accent" /><span className="text-xs text-muted-lighter">Thinking...</span></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && !isLoading && (
          <div className="px-4 pb-2">
            <p className="mb-2 text-[11px] font-medium text-muted-lighter uppercase tracking-wider">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => handleSuggestionClick(suggestion)} onMouseDown={(e) => { setInput(suggestion); e.preventDefault(); }} className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/30 hover:text-foreground">{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-1"><p className="text-[10px] text-muted-lighter text-center italic">Informational only. Not investment advice.</p></div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent/50 transition-colors">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask about markets..." className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none" disabled={isLoading} />
            <button onClick={handleSend} disabled={!input.trim() || isLoading} className="flex h-8 w-8 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/10 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Send message"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}