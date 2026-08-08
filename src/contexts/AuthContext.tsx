import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { AssetClass, UserProfile, OnboardingAnswers } from "../types";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── localStorage helpers for onboarding persistence ───
function getOnboardingFlag(userId: string): boolean {
  try {
    return localStorage.getItem(`sf_onboard_${userId}`) === "true";
  } catch {
    return false;
  }
}

function setOnboardingFlag(userId: string, complete: boolean): void {
  try {
    if (complete) {
      localStorage.setItem(`sf_onboard_${userId}`, "true");
    } else {
      localStorage.removeItem(`sf_onboard_${userId}`);
    }
  } catch { /* localStorage unavailable */ }
}

function clearOnboardingFlag(userId: string): void {
  try {
    localStorage.removeItem(`sf_onboard_${userId}`);
  } catch { /* ok */ }
}

// ─── DB helpers ───

function mapDbProfileToUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: (row.email as string) ?? "",
    displayName: (row.display_name as string) ?? "",
    avatarUrl: row.avatar_url as string | undefined,
    assetClasses: (row.asset_classes as AssetClass[]) ?? [],
    riskTolerance: (row.risk_tolerance as UserProfile["riskTolerance"]) ?? "balanced",
    experienceLevel: (row.experience_level as UserProfile["experienceLevel"]) ?? "intermediate",
    onboardingComplete: (row.onboarding_complete as boolean) ?? false,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return mapDbProfileToUserProfile(data);
}

async function upsertProfile(profile: Partial<UserProfile> & { id: string }): Promise<void> {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: profile.id,
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      asset_classes: profile.assetClasses ?? [],
      risk_tolerance: profile.riskTolerance ?? "balanced",
      experience_level: profile.experienceLevel ?? "intermediate",
      onboarding_complete: profile.onboardingComplete ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    console.error("[upsertProfile] Failed:", error.message, error.code, error.hint);
    throw new Error(error.message);
  }
}

/** Merge DB profile with localStorage onboarding flag — localStorage wins */
function mergeWithLocalFlag(profile: UserProfile): UserProfile {
  if (!profile.onboardingComplete && getOnboardingFlag(profile.id)) {
    console.log("[auth] DB says onboarding incomplete but localStorage says complete — trusting localStorage");
    return { ...profile, onboardingComplete: true };
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) {
          const merged = mergeWithLocalFlag(profile);
          setUser(merged);
          // If localStorage forced onboardingComplete=true, sync back to DB in background
          if (merged.onboardingComplete && !profile.onboardingComplete) {
            upsertProfile(merged).catch(() => { /* best effort */ });
          }
        } else {
          const newProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email ?? "",
            displayName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "User",
            avatarUrl: session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture,
            assetClasses: [],
            riskTolerance: "balanced",
            experienceLevel: "intermediate",
            onboardingComplete: getOnboardingFlag(session.user.id),
            createdAt: new Date().toISOString(),
          };
          try {
            await upsertProfile(newProfile);
          } catch (err) {
            console.error("[auth] Failed to create profile:", err);
          }
          setUser(newProfile);
        }
      }
      setIsInitializing(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            const merged = mergeWithLocalFlag(profile);
            setUser(merged);
            // Background sync if localStorage overrode DB
            if (merged.onboardingComplete && !profile.onboardingComplete) {
              upsertProfile(merged).catch(() => { /* best effort */ });
            }
          } else {
            const newProfile: UserProfile = {
              id: session.user.id,
              email: session.user.email ?? "",
              displayName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "User",
              avatarUrl: session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture,
              assetClasses: [],
              riskTolerance: "balanced",
              experienceLevel: "intermediate",
              onboardingComplete: getOnboardingFlag(session.user.id),
              createdAt: new Date().toISOString(),
            };
            try {
              await upsertProfile(newProfile);
            } catch (err) {
              console.error("[auth] Failed to create profile on auth change:", err);
            }
            setUser(newProfile);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error("Email not confirmed. Please check your inbox and click the confirmation link before signing in.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (user) clearOnboardingFlag(user.id);
    await supabase.auth.signOut();
  }, [user]);

  const signup = useCallback(
    async (email: string, password: string, displayName: string) => {
      setIsLoading(true);
      try {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: displayName } },
        });
        if (error) throw new Error(error.message);
        if (data.user && data.session) {
          const newProfile: UserProfile = {
            id: data.user.id,
            email: data.user.email ?? email,
            displayName,
            assetClasses: [],
            riskTolerance: "balanced",
            experienceLevel: "intermediate",
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
          };
          await upsertProfile(newProfile);
          setUser(newProfile);
        } else if (data.user && !data.session) {
          throw new Error("Account created! Please check your email and click the confirmation link before signing in.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const merged = { ...user, ...updates };
    await upsertProfile(merged);
    setUser(merged);
  }, [user]);

  const completeOnboarding = useCallback(async (answers: OnboardingAnswers) => {
    if (!user) return;
    const updated: UserProfile = {
      ...user,
      assetClasses: answers.assetClasses,
      riskTolerance: answers.riskTolerance,
      experienceLevel: answers.experienceLevel,
      onboardingComplete: true,
    };
    // 1. Persist to localStorage FIRST (survives refresh even if DB fails)
    setOnboardingFlag(user.id, true);
    // 2. Update local state immediately
    setUser(updated);
    // 3. Try DB save (best effort)
    try {
      await upsertProfile(updated);
    } catch (err) {
      console.error("[completeOnboarding] DB save failed (localStorage + local state already updated):", err);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitializing,
        login,
        loginWithGoogle,
        logout,
        signup,
        updateProfile,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
