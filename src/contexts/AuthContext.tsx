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
  const { error, data } = await supabase.from("user_profiles").upsert(
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
  console.log("[upsertProfile] Success for user", profile.id);
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
          setUser(profile);
        } else {
          // Profile not yet created (trigger hasn't run) — create it now
          const newProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email ?? "",
            displayName: session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "User",
            avatarUrl: session.user.user_metadata?.avatar_url,
            assetClasses: [],
            riskTolerance: "balanced",
            experienceLevel: "intermediate",
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
          };
          await upsertProfile(newProfile);
          setUser(newProfile);
        }
      }
      setIsInitializing(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Handle all events that carry a valid session:
          // INITIAL_SESSION (first load / OAuth redirect), SIGNED_IN, TOKEN_REFRESHED
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            setUser(profile);
          } else {
            // Profile doesn't exist yet — create it (handles first-time Google OAuth)
            const newProfile: UserProfile = {
              id: session.user.id,
              email: session.user.email ?? "",
              displayName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "User",
              avatarUrl: session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture,
              assetClasses: [],
              riskTolerance: "balanced",
              experienceLevel: "intermediate",
              onboardingComplete: false,
              createdAt: new Date().toISOString(),
            };
            await upsertProfile(newProfile);
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
      if (error) {
        // Surface the real error for better UX
        throw new Error(error.message);
      }
      // If signup required email confirmation, the session will be null
      if (!data.session) {
        throw new Error("Email not confirmed. Please check your inbox and click the confirmation link before signing in.");
      }
      // onAuthStateChange will set the user
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange clears the user
  }, []);

  const signup = useCallback(
    async (email: string, password: string, displayName: string) => {
      setIsLoading(true);
      try {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName },
          },
        });
        if (error) throw new Error(error.message);

        if (data.user && data.session) {
          // Email confirmation is OFF — session is available immediately
          // Create profile now (we have a valid JWT)
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
          // Email confirmation is ON — session not yet available
          // Profile will be created on first login after confirmation
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
    // Always update local state first so the UI responds immediately
    setUser(updated);
    try {
      await upsertProfile(updated);
    } catch (err) {
      console.error("[completeOnboarding] DB save failed (local state already updated):", err);
      // Don't re-throw — local state is already set, user can proceed
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