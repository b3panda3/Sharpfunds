import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Disclaimer() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
          <Shield size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Disclaimer</h1>
          <p className="text-sm text-muted">Last updated: March 2025</p>
        </div>
      </div>

      <div className="glass-card space-y-6 p-6 sm:p-8">
        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Not Financial Advice</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds is a market intelligence and data aggregation platform. The information, data, analysis,
            and content provided through Sharpfunds are for informational and educational purposes only. Nothing
            on this platform constitutes financial advice, investment advice, trading advice, or any other type
            of professional advice. You should not treat any content on Sharpfunds as a substitute for
            professional financial advice from a licensed advisor.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">No Guarantee of Accuracy</h2>
          <p className="text-sm text-muted leading-relaxed">
            While we strive to provide accurate and up-to-date information, Sharpfunds makes no representations
            or warranties of any kind, express or implied, about the completeness, accuracy, reliability,
            suitability, or availability of the data, prices, news, or AI-generated content on the platform.
            Market data may be delayed, and AI-generated analysis may contain errors or omissions.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">AI-Generated Content</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds uses artificial intelligence (AI) models — including GPT-4o-mini — to generate responses
            to user queries. AI-generated content may not always be accurate, current, or complete. It should
            not be relied upon for making financial decisions. All AI-generated responses include the disclaimer
            "Informational only. Not investment advice."
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">No Liability</h2>
          <p className="text-sm text-muted leading-relaxed">
            In no event shall Sharpfunds, its operators, affiliates, or contributors be liable for any loss or
            damage including without limitation, indirect or consequential loss or damage, or any loss or damage
            whatsoever arising from loss of data or profits arising out of, or in connection with, the use of
            this platform. Trading in financial markets involves substantial risk of loss. You should carefully
            consider your financial situation before engaging in any trading activity.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Third-Party Data</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds aggregates market data from third-party sources including financial data providers,
            news outlets, and public APIs. We do not independently verify this data and cannot guarantee its
            accuracy or timeliness.
          </p>
        </section>

        <div className="rounded-xl bg-accent/5 border border-accent/15 p-4">
          <p className="text-xs text-muted leading-relaxed">
            <strong className="text-foreground">⚠ Important:</strong> Trading stocks, cryptocurrencies,
            forex, commodities, and other financial instruments involves significant risk. Prices can and do
            fluctuate dramatically. Past performance is not indicative of future results. Never invest more
            than you can afford to lose. Always consult a qualified financial advisor before making
            investment decisions.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-background transition-all hover:bg-accent-hover active:scale-[0.97]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}