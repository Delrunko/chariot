import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import "./AuthForm.css";

export default function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [erreur, setErreur] = useState("");
  const [success, setSuccess] = useState("");
  const { signUp } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErreur("");
    setSuccess("");

    const result = await signUp(form.email, form.password, form.fullName, form.phone);
    if (!result.success) {
      setErreur(result.error);
      return;
    }

    setSuccess(
      result.needsEmailConfirmation
        ? "Vérifiez votre email pour confirmer la création de votre compte."
        : "Votre compte a été créé avec succès.",
    );
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Créer un compte</h1>
      {erreur && <p className="auth-error">{erreur}</p>}
      {success && <p className="auth-success" role="status">{success}</p>}
      <input name="fullName" autoComplete="name" placeholder="Nom complet" value={form.fullName} onChange={handleChange} required />
      <input name="email" type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={handleChange} required />
      <input name="phone" type="tel" autoComplete="tel" placeholder="Téléphone" value={form.phone} onChange={handleChange} required />
      <PasswordField
        name="password"
        placeholder="Mot de passe"
        value={form.password}
        onChange={handleChange}
        autoComplete="new-password"
        required
      />
      <button type="submit" className="btn-primary">S'inscrire</button>
      <p>Déjà un compte ? <Link to="/connexion">Se connecter</Link></p>
    </form>
  );
}
