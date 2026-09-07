import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createAnonymousPerson } from "@/api/endpoints";
import { DEMO_OFFICER_ID, DEMO_PERSON_ID, REQUIRE_LOGIN } from "@/config";

const AuthContext = createContext(null);

export const ROLES = { VICTIM: "victim", OFFICER: "officer" };

const STORAGE_KEY = "saathi.session";

/**
 * Session and role for the whole app, in one of two modes.
 *
 * DEMO MODE (the default, VITE_REQUIRE_LOGIN unset or "false"):
 *   No credentials. Picking a role on the entry screen IS the sign-in, and it
 *   is remembered in localStorage. There is nothing to forget and nothing to
 *   confirm by email.
 *
 *   This means there is NO access control on the app: anyone opening it can
 *   choose "Officer" and see every case. That was already true of the data —
 *   the FastAPI backend has no authentication and never verified tokens — so
 *   this removes a lock on the door of a building with no walls. Set
 *   VITE_REQUIRE_LOGIN=true to switch real accounts back on.
 *
 * ACCOUNT MODE (VITE_REQUIRE_LOGIN=true):
 *   Supabase email/password, with the role stored in the `profiles` table.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const useAccounts = REQUIRE_LOGIN && Boolean(supabase);

  // A locally stored identity: the whole session in demo mode, and the
  // anonymous case code in account mode. Read in both.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      // A blocked or corrupt store just means "not signed in".
    }
    if (!useAccounts) setLoading(false);
  }, [useAccounts]);

  // --- Account mode: Supabase session ------------------------------------
  useEffect(() => {
    if (!useAccounts) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (!next) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [useAccounts]);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    // An anonymous session has no Supabase user and no profiles row.
    if (!useAccounts || !userId || profile?.anonymous) return undefined;
    let active = true;

    supabase
      .from("profiles")
      .select("id, role, person_id, officer_id, display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data ?? null);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAccounts, userId]);

  const signIn = useCallback(
    async (email, password) => {
      if (!useAccounts) return { userId: null };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { userId: data.user?.id ?? null };
    },
    [useAccounts],
  );

  const signUp = useCallback(
    async (email, password) => {
      if (!useAccounts) return { needsConfirmation: false, userId: null };
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return { needsConfirmation: !data.session, userId: data.user?.id ?? null };
    },
    [useAccounts],
  );

  const signOut = useCallback(async () => {
    setProfile(null);
    if (useAccounts) {
      await supabase.auth.signOut();
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clear.
      }
    }
  }, [useAccounts]);

  const chooseRole = useCallback(
    async (role, explicitUserId) => {
      const row = {
        role,
        person_id: role === ROLES.VICTIM ? DEMO_PERSON_ID || null : null,
        officer_id: role === ROLES.OFFICER ? DEMO_OFFICER_ID || null : null,
      };

      if (!useAccounts) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
        } catch {
          // Still works for this tab even if it cannot be persisted.
        }
        setProfile(row);
        return row;
      }

      const id = explicitUserId || userId;
      if (!id) throw new Error("Not signed in.");

      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id, ...row }, { onConflict: "id" })
        .select("id, role, person_id, officer_id, display_name")
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    },
    [useAccounts, userId],
  );

  /**
   * Start a session with no account at all.
   *
   * Creates a fresh pseudonymous person on the backend and keeps only the
   * returned case code locally. Nothing identifying is collected or sent.
   * Check-ins ARE still stored against that record — noticing distress over
   * time is the point of the service — but there is nothing tying the record
   * to a real person, and losing the code loses the history.
   */
  const continueAnonymously = useCallback(async (language = "en") => {
    const person = await createAnonymousPerson({ language });
    const row = {
      role: ROLES.VICTIM,
      person_id: person.id,
      officer_id: null,
      pseudonym: person.pseudonym,
      anonymous: true,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
    } catch {
      // Works for this tab even if it cannot be persisted.
    }
    setProfile(row);
    return row;
  }, []);

  const value = useMemo(() => {
    const role = profile?.role ?? null;
    const anonymous = Boolean(profile?.anonymous);
    return {
      mode: useAccounts ? "accounts" : "demo",
      requiresCredentials: useAccounts,
      session,
      user: session?.user ?? null,
      profile,
      role,
      personId: profile?.person_id || DEMO_PERSON_ID || "",
      officerId: profile?.officer_id || DEMO_OFFICER_ID || "",
      anonymous,
      caseCode: profile?.pseudonym || null,
      // In demo mode, having chosen a role IS being signed in. An anonymous
      // case code counts either way — there is no Supabase user behind it.
      isAuthenticated: useAccounts ? Boolean(session) || anonymous : Boolean(role),
      loading,
      signIn,
      signUp,
      signOut,
      chooseRole,
      continueAnonymously,
    };
  }, [
    useAccounts,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    chooseRole,
    continueAnonymously,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
