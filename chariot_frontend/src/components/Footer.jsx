import { Link } from "react-router-dom";
import "./Footer.css";
import WebCounter from "./WebCounter";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="Retour à l'accueil">
            <img src="/logo.png" alt="EDS" className="footer-logo-img" />
            <span className="footer-brand-name">Ets DOMBOU SERVICES EXPRESS</span>
          </Link>
          <p>
           Découvrez nos catégories : Hôtellerie, avec des services de restauration, décoration et gâteaux personnalisés pour vos événements ; Génie civil, avec des ouvrages sur la construction de bâtiments, ponts, routes et matériaux ; et Éloquence, avec du coaching et des formations pour progresser en prise de parole en public.
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
      <WebCounter className="web-counter-footer" />
    </footer>
  );
}
