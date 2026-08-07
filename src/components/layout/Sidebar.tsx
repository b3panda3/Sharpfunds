import { NavLink } from "react-router-dom";
import { LayoutDashboard, Star, Newspaper, Settings, LogOut, TrendingUp } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/watchlist", icon: Star, label: "Watchlist" },
  { to: "/news", icon: Newspaper, label: "News" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  const handleNav = () => {
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border bg-background transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
            <TrendingUp size={20} className="text-accent" />
          </div>
          <span className="font-heading text-lg font-semibold text-foreground">Sharpfunds</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNav}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-accent-light text-accent"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
              {user?.displayName?.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.displayName ?? "User"}</p>
              <p className="truncate text-xs text-muted-lighter">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-destructive"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}