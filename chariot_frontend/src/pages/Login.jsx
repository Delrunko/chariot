import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth, isAdminRole } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import "./AuthForm.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      const user = await login(username, password);
      if (isAdminRole(user)) {
        navigate("/espace-admin");
      } else {
        navigate(location.state?.from?.pathname || "/");
      }
    } catch {
      setErreur("Identifiants incorrects.");
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Connexion</h1>
      {erreur && <p className="auth-error">{erreur}</p>}
      <input placeholder="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <PasswordField
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <button type="submit" className="btn-primary">Se connecter</button>
      <p>Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
    </form>
  );
}
