/**
 * Simple keyword-based news classifier.
 * Tags a headline into one of: Stocks, Crypto, Forex, Macro, Earnings
 */

export type NewsCategory = "Stocks" | "Crypto" | "Forex" | "Macro" | "Earnings";

const STOCK_KEYWORDS = [
  "stock", "stocks", "equity", "equities", "shares", "rally", "bull market",
  "bear market", "s&p 500", "nasdaq", "dow jones", "etf", "etfs",
  "dividend", "buyback", "share repurchase", "ipo", "market cap",
  "nvidia", "apple", "microsoft", "amazon", "meta", "tesla", "google",
  "jpmorgan", "netflix", "disney", "nike", "salesforce", "adobe",
];

const CRYPTO_KEYWORDS = [
  "bitcoin", "ethereum", "crypto", "cryptocurrency", "blockchain", "defi",
  "btc", "eth", "sol", "xrp", "ada", "doge", "solana", "cardano",
  "ripple", "dogecoin", "token", "altcoin", "nft", "web3", "layer-2",
  "layer 2", "etf inflow", "stablecoin", "staking", "mining",
  "smart contract", "dex", "cefi",
];

const FOREX_KEYWORDS = [
  "eur/usd", "gbp/usd", "usd/jpy", "usd/chf", "aud/usd", "usd/cad",
  "nzd/usd", "forex", "currency", "euro", "dollar", "yen", "pound",
  "swiss franc", "exchange rate", "central bank", "ecb", "fed",
  "bank of england", "bank of japan", "swiss national bank",
  "interest rate", "rate cut", "rate hike", "monetary policy",
  "intervention", "currency market",
];

const EARNINGS_KEYWORDS = [
  "earnings", "q1", "q2", "q3", "q4", "quarterly", "profit", "revenue",
  "eps", "earnings per share", "beat estimates", "miss estimates",
  "guidance", "forecast", "earnings call", "net income",
  "operating income", "gross margin", "profit margin",
];

const MACRO_KEYWORDS = [
  "gdp", "inflation", "cpi", "ppi", "unemployment", "jobless claims",
  "payrolls", "consumer spending", "retail sales", "housing",
  "manufacturing", "industrial production", "trade deficit",
  "treasury yield", "bond", "yield curve", "recession", "expansion",
  "economic growth", "federal reserve", "fiscal policy", "stimulus",
  "china", "trade war", "geopolitical", "sanctions", "oil",
  "commodity", "commodities", "crude", "gold", "copper", "natural gas",
];

export function classifyArticle(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();

  // Score each category
  const scores: Record<NewsCategory, number> = {
    Stocks: 0,
    Crypto: 0,
    Forex: 0,
    Macro: 0,
    Earnings: 0,
  };

  // Check stock keywords
  for (const kw of STOCK_KEYWORDS) {
    if (text.includes(kw)) scores.Stocks += 2;
  }

  // Check crypto keywords
  for (const kw of CRYPTO_KEYWORDS) {
    if (text.includes(kw)) scores.Crypto += 2;
  }

  // Check forex keywords
  for (const kw of FOREX_KEYWORDS) {
    if (text.includes(kw)) scores.Forex += 2;
  }

  // Check earnings keywords
  for (const kw of EARNINGS_KEYWORDS) {
    if (text.includes(kw)) scores.Earnings += 2;
  }

  // Check macro keywords
  for (const kw of MACRO_KEYWORDS) {
    if (text.includes(kw)) scores.Macro += 1;
  }

  // The title gets a bonus for ticker symbols in first 60 chars
  // If "stock" or symbol patterns are in title, boost stocks
  if (/[A-Z]{1,5}\b/.test(title.slice(0, 40))) {
    // Only boost if it looks like a ticker reference
    const tickerMatch = title.match(/\b[A-Z]{1,5}\b/g);
    if (tickerMatch && tickerMatch.length > 0) {
      // Check if any of these tickers are crypto
      const cryptoTickers = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", "MATIC"];
      const stockTickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "NKE", "DIS"];
      for (const t of tickerMatch) {
        if (cryptoTickers.includes(t)) scores.Crypto += 3;
        if (stockTickers.includes(t)) scores.Stocks += 3;
      }
    }
  }

  // Forex-specific title boost
  if (/\w{3}\/\w{3}/.test(title)) scores.Forex += 3;

  // Determine winner — highest score wins
  let best: NewsCategory = "Stocks";
  let bestScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = cat as NewsCategory;
    }
  }

  // Tie-breaker: if multiple categories have the same score,
  // prefer the one with keywords in the title
  if (bestScore === 0) {
    // Default fallback based on common financial news patterns
    if (/\b(GDP|CPI|inflation|unemployment|Fed|Treasury|bond)\b/i.test(title)) return "Macro";
    if (/\b(earnings|profit|revenue|quarter)\b/i.test(title)) return "Earnings";
    return "Stocks";
  }

  return best;
}