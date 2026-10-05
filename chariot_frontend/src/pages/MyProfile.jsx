import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { ensureProfileExists } from "../services/profileService";
import "./AuthForm.css";
import "./MyProfile.css";

function splitFullName(fullName) {
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  return { first_name: firstName, last_name: rest.join(" ") };
}

function profileFullName(profile) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ");
}

export default function MyProfile() {
  const { user, session, acceptAuthenticatedProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.telephone || "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await ensureProfileExists(user);
        if (active) {
          setForm({
            full_name: profileFullName(data) || user.full_name || "",
            phone: data.telephone || user.telephone || "",
          });
        }
      } catch (profileError) {
        console.error("Impossible de charger le profil utilisateur.", profileError);
        if (active) {
          setError(
            `Impossible de charger votre profil : ${
              profileError?.message || "erreur Supabase inconnue"
            }`,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setToast("");

    const fullName = form.full_name.trim();
    if (!fullName) {
      setError("Veuillez saisir votre nom complet.");
      return;
    }

    setSaving(true);
    try {
      const { first_name, last_name } = splitFullName(fullName);
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name,
          last_name,
          telephone: form.phone.trim() || null,
        })
        .eq("id", user.id)
        .select("id, username, first_name, last_name, telephone, role")
        .single();
      if (updateError) throw updateError;

      acceptAuthenticatedProfile(session, data);
      setForm({
        full_name: profileFullName(data),
        phone: data.telephone || "",
      });
      setToast("Profil mis à jour.");
    } catch (updateError) {
      console.error("Impossible d'enregistrer le profil utilisateur.", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "La mise à jour du profil a échoué.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="my-profile-page">
      <form className="auth-form my-profile-form" onSubmit={handleSubmit}>
        <p className="eyebrow">Mon compte</p>
        <h1>Mon profil</h1>
        <p>Gardez vos coordonnées à jour pour faciliter le suivi de vos demandes.</p>

        {loading && <p role="status">Chargement de votre profil…</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {toast && <p className="auth-success" role="status">{toast}</p>}

        <label htmlFor="profile-full-name">Nom complet</label>
        <input
          id="profile-full-name"
          type="text"
          autoComplete="name"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          required
          disabled={loading || saving}
        />

        <label htmlFor="profile-phone">Téléphone</label>
        <input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          disabled={loading || saving}
        />

        <label htmlFor="profile-email">Adresse email</label>
        <input
          id="profile-email"
          type="email"
          value={user.email || ""}
          readOnly
          aria-describedby="profile-email-note"
        />
        <small id="profile-email-note">L’adresse email ne peut pas être modifiée ici.</small>

        <button type="submit" className="btn-primary" disabled={loading || saving}>
          {saving ? "Enregistrement…" : "Enregistrer mon profil"}
        </button>
        {user.role !== "admin" && <Link to="/ma-bibliotheque">Retour à ma bibliothèque</Link>}
      </form>
    </main>
  );
}
