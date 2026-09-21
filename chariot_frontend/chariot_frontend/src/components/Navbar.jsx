import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { catalogService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";
import WebCounter from "./WebCounter";

export default function Navbar() {
  const [categories, setCategories] = useState([]);
  const [menuOuvert, setMenuOuvert] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    catalogService
      .getCategories()
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <WebCounter className="web-counter-top" />

      <Link to="/" className="navbar-logo">
        <img src="/logo.png" alt="EDS" className="navbar-logo-img" />
        <span>EDS</span>
      </Link>

      <nav className="navbar-categories">
        <Link to="/" className="navbar-dropdown-label">
          Accueil
        </Link>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="navbar-dropdown"
            onMouseEnter={() => setMenuOuvert(cat.id)}
            onMouseLeave={() => setMenuOuvert(null)}
          >
            <span className="navbar-dropdown-label">{cat.nom}</span>
            <div className={`navbar-dropdown-menu ${menuOuvert === cat.id ? "is-open" : ""}`}>
              {cat.sous_categories.map((sc) => (
                <Link key={sc.id} to={`/catalogue?sous_categorie=${sc.slug}`}>
                  {sc.nom}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <Link to="/a-propos" className="navbar-dropdown-label">
          À propos
        </Link>
      </nav>

      <div className="navbar-actions">
        {user ? (
          <>
            <Link to="/ma-bibliotheque">Ma bibliothèque</Link>
            <button onClick={logout} className="navbar-link-btn">Déconnexion</button>
          </>
        ) : (
          <>
            <Link to="/connexion">Connexion</Link>
            <Link to="/inscription" className="navbar-cta">
              Créer un compte
            </Link>
          </>
        )}
      </div>
    </header>
  );
}