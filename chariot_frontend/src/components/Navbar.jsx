import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { catalogService } from "../services/api";
import { useAuth, isAdminRole } from "../context/AuthContext";
import "./Navbar.css";
import WebCounter from "./WebCounter";

export default function Navbar() {
  const [categories, setCategories] = useState([]);
  const [menuOuvert, setMenuOuvert] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className={`navbar ${scrolled ? "navbar-scrolled" : ""} ${isAdminRole(user) ? "navbar-admin" : ""}`}>
      <WebCounter className="web-counter-top" />
      <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
        <img src="/logo.png" alt="EDS" className="navbar-logo-img" />
      </Link>

      <nav className="navbar-categories" aria-label="Menu principal">
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
            <Link to={`/categorie/${cat.slug}`} className="navbar-dropdown-label" onClick={closeMobileMenu}>
              {cat.nom}
            </Link>
            <div className={`navbar-dropdown-menu ${menuOuvert === cat.id ? "is-open" : ""}`}>
              {cat.sous_categories.map((sc) => (
                <Link key={sc.id} to={`/catalogue?sous_categorie=${sc.slug}`} onClick={closeMobileMenu}>
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
          {isAdminRole(user) && (
             <Link to="/espace-admin" onClick={closeMobileMenu}>Espace admin</Link>
           )}
           <Link to={isAdminRole(user) ? "/espace-admin" : "/ma-bibliotheque"} onClick={closeMobileMenu}>Ma bibliothèque</Link>
           <button onClick={() => { logout(); closeMobileMenu(); }} className="navbar-link-btn">Déconnexion</button>
         </>
       ) : (
         <>
           <Link to="/connexion" onClick={closeMobileMenu}>Connexion</Link>
           <Link to="/inscription" className="navbar-cta" onClick={closeMobileMenu}>
             Créer un compte
           </Link>
         </>
       )}
      </div>

      <button
        type="button"
        className={`navbar-burger ${mobileMenuOpen ? "is-open" : ""}`}
        aria-label="Ouvrir le menu"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`navbar-mobile-panel ${mobileMenuOpen ? "is-open" : ""}`}>
        <nav className="navbar-mobile-links" aria-label="Menu mobile">
          <Link to="/" onClick={closeMobileMenu}>Accueil</Link>
          {categories.map((cat) => (
            <div key={cat.id} className="navbar-mobile-group">
              <Link to={`/categorie/${cat.slug}`} className="navbar-mobile-group-title" onClick={closeMobileMenu}>{cat.nom}</Link>
              <div className="navbar-mobile-submenu">
                {cat.sous_categories.map((sc) => (
                  <Link key={sc.id} to={`/catalogue?sous_categorie=${sc.slug}`} onClick={closeMobileMenu}>
                    {sc.nom}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link to="/a-propos" onClick={closeMobileMenu}>À propos</Link>

          {user ? (
            <>
              <div className="navbar-mobile-role">{`role: ${user.role}`}</div>
              {isAdminRole(user) && (
                <Link to="/espace-admin" onClick={closeMobileMenu}>Espace admin</Link>
              )}
              <Link to={isAdminRole(user) ? "/espace-admin" : "/ma-bibliotheque"} onClick={closeMobileMenu}>Ma bibliothèque</Link>
              <button
                type="button"
                className="navbar-mobile-logout"
                onClick={() => {
                  logout();
                  closeMobileMenu();
                }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link to="/connexion" onClick={closeMobileMenu}>Connexion</Link>
              <Link to="/inscription" className="navbar-mobile-cta" onClick={closeMobileMenu}>Créer un compte</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
