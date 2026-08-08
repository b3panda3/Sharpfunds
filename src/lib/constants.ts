export const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { path: "/watchlist", label: "Watchlist", icon: "Star" },
  { path: "/news", label: "News", icon: "Newspaper" },
  { path: "/settings", label: "Settings", icon: "Settings" },
] as const;

/* ───── Onboarding: Asset Classes ───── */

export const ONBOARDING_ASSET_CLASSES = [
  { value: "stocks" as const, label: "Stocks", emoji: "📈" },
  { value: "sp500" as const, label: "S&P 500", emoji: "🇺🇸" },
  { value: "crypto" as const, label: "Crypto", emoji: "₿" },
  { value: "meme_coins" as const, label: "Meme Tokens", emoji: "🐸" },
  { value: "forex" as const, label: "Forex", emoji: "💱" },
  { value: "commodities" as const, label: "Commodities", emoji: "🛢️" },
] as const;

/* ───── Onboarding: Risk Tolerance ───── */

export const ONBOARDING_RISK_OPTIONS = [
  {
    value: "conservative" as const,
    label: "Conservative",
    description: "I prefer stable, predictable returns with minimal risk",
    icon: "Shield",
  },
  {
    value: "balanced" as const,
    label: "Balanced",
    description: "I'm comfortable with moderate risk for reasonable growth",
    icon: "Scale",
  },
  {
    value: "aggressive" as const,
    label: "Aggressive",
    description: "I'm aiming for maximum returns and can handle volatility",
    icon: "TrendingUp",
  },
] as const;

/* ───── Onboarding: Experience Level ───── */

export const ONBOARDING_EXPERIENCE_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    description: "New to investing — I want clear, simple explanations",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    description: "I understand market fundamentals and basic analysis",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    description: "Experienced investor — give me the deep analysis",
  },
] as const;

/* ───── Top Assets by Class (for Question 3 picker) ───── */

export const TOP_ASSETS_BY_CLASS: Record<string, { symbol: string; name: string; assetClass: string }[]> = {
  stocks: [
    { symbol: "AAPL", name: "Apple Inc.", assetClass: "stocks" },
    { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stocks" },
    { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "stocks" },
    { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "stocks" },
    { symbol: "TSLA", name: "Tesla Inc.", assetClass: "stocks" },
    { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stocks" },
    { symbol: "META", name: "Meta Platforms", assetClass: "stocks" },
    { symbol: "JPM", name: "JPMorgan Chase", assetClass: "stocks" },
    { symbol: "V", name: "Visa Inc.", assetClass: "stocks" },
    { symbol: "JNJ", name: "Johnson & Johnson", assetClass: "stocks" },
    { symbol: "WMT", name: "Walmart Inc.", assetClass: "stocks" },
    { symbol: "PG", name: "Procter & Gamble", assetClass: "stocks" },
    { symbol: "MA", name: "Mastercard Inc.", assetClass: "stocks" },
    { symbol: "UNH", name: "UnitedHealth Group", assetClass: "stocks" },
    { symbol: "HD", name: "Home Depot Inc.", assetClass: "stocks" },
    { symbol: "BAC", name: "Bank of America", assetClass: "stocks" },
    { symbol: "DIS", name: "Walt Disney Co.", assetClass: "stocks" },
    { symbol: "ADBE", name: "Adobe Inc.", assetClass: "stocks" },
    { symbol: "NFLX", name: "Netflix Inc.", assetClass: "stocks" },
    { symbol: "CRM", name: "Salesforce Inc.", assetClass: "stocks" },
  ],
  sp500: [
    { symbol: "SPY", name: "SPDR S&P 500 ETF", assetClass: "sp500" },
    { symbol: "IVV", name: "iShares Core S&P 500 ETF", assetClass: "sp500" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "sp500" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "sp500" },
    { symbol: "DIA", name: "SPDR Dow Jones ETF", assetClass: "sp500" },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", assetClass: "sp500" },
    { symbol: "VTI", name: "Vanguard Total Stock Market", assetClass: "sp500" },
    { symbol: "BND", name: "Vanguard Total Bond Market", assetClass: "sp500" },
    { symbol: "GLD", name: "SPDR Gold Trust", assetClass: "sp500" },
    { symbol: "VWO", name: "Vanguard Emerging Markets", assetClass: "sp500" },
    { symbol: "EFA", name: "iShares MSCI EAFE ETF", assetClass: "sp500" },
    { symbol: "TLT", name: "iShares 20+ Year Treasury", assetClass: "sp500" },
    { symbol: "XLF", name: "Financial Select Sector SPDR", assetClass: "sp500" },
    { symbol: "XLK", name: "Technology Select Sector SPDR", assetClass: "sp500" },
    { symbol: "XLV", name: "Health Care Select Sector SPDR", assetClass: "sp500" },
    { symbol: "XLE", name: "Energy Select Sector SPDR", assetClass: "sp500" },
    { symbol: "XLI", name: "Industrial Select Sector SPDR", assetClass: "sp500" },
    { symbol: "XLY", name: "Consumer Discretionary SPDR", assetClass: "sp500" },
    { symbol: "XLP", name: "Consumer Staples SPDR", assetClass: "sp500" },
    { symbol: "XLU", name: "Utilities Select Sector SPDR", assetClass: "sp500" },
  ],
  crypto: [
    { symbol: "BTC", name: "Bitcoin", assetClass: "crypto" },
    { symbol: "ETH", name: "Ethereum", assetClass: "crypto" },
    { symbol: "SOL", name: "Solana", assetClass: "crypto" },
    { symbol: "XRP", name: "Ripple", assetClass: "crypto" },
    { symbol: "ADA", name: "Cardano", assetClass: "crypto" },
    { symbol: "DOGE", name: "Dogecoin", assetClass: "crypto" },
    { symbol: "DOT", name: "Polkadot", assetClass: "crypto" },
    { symbol: "AVAX", name: "Avalanche", assetClass: "crypto" },
    { symbol: "MATIC", name: "Polygon", assetClass: "crypto" },
    { symbol: "LINK", name: "Chainlink", assetClass: "crypto" },
    { symbol: "UNI", name: "Uniswap", assetClass: "crypto" },
    { symbol: "ATOM", name: "Cosmos", assetClass: "crypto" },
    { symbol: "LTC", name: "Litecoin", assetClass: "crypto" },
    { symbol: "BCH", name: "Bitcoin Cash", assetClass: "crypto" },
    { symbol: "FIL", name: "Filecoin", assetClass: "crypto" },
    { symbol: "ALGO", name: "Algorand", assetClass: "crypto" },
    { symbol: "NEAR", name: "NEAR Protocol", assetClass: "crypto" },
    { symbol: "APT", name: "Aptos", assetClass: "crypto" },
    { symbol: "ARB", name: "Arbitrum", assetClass: "crypto" },
    { symbol: "OP", name: "Optimism", assetClass: "crypto" },
  ],
  meme_coins: [
    { symbol: "DOGE", name: "Dogecoin", assetClass: "meme_coins" },
    { symbol: "SHIB", name: "Shiba Inu", assetClass: "meme_coins" },
    { symbol: "PEPE", name: "Pepe", assetClass: "meme_coins" },
    { symbol: "WIF", name: "dogwifhat", assetClass: "meme_coins" },
    { symbol: "BONK", name: "Bonk", assetClass: "meme_coins" },
    { symbol: "FLOKI", name: "Floki", assetClass: "meme_coins" },
    { symbol: "MEME", name: "Memecoin", assetClass: "meme_coins" },
    { symbol: "MOON", name: "MoonCoin", assetClass: "meme_coins" },
    { symbol: "SAMO", name: "Samoyed Coin", assetClass: "meme_coins" },
    { symbol: "MYRO", name: "Myro", assetClass: "meme_coins" },
  ],
  forex: [
    { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex" },
    { symbol: "GBP/USD", name: "British Pound / USD", assetClass: "forex" },
    { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex" },
    { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", assetClass: "forex" },
    { symbol: "AUD/USD", name: "Australian Dollar / USD", assetClass: "forex" },
    { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", assetClass: "forex" },
    { symbol: "NZD/USD", name: "New Zealand Dollar / USD", assetClass: "forex" },
    { symbol: "EUR/GBP", name: "Euro / British Pound", assetClass: "forex" },
    { symbol: "EUR/JPY", name: "Euro / Japanese Yen", assetClass: "forex" },
    { symbol: "GBP/JPY", name: "British Pound / Yen", assetClass: "forex" },
  ],
  commodities: [
    { symbol: "GC=F", name: "Gold Futures", assetClass: "commodities" },
    { symbol: "SI=F", name: "Silver Futures", assetClass: "commodities" },
    { symbol: "CL=F", name: "Crude Oil WTI", assetClass: "commodities" },
    { symbol: "NG=F", name: "Natural Gas", assetClass: "commodities" },
    { symbol: "HG=F", name: "Copper Futures", assetClass: "commodities" },
    { symbol: "ZW=F", name: "Wheat Futures", assetClass: "commodities" },
    { symbol: "ZC=F", name: "Corn Futures", assetClass: "commodities" },
    { symbol: "ZS=F", name: "Soybean Futures", assetClass: "commodities" },
    { symbol: "CC=F", name: "Cocoa Futures", assetClass: "commodities" },
    { symbol: "CT=F", name: "Cotton Futures", assetClass: "commodities" },
  ],
};

/* ───── Legacy constants (for backward compat with settings/pages) ───── */

export const ASSET_CLASS_OPTIONS = [
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "forex", label: "Forex" },
  { value: "meme_coins", label: "Meme Tokens" },
] as const;

export const RISK_OPTIONS = [
  { value: "conservative", label: "Conservative — Capital preservation", description: "I prefer stable, low-volatility assets" },
  { value: "balanced", label: "Balanced — Balanced growth", description: "I'm comfortable with moderate volatility" },
  { value: "aggressive", label: "Aggressive — Aggressive growth", description: "I seek maximum returns, comfortable with risk" },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", description: "New to investing" },
  { value: "intermediate", label: "Intermediate", description: "Some experience with markets" },
  { value: "advanced", label: "Advanced", description: "Experienced investor" },
] as const;

/* ───── Disclaimer ───── */

export const FALLBACK_DISCLAIMER = "Informational only. Not investment advice.";