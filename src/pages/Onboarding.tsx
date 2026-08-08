import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Scale, TrendingUp, Search, Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWatchlist } from "../contexts/WatchlistContext";
import {
  ONBOARDING_ASSET_CLASSES,
  ONBOARDING_RISK_OPTIONS,
  ONBOARDING_EXPERIENCE_OPTIONS,
  TOP_ASSETS_BY_CLASS,
} from "../lib/constants";
import type { AssetClass, RiskTolerance, ExperienceLevel } from "../types";

/* ───── Types ───── */

type StepState = {
  step: number;
  assetClasses: AssetClass[];
  riskTolerance: RiskTolerance | null;
  experienceLevel: ExperienceLevel | null;
  trackedAssets: { symbol: string; name: string; assetClass: string }[];
};

const TOTAL_STEPS = 4;

const DEFAULTS = {
  assetClasses: ["stocks"] as AssetClass[],
  riskTolerance: "balanced" as RiskTolerance,
  experienceLevel: "beginner" as ExperienceLevel,
};

/* ───── Animation Variants ───── */

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
};

/* ───── Step Components ───── */

function StepAssetClasses({
  selected,
  onChange,
}: {
  selected: AssetClass[];
  onChange: (v: AssetClass[]) => void;
}) {
  const toggle = (value: AssetClass) => {
    onChange(
      selected.includes(value)
        ? selected.filter((s) => s !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">What interests you?</h2>
        <p className="mt-2 text-sm text-muted">Pick the asset classes you want to track</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ONBOARDING_ASSET_CLASSES.map((ac) => {
          const isActive = selected.includes(ac.value);
          return (
            <button
              key={ac.value}
              onClick={() => toggle(ac.value)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center transition-all duration-200 active:scale-[0.97] ${
                isActive
                  ? "border-accent bg-accent-light"
                  : "border-border hover:border-accent/30 hover:bg-accent/5"
              }`}
            >
              {isActive && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                  <Check size={12} className="text-background" />
                </div>
              )}
              <span className="text-xl">{/* Using text icons instead of emojis */}</span>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-accent" : "text-foreground"
                }`}
              >
                {ac.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepRiskTolerance({
  value,
  onChange,
}: {
  value: RiskTolerance | null;
  onChange: (v: RiskTolerance) => void;
}) {
  const iconMap: Record<string, typeof Shield> = { Shield, Scale, TrendingUp };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Your risk style</h2>
        <p className="mt-2 text-sm text-muted">This helps us tailor insights to your comfort level</p>
      </div>
      <div className="space-y-3">
        {ONBOARDING_RISK_OPTIONS.map((opt) => {
          const Icon = iconMap[opt.icon] ?? Shield;
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value as RiskTolerance)}
              className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? "border-accent bg-accent-light"
                  : "border-border hover:border-accent/30 hover:bg-accent/5"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isActive ? "bg-accent text-background" : "bg-surface text-muted"
                }`}
              >
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isActive ? "text-accent" : "text-foreground"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{opt.description}</p>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                  isActive ? "border-accent bg-accent" : "border-border"
                }`}
              >
                {isActive && <div className="h-2 w-2 rounded-full bg-background" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPickAssets({
  selectedClasses,
  tracked,
  onChange,
}: {
  selectedClasses: AssetClass[];
  tracked: { symbol: string; name: string; assetClass: string }[];
  onChange: (items: { symbol: string; name: string; assetClass: string }[]) => void;
}) {
  const [search, setSearch] = useState("");

  // Gather curated assets from selected classes
  const curatedAssets = useMemo(() => {
    const results: { symbol: string; name: string; assetClass: string }[] = [];
    for (const cls of selectedClasses) {
      const assets = TOP_ASSETS_BY_CLASS[cls];
      if (assets) results.push(...assets);
    }
    return results;
  }, [selectedClasses]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return curatedAssets;
    const q = search.toLowerCase();
    return curatedAssets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [curatedAssets, search]);

  const toggle = (item: { symbol: string; name: string; assetClass: string }) => {
    const exists = tracked.some((t) => t.symbol === item.symbol);
    onChange(
      exists
        ? tracked.filter((t) => t.symbol !== item.symbol)
        : [...tracked, item]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Track assets</h2>
        <p className="mt-2 text-sm text-muted">
          Pick assets to follow. You can always add more later.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 focus-within:border-accent/50">
        <Search size={16} className="text-muted-lighter shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-lighter hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Selected count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-lighter">
          {tracked.length} asset{tracked.length !== 1 ? "s" : ""} selected
        </p>
        {tracked.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto pr-1">
        {filtered.map((asset) => {
          const isActive = tracked.some((t) => t.symbol === asset.symbol);
          return (
            <button
              key={asset.symbol}
              onClick={() => toggle(asset)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? "border-accent bg-accent-light"
                  : "border-border hover:border-accent/30 hover:bg-accent/5"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                  isActive ? "bg-accent text-background" : "bg-surface text-muted"
                }`}
              >
                {asset.symbol.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {asset.symbol}
                </p>
                <p className="text-xs text-muted truncate">{asset.name}</p>
              </div>
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isActive ? "border-accent bg-accent" : "border-border"
                }`}
              >
                {isActive && <Check size={12} className="text-background" />}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center">
            <p className="text-sm text-muted">No assets found for "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepExperienceLevel({
  value,
  onChange,
}: {
  value: ExperienceLevel | null;
  onChange: (v: ExperienceLevel) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Experience level</h2>
        <p className="mt-2 text-sm text-muted">So we can match insights to your knowledge</p>
      </div>
      <div className="space-y-3">
        {ONBOARDING_EXPERIENCE_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value as ExperienceLevel)}
              className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? "border-accent bg-accent-light"
                  : "border-border hover:border-accent/30 hover:bg-accent/5"
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isActive ? "border-accent bg-accent" : "border-border"
                }`}
              >
                {isActive && <div className="h-2 w-2 rounded-full bg-background" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isActive ? "text-accent" : "text-foreground"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Main Onboarding Page ───── */

export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useAuth();
  const { setInitialItems } = useWatchlist();

  const [state, setState] = useState<StepState>({
    step: 0,
    assetClasses: [],
    riskTolerance: null,
    experienceLevel: null,
    trackedAssets: [],
  });

  const [direction, setDirection] = useState(1);

  const canNext = () => {
    switch (state.step) {
      case 0:
        return state.assetClasses.length > 0;
      case 1:
        return state.riskTolerance !== null;
      case 2:
        return true; // Optional — can skip picking assets
      case 3:
        return state.experienceLevel !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (state.step < TOTAL_STEPS - 1) {
      setDirection(1);
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (state.step > 0) {
      setDirection(-1);
      setState((prev) => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const [isCompleting, setIsCompleting] = useState(false);

  const handleSkip = async () => {
    setIsCompleting(true);
    try {
      // Fill in defaults and finish
      await completeOnboarding({
        assetClasses: state.assetClasses.length > 0 ? state.assetClasses : DEFAULTS.assetClasses,
        riskTolerance: state.riskTolerance ?? DEFAULTS.riskTolerance,
        experienceLevel: state.experienceLevel ?? DEFAULTS.experienceLevel,
      });
      if (state.trackedAssets.length > 0) {
        setInitialItems(
          state.trackedAssets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            assetClass: a.assetClass as AssetClass,
          }))
        );
      }
      navigate("/dashboard");
    } catch (err) {
      console.error("Onboarding skip failed:", err);
      // Still navigate — profile will use defaults next load
      navigate("/dashboard");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleFinish = async () => {
    setIsCompleting(true);
    try {
      await completeOnboarding({
        assetClasses: state.assetClasses,
        riskTolerance: state.riskTolerance ?? DEFAULTS.riskTolerance,
        experienceLevel: state.experienceLevel ?? DEFAULTS.experienceLevel,
      });
      if (state.trackedAssets.length > 0) {
        setInitialItems(
          state.trackedAssets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            assetClass: a.assetClass as AssetClass,
          }))
        );
      }
      navigate("/dashboard");
    } catch (err) {
      console.error("Onboarding finish failed:", err);
      // Still navigate — will re-prompt on next load if profile wasn't saved
      navigate("/dashboard");
    } finally {
      setIsCompleting(false);
    }
  };

  const stepLabels = ["Classes", "Risk", "Assets", "Experience"];

  const stepTitle = (() => {
    switch (state.step) {
      case 0: return "What interests you?";
      case 1: return "Your risk style";
      case 2: return "Track assets";
      case 3: return "Experience level";
      default: return "";
    }
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-lighter">
              Step {state.step + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-xs text-muted-lighter">{stepTitle}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= state.step ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {stepLabels.map((label, i) => (
              <span
                key={label}
                className={`text-[10px] font-medium ${
                  i <= state.step ? "text-accent" : "text-muted-lighter"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="glass-card p-6 sm:p-8 min-h-[360px] flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={state.step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {state.step === 0 && (
                  <StepAssetClasses
                    selected={state.assetClasses}
                    onChange={(v) => setState((prev) => ({ ...prev, assetClasses: v }))}
                  />
                )}
                {state.step === 1 && (
                  <StepRiskTolerance
                    value={state.riskTolerance}
                    onChange={(v) => setState((prev) => ({ ...prev, riskTolerance: v }))}
                  />
                )}
                {state.step === 2 && (
                  <StepPickAssets
                    selectedClasses={state.assetClasses}
                    tracked={state.trackedAssets}
                    onChange={(v) => setState((prev) => ({ ...prev, trackedAssets: v }))}
                  />
                )}
                {state.step === 3 && (
                  <StepExperienceLevel
                    value={state.experienceLevel}
                    onChange={(v) => setState((prev) => ({ ...prev, experienceLevel: v }))}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <div>
              {state.step > 0 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <div />
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                disabled={isCompleting}
                className="text-sm text-muted-lighter hover:text-muted transition-colors disabled:opacity-40"
              >
                Skip for now
              </button>
              <button
                onClick={handleNext}
                disabled={!canNext() || isCompleting}
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isCompleting ? "Saving..." : state.step === TOTAL_STEPS - 1 ? "Finish" : "Continue"}
                {!isCompleting && state.step < TOTAL_STEPS - 1 && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}