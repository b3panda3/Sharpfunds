import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
          <Lock size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted">Last updated: March 2025</p>
        </div>
      </div>

      <div className="glass-card space-y-6 p-6 sm:p-8">
        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Information We Collect</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds collects minimal information necessary to provide our market intelligence service. This
            includes your email address, display name, selected asset classes, risk tolerance, experience level,
            and watchlist items. We do not collect any sensitive financial information such as bank account
            details, trading account credentials, or social security numbers.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">How We Use Your Information</h2>
          <p className="text-sm text-muted leading-relaxed">
            The information you provide is used exclusively to personalize your experience on Sharpfunds: tailoring
            market content and AI analysis to your selected asset classes, risk tolerance, and experience level.
            We do not sell, rent, or share your personal information with third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">AI Interactions</h2>
          <p className="text-sm text-muted leading-relaxed">
            When you interact with Sharpfunds AI, your messages and user profile context (asset classes, risk
            tolerance, experience level) are sent to our AI provider (OpenAI via AIML API) solely to generate
            contextual responses. These interactions are not used to train AI models. We do not store full
            conversation logs beyond what is necessary for the current session.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Data Storage & Security</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your data is stored securely using industry-standard encryption. We use Supabase for authentication
            and data storage, which provides robust security measures including encryption at rest and in transit.
            You can request deletion of your account and associated data at any time by contacting our support team.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Your Rights</h2>
          <p className="text-sm text-muted leading-relaxed">
            You have the right to access, correct, or delete your personal data at any time. Account settings
            allow you to update your profile information. For complete account deletion, please contact us.
            We will respond to your request within 30 days.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Third-Party Services</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds integrates with third-party services for market data (e.g., Finnhub, Alpha Vantage,
            CryptoPanic, NewsAPI) and AI processing (AIML API / OpenAI). These services may process your
            data according to their own privacy policies. We only share the minimum data necessary for each
            service to function.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Cookies</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sharpfunds uses essential cookies for authentication and session management. We do not use tracking
            cookies or third-party advertising cookies. You can control cookie settings through your browser
            preferences.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Contact</h2>
          <p className="text-sm text-muted leading-relaxed">
            For privacy-related inquiries or data deletion requests, please contact our support team through
            the settings page or email privacy@sharpfunds.com.
          </p>
        </section>

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