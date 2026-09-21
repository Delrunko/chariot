import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../services/api";
import "./AuthForm.css";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", telephone: "", password: "" });
  const [erreur, setErreur] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      await authService.register(form);
      navigate("/connexion");
    } catch {
      setErreur("Impossible de créer le compte. Vérifiez les informations.");
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Créer un compte</h1>
      {erreur && <p className="auth-error">{erreur}</p>}
      <input name="username" placeholder="Nom d'utilisateur" onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" onChange={handleChange} required />
      <input name="telephone" placeholder="Numéro Orange Money" onChange={handleChange} required />
      <input name="password" type="password" placeholder="Mot de passe" onChange={handleChange} required />
      <button type="submit" className="btn-primary">S'inscrire</button>
      <p>Déjà un compte ? <Link to="/connexion">Se connecter</Link></p>
    </form>
  );
}
