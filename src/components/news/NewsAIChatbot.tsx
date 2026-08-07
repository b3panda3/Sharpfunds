import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { X, Sparkles, Send, Loader2, MessageSquare } from "lucide-react";
import { getNewsAIChatResponse } from "../../lib/api";
import type { ChatMessage, UserProfile, WatchlistItem } from "../../types";

interface NewsAIChatbotProps {
  user: UserProfile;
  watchlist: WatchlistItem[];
  recentHeadlines: string[];
}

export default function NewsAIChatbot({ user, watchlist, recentHeadlines }: NewsAIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about today's market news and how it affects your portfolio.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
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
      const response = await getNewsAIChatResponse(
        text,
        {
          displayName: user.displayName,
          trackedAssets: watchlist.map((w) => ({
            symbol: w.symbol,
            name: w.name,
            assetClass: w.assetClass,
          })),
          riskTolerance: user.riskTolerance,
          experienceLevel: user.experienceLevel,
        },
        recentHeadlines.slice(0, 5)
      );

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content:
          "Sorry, I couldn't process that right now. Please try again. _Informational only. Not investment advice._",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 lg:bottom-6"
          aria-label="Ask AI about the news"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:p-0 lg:inset-auto lg:bottom-24 lg:right-6 lg:z-50">
          {/* Mobile backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 flex h-[85vh] w-full flex-col rounded-t-2xl bg-surface border border-border shadow-2xl sm:h-[600px] sm:rounded-2xl lg:h-[520px] lg:w-[420px] lg:rounded-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                  <Sparkles size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">News AI</h3>
                  <p className="text-xs text-muted-lighter">Ask about today's headlines</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                aria-label="Close AI chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/20 text-foreground rounded-br-md"
                        : "bg-surface-elevated text-muted rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-elevated px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-accent" />
                      <span className="text-xs text-muted-lighter">Analyzing news...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && !isLoading && (
              <div className="px-4 pb-2">
                <p className="mb-2 text-[11px] font-medium text-muted-lighter uppercase tracking-wider">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What happened in crypto today?",
                    "Summarize the top stories",
                    `How does this news affect ${watchlist[0]?.symbol || "my assets"}?`,
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="px-4 pb-1">
              <p className="text-[10px] text-muted-lighter text-center italic">
                Informational only. Not investment advice.
              </p>
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent/50">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about today's news..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}