import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import { supabase } from "../lib/supabaseClient";
import "./AuthForm.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { acceptAuthenticatedProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setErreur("");
    setIsSubmitting(true);

    try {
      const { data: sessionData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        setErreur(
          message.includes("invalid login credentials")
            ? "Adresse email ou mot de passe incorrect."
            : message.includes("email not confirmed")
              ? "Confirmez votre adresse email avant de vous connecter."
              : signInError.message || "La connexion a échoué.",
        );
        return;
      }
      if (!sessionData.user || !sessionData.session) {
        setErreur("La session de connexion n'a pas pu être créée.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, telephone, role")
        .eq("id", sessionData.user.id)
        .single();

      if (profileError || !profile) {
        console.error("Impossible de lire le rôle du profil après connexion.", profileError);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("La fermeture de session après échec du profil a échoué.", signOutError);
        }
        setErreur(
          profileError?.message
            ? `Impossible de vérifier votre profil : ${profileError.message}`
            : "Votre profil utilisateur est introuvable.",
        );
        return;
      }

      acceptAuthenticatedProfile(sessionData.session, profile);
      if (profile.role === "admin") {
        navigate("/espace-admin", { replace: true });
      } else {
        navigate(location.state?.from?.pathname || "/", { replace: true });
      }
    } catch (loginError) {
      console.error("Erreur inattendue pendant la connexion.", loginError);
      setErreur(
        loginError instanceof Error
          ? loginError.message
          : "La connexion a échoué. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Connexion</h1>
      {erreur && <p className="auth-error">{erreur}</p>}
      <input
        type="email"
        autoComplete="email"
        placeholder="Adresse email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <PasswordField
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>
      <p>Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
    </form>
  );
}
