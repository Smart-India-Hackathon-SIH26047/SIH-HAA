import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createAnonymousPerson } from "@/api/endpoints";
import { DEMO_OFFICER_ID, DEMO_PERSON_ID, REQUIRE_LOGIN } from "@/config";

const AuthContext = createContext(null);

export const ROLES = { VICTIM: "victim", OFFICER: "officer" };

const STORAGE_KEY = "saathi.session";
const ANON_MODE_KEY = "saathi.anonymousMode";

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
  // Two different questions, and collapsing them into one `loading` flag was
  // the login race: knowing WHETHER someone is signed in tells you nothing
  // about WHICH side of the app they belong to. The session resolves first;
  // the role arrives later, from the `profiles` table. Routing must wait for
  // both, or it decides a role while the answer is still in flight.
  const [sessionResolved, setSessionResolved] = useState(false);
  // Which user id the profiles lookup has actually answered for. Derived
  // rather than a boolean flag: a flag set from inside an effect is always one
  // render late, and that render is precisely when the router decides.
  const [profileFetchedFor, setProfileFetchedFor] = useState(null);
  // A signed-in person can route this conversation to an unlinked case code
  // instead of their own record. Persisted, so it survives a reload.
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [anonymousPersonId, setAnonymousPersonId] = useState(null);
  const [switchingAnonymous, setSwitchingAnonymous] = useState(false);

  const useAccounts = REQUIRE_LOGIN && Boolean(supabase);

  // A locally stored identity: the whole session in demo mode, and the
  // anonymous case code in account mode. Read in both.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // In account mode the role is owned by the `profiles` table, never by
        // localStorage. A leftover blob from a demo or anonymous session
        // would otherwise seed a role before the real one lands — which is
        // how an officer got routed into the victim app. The exception is an
        // anonymous session: it has no Supabase user and no profiles row, so
        // local storage is the only record of it.
        if (!useAccounts || saved?.anonymous) setProfile(saved);
      }
    } catch {
      // A blocked or corrupt store just means "not signed in".
    }
    try {
      const raw = localStorage.getItem(ANON_MODE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setAnonymousMode(Boolean(saved.on));
        setAnonymousPersonId(saved.personId || null);
      }
    } catch {
      // Not restorable; defaults to off, which is the safe direction.
    }
    // Demo mode has no remote lookup: whatever was just read IS the answer.
    if (!useAccounts) setSessionResolved(true);
  }, [useAccounts]);

  // --- Account mode: Supabase session ------------------------------------
  useEffect(() => {
    if (!useAccounts) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionResolved(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (!next) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [useAccounts]);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    // An anonymous session has no Supabase user and no profiles row, so the
    // role it already carries is final.
    if (!useAccounts || !userId || profile?.anonymous) return undefined;
    let active = true;

    supabase
      .from("profiles")
      .select("id, role, person_id, officer_id, display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // chooseRole() writes the same row. If its upsert already landed for
        // this user, keep it: this SELECT may have been issued before that
        // write committed, in which case `data` is null or stale and would
        // silently undo the role the person just picked.
        setProfile((prev) => (prev?.id === userId ? prev : data ?? null));
        setProfileFetchedFor(userId);
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

  /**
   * Route this conversation to an unlinked case, or back to the person's own.
   *
   * Being clear about the boundary: check-ins made while this is on are
   * stored against a separate anonymous record, so they do not appear in the
   * person's case history and no officer viewing that case can see them. They
   * are still stored, still scored, and can still raise their own alert —
   * noticing distress is the point of the service. It hides the link, not the
   * conversation, and it is not retrospective.
   */
  const toggleAnonymousMode = useCallback(
    async (language = "en") => {
      if (anonymousMode) {
        setAnonymousMode(false);
        try {
          localStorage.setItem(
            ANON_MODE_KEY,
            JSON.stringify({ on: false, personId: anonymousPersonId }),
          );
        } catch {
          // Non-fatal.
        }
        return false;
      }

      setSwitchingAnonymous(true);
      try {
        // Reuse the same unlinked case across sessions, so switching back and
        // forth does not scatter someone's history across many records.
        let id = anonymousPersonId;
        if (!id) {
          const person = await createAnonymousPerson({ language });
          id = person.id;
          setAnonymousPersonId(id);
        }
        setAnonymousMode(true);
        try {
          localStorage.setItem(ANON_MODE_KEY, JSON.stringify({ on: true, personId: id }));
        } catch {
          // Non-fatal.
        }
        return true;
      } finally {
        setSwitchingAnonymous(false);
      }
    },
    [anonymousMode, anonymousPersonId],
  );

  /**
   * Is the ROLE known yet? Signed out, there is nothing to look up. Signed in,
   * it is known once the profiles lookup has answered for THIS user — or once
   * chooseRole has written a row for them, which answers the same question.
   */
  const roleResolved = !useAccounts
    ? sessionResolved
    : !userId
      ? sessionResolved
      : profileFetchedFor === userId || profile?.id === userId || Boolean(profile?.anonymous);

  // Still loading until the session AND the role are both settled. The role
  // half is what the router was missing.
  const loading = !(sessionResolved && roleResolved);

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
      // Anonymous mode redirects check-ins away from the person's own record.
      personId:
        (anonymousMode && anonymousPersonId) || profile?.person_id || DEMO_PERSON_ID || "",
      anonymousMode,
      anonymousPersonId,
      switchingAnonymous,
      toggleAnonymousMode,
      officerId: profile?.officer_id || DEMO_OFFICER_ID || "",
      anonymous,
      caseCode: profile?.pseudonym || null,
      // In demo mode, having chosen a role IS being signed in. An anonymous
      // case code counts either way — there is no Supabase user behind it.
      isAuthenticated: useAccounts ? Boolean(session) || anonymous : Boolean(role),
      loading,
      // Lets a caller distinguish "no role" from "role not known yet".
      roleResolved,
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
    sessionResolved,
    roleResolved,
    profileFetchedFor,
    userId,
    signIn,
    signUp,
    signOut,
    chooseRole,
    continueAnonymously,
    anonymousMode,
    anonymousPersonId,
    switchingAnonymous,
    toggleAnonymousMode,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
