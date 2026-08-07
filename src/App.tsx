import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AssetInsights from "./pages/AssetInsights";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Settings from "./pages/Settings";
import Disclaimer from "./pages/Disclaimer";
import Privacy from "./pages/Privacy";
import Health from "./pages/Health";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WatchlistProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Full-screen routes (no sidebar/header) */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected routes with chrome */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/asset/:symbol" element={<AssetInsights />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/news" element={<News />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/health" element={<Health />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </WatchlistProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}