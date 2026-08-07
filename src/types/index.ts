/* ───── Enums ───── */

export type AssetClass = "stocks" | "crypto" | "forex" | "meme_coins" | "sp500" | "commodities";

export type RiskTolerance = "conservative" | "balanced" | "aggressive";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

/* ───── User Profile ───── */

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  assetClasses: AssetClass[];
  riskTolerance: RiskTolerance;
  experienceLevel: ExperienceLevel;
  onboardingComplete: boolean;
  createdAt: string;
}

/* ───── Watchlist ───── */

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  addedAt: string;
  notes?: string;
}

/* ───── Market Data ───── */

export interface MarketMover {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high24h?: number;
  low24h?: number;
}

export interface AssetDetail extends MarketMover {
  marketCap?: number;
  peRatio?: number;
  dividend?: number;
  description?: string;
  historicalData?: PricePoint[];
}

/* ───── Asset Fundamentals ───── */

export interface AssetFundamentals {
  marketCap?: number;
  // Stocks
  peRatio?: number;
  dividendYield?: number;
  beta?: number;
  sector?: string;
  // Crypto
  circulatingSupply?: number;
  totalSupply?: number;
  allTimeHigh?: number;
  // Meme tokens
  liquidity?: number;
  volume24h?: number;
  holderCount?: number;
  // Forex
  yearHigh?: number;
  yearLow?: number;
  centralBankRate?: number;
}

/* ───── Price History ───── */

export interface ChartPoint {
  timestamp: string;
  value: number;
}

export type TimeRange = "1D" | "7D" | "30D" | "90D" | "1Y";

export interface PricePoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* ───── News ───── */

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  thumbnailUrl?: string;
  sentiment?: "positive" | "negative" | "neutral";
  relatedSymbols?: string[];
}

/* ───── AI Chat ───── */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/* ───── Onboarding ───── */

export interface OnboardingAnswers {
  assetClasses: AssetClass[];
  riskTolerance: RiskTolerance;
  experienceLevel: ExperienceLevel;
}