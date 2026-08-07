import { CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

const CHECKS = [
  { label: "Application", description: "Client-side rendering and routing", type: "self" as const },
  { label: "Edge Function", description: "Global AI Chat endpoint", type: "edge" as const },
  { label: "Supabase Auth", description: "Authentication service", type: "supabase" as const },
];

export default function Health() {
  const [results, setResults] = useState<Record<string, "pending" | "healthy" | "error">>({
    Application: "pending",
    "Edge Function": "pending",
    "Supabase Auth": "pending",
  });

  useEffect(() => {
    // Self-check — app is clearly running if this renders
    setResults((prev) => ({ ...prev, Application: "healthy" }));

    // Edge function check
    const efUrl = "https://fflycxbmbibuldwijkvs.supabase.co/functions/v1/global-ai-chat";
    fetch(efUrl, { method: "OPTIONS" })
      .then(() => {
        setResults((prev) => ({ ...prev, "Edge Function": "healthy" }));
      })
      .catch(() => {
        setResults((prev) => ({ ...prev, "Edge Function": "error" }));
      });

    // Supabase URL check
    fetch("https://fflycxbmbibuldwijkvs.supabase.co/rest/v1/", {
      method: "GET",
      headers: {
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      },
    })
      .then((res) => {
        setResults((prev) => ({
          ...prev,
          "Supabase Auth": res.status < 500 ? "healthy" : "error",
        }));
      })
      .catch(() => {
        setResults((prev) => ({ ...prev, "Supabase Auth": "error" }));
      });
  }, []);

  const healthyCount = Object.values(results).filter((r) => r === "healthy").length;
  const totalCount = Object.values(results).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">System Status</h1>
        <p className="mt-2 text-sm text-muted">
          {healthyCount === totalCount
            ? "All systems operational ✓"
            : `${healthyCount} of ${totalCount} systems operational`}
        </p>
      </div>

      <div className="space-y-3">
        {CHECKS.map((check) => {
          const status = results[check.label];
          return (
            <div key={check.label} className="glass-card flex items-center justify-between p-5">
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground">{check.label}</h3>
                <p className="mt-0.5 text-xs text-muted">{check.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {status === "pending" && (
                  <span className="h-4 w-4 rounded-full border-2 border-muted-lighter border-t-transparent animate-spin" />
                )}
                {status === "healthy" && <CheckCircle size={20} className="text-success" />}
                {status === "error" && <XCircle size={20} className="text-destructive" />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[11px] text-muted-lighter">
        Timestamp: {new Date().toISOString()}
      </p>
    </div>
  );
}