import { Menu, X, RefreshCw } from "lucide-react";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  lastUpdated?: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({
  onToggleSidebar,
  sidebarOpen,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Left: Hamburger + Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground lg:hidden"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <a href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
            <span className="font-heading text-lg font-bold text-accent">S</span>
          </div>
          <span className="font-heading text-lg font-semibold text-foreground hidden sm:inline">
            Sharpfunds
          </span>
        </a>
      </div>

      {/* Right: Last updated + refresh */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-lighter hidden sm:inline">
          {lastUpdated
            ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
            : "Updating..."}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>
    </header>
  );
}