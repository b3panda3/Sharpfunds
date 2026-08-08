import { useState } from "react";
import { Outlet, Navigate, Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import GlobalAIAssistant from "./GlobalAIAssistant";
import { useAuth } from "../../contexts/AuthContext";

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 animate-pulse-glow">
          <TrendingUp size={24} className="text-accent animate-pulse" />
        </div>
        <p className="text-sm text-muted">Loading your session...</p>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { isAuthenticated, user, isInitializing } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Wait for auth to initialize before making routing decisions
  if (isInitializing) {
    return <AuthLoader />;
  }

  // Not authenticated → login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not onboarded → onboarding
  if (user && !user.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col lg:ml-0">
        <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} sidebarOpen={sidebarOpen} />

        <main className="flex-1">
          <Outlet />
        </main>

        {/* ─── Footer ─── */}
        <footer className="border-t border-border/50 bg-surface/50 px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-xs text-muted-lighter text-center sm:text-left">
                <span className="font-medium text-muted">Sharpfunds</span> — Market intelligence platform.
                All data is for informational purposes only.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  to="/disclaimer"
                  className="text-xs text-muted-lighter transition-colors hover:text-accent"
                >
                  Disclaimer
                </Link>
                <Link
                  to="/privacy"
                  className="text-xs text-muted-lighter transition-colors hover:text-accent"
                >
                  Privacy
                </Link>
                <Link
                  to="/health"
                  className="text-xs text-muted-lighter transition-colors hover:text-accent"
                >
                  Status
                </Link>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-lighter italic">
              Sharpfunds does not provide financial advice. All content is for informational and educational purposes only.
              Past performance does not guarantee future results. Trading involves risk.
            </p>
          </div>
        </footer>
      </div>

      <MobileNav />
      <GlobalAIAssistant />
    </div>
  );
}