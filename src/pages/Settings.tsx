import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { User, Mail, Shield, Bell, LogOut, Save, ChevronRight } from "lucide-react";
import { RISK_OPTIONS, EXPERIENCE_OPTIONS } from "../lib/constants";
import type { RiskTolerance, ExperienceLevel } from "../types";

type Tab = "profile" | "preferences" | "account";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Shield },
  { id: "account", label: "Account", icon: Bell },
];

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(user?.riskTolerance ?? "balanced");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(user?.experienceLevel ?? "intermediate");
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = () => {
    updateProfile({ displayName, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSavePreferences = () => {
    updateProfile({ riskTolerance, experienceLevel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile and preferences</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Side tabs (desktop) / Horizontal tabs (mobile) */}
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:w-48 lg:shrink-0 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-accent-light text-accent"
                  : "text-muted hover:bg-surface hover:text-foreground"
              } lg:w-full`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="glass-card p-6 animate-fade-in">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-2xl font-bold text-accent">
                  {user?.displayName?.charAt(0) ?? "U"}
                </div>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-foreground">{user?.displayName}</h2>
                  <p className="text-sm text-muted">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted-lighter outline-none transition-colors focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted-lighter outline-none transition-colors focus:border-accent/50"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover active:scale-[0.97]"
                >
                  <Save size={16} />
                  {saved ? "Saved!" : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="glass-card p-6 animate-fade-in">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-6">Investment Preferences</h2>

              <div className="space-y-8">
                {/* Risk Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Risk Tolerance</label>
                  <div className="grid gap-3">
                    {RISK_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setRiskTolerance(opt.value as RiskTolerance)}
                        className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                          riskTolerance === (opt.value as RiskTolerance)
                            ? "border-accent bg-accent-light"
                            : "border-border hover:border-accent/30 hover:bg-accent/5"
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          riskTolerance === (opt.value as RiskTolerance) ? "border-accent bg-accent" : "border-border"
                        }`}>
                          {riskTolerance === (opt.value as RiskTolerance) && (
                            <div className="h-2 w-2 rounded-full bg-background" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted">{opt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Experience Level</label>
                  <div className="grid gap-3">
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setExperienceLevel(opt.value as ExperienceLevel)}
                        className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                          experienceLevel === (opt.value as ExperienceLevel)
                            ? "border-accent bg-accent-light"
                            : "border-border hover:border-accent/30 hover:bg-accent/5"
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          experienceLevel === (opt.value as ExperienceLevel) ? "border-accent bg-accent" : "border-border"
                        }`}>
                          {experienceLevel === (opt.value as ExperienceLevel) && (
                            <div className="h-2 w-2 rounded-full bg-background" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted">{opt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSavePreferences}
                  className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover active:scale-[0.97]"
                >
                  <Save size={16} />
                  {saved ? "Saved!" : "Save Preferences"}
                </button>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-6">
                <h2 className="font-heading text-lg font-semibold text-foreground mb-6">Account</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-muted-lighter" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Email</p>
                        <p className="text-xs text-muted">{user?.email}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-lighter" />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-muted-lighter" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Password</p>
                        <p className="text-xs text-muted">Last changed 30 days ago</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-lighter" />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Bell size={18} className="text-muted-lighter" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Notifications</p>
                        <p className="text-xs text-muted">Price alerts, news, and insights</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-lighter" />
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="glass-card border border-destructive/20 p-6">
                <h2 className="font-heading text-base font-semibold text-destructive mb-4">Danger Zone</h2>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 px-5 py-2.5 text-sm font-semibold text-destructive transition-all duration-200 hover:bg-destructive/10 active:scale-[0.97]"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
                <p className="mt-2 text-xs text-muted-lighter">
                  You'll be redirected to the login page
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}