import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function isAdminRole(user) {
  return user?.role === "admin";
}

function mapAuthUser(authUser, profile) {
  const metadata = authUser.user_metadata ?? {};
  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    metadata.full_name ||
    "";

  return {
    ...authUser,
    ...profile,
    id: authUser.id,
    email: authUser.email,
    full_name: fullName,
    telephone:
      profile?.telephone ||
      metadata.phone ||
      metadata.phone_number ||
      metadata.telephone ||
      "",
    role: profile?.role === "admin" ? "admin" : "client",
  };
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, telephone, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function getFrenchAuthError(error) {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "Adresse email ou mot de passe incorrect.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirmez votre adresse email avant de vous connecter.";
  }
  if (message.includes("user already registered")) {
    return "Un compte existe déjà avec cette adresse email.";
  }
  if (message.includes("database error saving new user")) {
    return "Supabase n'a pas pu créer le profil associé au compte. Appliquez la dernière migration Supabase puis réessayez.";
  }
  if (message.includes("password") && message.includes("least")) {
    return "Le mot de passe ne respecte pas les exigences minimales.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Connexion au service d'authentification impossible. Vérifiez votre connexion.";
  }

  return error?.message || "Une erreur d'authentification est survenue.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let sessionRequestId = 0;

    const syncSession = async (nextSession) => {
      const requestId = ++sessionRequestId;

      if (!active) return;
      setSession(nextSession);
      setError(null);

      if (!nextSession?.user) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      let profile = null;
      let profileError = null;
      try {
        profile = await getProfile(nextSession.user.id);
      } catch (fetchError) {
        profileError = fetchError;
      }
      if (!active || requestId !== sessionRequestId) return;

      if (profileError) {
        setError(getFrenchAuthError(profileError));
        setUser(mapAuthUser(nextSession.user, null));
        setIsAdmin(false);
      } else {
        const nextUser = mapAuthUser(nextSession.user, profile);
        setUser(nextUser);
        setIsAdmin(nextUser.role === "admin");
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.setTimeout(() => {
          void syncSession(nextSession).catch((syncError) => {
            if (!active) return;
            setError(getFrenchAuthError(syncError));
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
          });
        }, 0);
      },
    );

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) throw sessionError;
        return syncSession(data.session);
      })
      .catch((sessionError) => {
        if (!active) return;
        setError(getFrenchAuthError(sessionError));
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const message = getFrenchAuthError(signInError);
        setError(message);
        return { success: false, error: message };
      }

      const profile = await getProfile(data.user.id).catch((profileError) => {
        setError(getFrenchAuthError(profileError));
        return null;
      });

      return {
        success: true,
        error: null,
        user: mapAuthUser(data.user, profile),
        isAdmin: profile?.role === "admin",
      };
    } catch (signInError) {
      const message = getFrenchAuthError(signInError);
      setError(message);
      return { success: false, error: message };
    }
  };

  const acceptAuthenticatedProfile = useCallback((authenticatedSession, profile) => {
    const authenticatedUser = authenticatedSession?.user;
    if (!authenticatedUser || !profile) {
      throw new Error("Session ou profil utilisateur manquant.");
    }

    const nextUser = mapAuthUser(authenticatedUser, profile);
    setSession(authenticatedSession);
    setUser(nextUser);
    setIsAdmin(nextUser.role === "admin");
    setError(null);
    setLoading(false);
  }, []);

  const signUp = useCallback(
    async (email, password, fullName, phone) => {
      setError(null);
      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (signUpError) {
          const message = getFrenchAuthError(signUpError);
          setError(message);
          return { success: false, error: message };
        }

        if (data.session && data.user) {
          const profile = await getProfile(data.user.id);
          if (!profile) {
            throw new Error("Le compte a été créé, mais son profil est introuvable.");
          }
          acceptAuthenticatedProfile(data.session, profile);
        }

        return {
          success: true,
          error: null,
          needsEmailConfirmation: !data.session,
        };
      } catch (signUpError) {
        const message = getFrenchAuthError(signUpError);
        setError(message);
        return { success: false, error: message };
      }
    },
    [acceptAuthenticatedProfile],
  );

  const signOut = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setError(null);
      return { success: true, error: null };
    } catch (signOutError) {
      const message = getFrenchAuthError(signOutError);
      setError(message);
      return { success: false, error: message };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      isAdmin,
      signIn,
      signUp,
      signOut,
      acceptAuthenticatedProfile,
    }),
    [user, session, loading, error, isAdmin, signUp, acceptAuthenticatedProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  }
  return context;
}
