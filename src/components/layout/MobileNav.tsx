import { NavLink } from "react-router-dom";
import { LayoutDashboard, Star, Newspaper, Settings } from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/watchlist", icon: Star, label: "Watchlist" },
  { to: "/news", icon: Newspaper, label: "News" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                isActive ? "text-accent" : "text-muted hover:text-foreground"
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}