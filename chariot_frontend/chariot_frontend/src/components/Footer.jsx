import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <span className="footer-logo">
            <img src="/logo.png" alt="EDS" className="footer-logo-img" /> <span className="footer-brand-name">Ets DOUMBOU SERVICES EXPRESS</span>
          </span>
          <p>
            La librairie technique en ligne dédiée à la filière Maçonnerie &
            Bâtiment — de la 1ère année à la Terminale F4.
          </p>
        </div>

        <div className="footer-col">
          <h4>Naviguer</h4>
          <Link to="/">Accueil</Link>
          <Link to="/catalogue">Catalogue</Link>
          <Link to="/a-propos">À propos</Link>
        </div>

        <div className="footer-col">
          <h4>Mon compte</h4>
          <Link to="/connexion">Connexion</Link>
          <Link to="/inscription">Créer un compte</Link>
          <Link to="/ma-bibliotheque">Ma bibliothèque</Link>
        </div>

        <div className="footer-col">
          <h4>Paiement</h4>
          <p className="footer-payment">Orange Money accepté</p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} EDS — Tous droits réservés.</span>
        <span>Une réalisation BigData Center &amp; IA</span>
      </div>
    </footer>
  );
}
