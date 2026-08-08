import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, signup, isLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isSignUp) {
        await signup(email, password, displayName);
      } else {
        await login(email, password);
      }
      navigate("/onboarding");
    } catch {
      setError("Authentication failed. Please try again.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await loginWithGoogle();
      navigate("/onboarding");
    } catch {
      setError("Google login failed. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 animate-pulse-glow">
            <TrendingUp size={32} className="text-accent" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Sharpfunds</h1>
          <p className="mt-2 text-sm text-muted">AI-powered financial insights</p>
        </div>

        {/* Form */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="mb-6 text-center font-heading text-xl font-semibold text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Investor"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted-lighter outline-none transition-colors focus:border-accent/50"
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 focus-within:border-accent/50">
                <Mail size={16} className="text-muted-lighter shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 focus-within:border-accent/50">
                <Lock size={16} className="text-muted-lighter shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-lighter outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-lighter hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              {isLoading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-lighter">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:bg-surface active:scale-[0.97] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FBC02D"/>
              <path d="M3.15295 7.3455L6.43845 9.755C7.32745 7.554 9.48045 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C8.15895 2 4.82795 4.1685 3.15295 7.3455Z" fill="#E53935"/>
              <path d="M12 22C14.583 22 16.93 21.0115 18.7045 19.404L15.6095 16.785C14.5718 17.5742 13.3037 18.001 12 18C9.39903 18 7.19053 16.3415 6.35853 14.027L3.09753 16.5395C4.75253 19.778 8.11353 22 12 22Z" fill="#4CAF50"/>
              <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.2571 15.1082 16.5467 16.0766 15.608 16.7855L15.6095 16.7845L18.7045 19.4035C18.4855 19.6025 22 17 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#4285F4"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle sign up / sign in */}
          <p className="mt-6 text-center text-sm text-muted">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="font-medium text-accent hover:text-accent-hover"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-[10px] text-muted-lighter">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}