import { Link } from "react-router-dom";
import "./HomeSections.css";

/* ---------- Chiffres / Confiance ---------- */
export function StatsSection() {
  const stats = [
    { chiffre: "7", label: "Niveaux couverts — 1ère année à Terminale F4" },
    { chiffre: "100%", label: "Lecture possible hors connexion après achat" },
    { chiffre: "CEMAC", label: "Zone de vente couverte" },
    { chiffre: "Orange Money", label: "Paiement simple et local" },
  ];
  return (
    <section className="stats-section">
      {stats.map((s) => (
        <div className="stat-item" key={s.label}>
          <span className="stat-number">{s.chiffre}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------- À propos (teaser) ---------- */
export function AboutTeaser() {
  return (
    <section className="about-teaser">
      <div className="about-teaser-inner">
        <div className="about-teaser-text">
          <span className="eyebrow eyebrow-light">Qui sommes-nous</span>
          <h2>Des ouvrages conçus pour avancer, pas pour compliquer</h2>
          <p>
            EDS met à la disposition des élèves et étudiants de la filière
            Maçonnerie &amp; Bâtiment des contenus de cours, d’exercices et de
            corrigés, pensés pour être clairs, utiles et directement applicables
            en classe comme au moment des révisions.
          </p>
          <Link to="/a-propos" className="btn-outline">En savoir plus</Link>
        </div>

        <div className="about-teaser-panel">
          <p className="mini-kicker">Ce que tu trouves chez EDS</p>
          <ul>
            <li>Des notions de cours structurées et faciles à suivre</li>
            <li>Des exercices types pour s’entraîner sereinement</li>
            <li>Des corrigés qui aident à comprendre la méthode</li>
            <li>Un accès simple, rapide et accessible partout</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Services ---------- */
export function ServicesSection() {
  const services = [
    { icon: "fa-bolt-lightning", titre: "Achat rapide", texte: "Choisissez votre ouvrage et payez en quelques clics via Orange Money, sans friction." },
    { icon: "fa-wifi", titre: "Lecture hors ligne", texte: "Une fois acheté, votre support reste disponible même quand la connexion manque." },
    { icon: "fa-graduation-cap", titre: "Progression par niveau", texte: "Des supports pour vous suivre en classe d'examen, 4e année, Première et Terminale en Génie Civil" },
    { icon: "fa-building-columns", titre: "Contenus complets", texte: "Cours, méthodes, exercices et corrigés réunis dans un seul parcours de travail." },
  ];
  return (
    <section className="services-section">
      <span className="eyebrow eyebrow-light">Ce que propose EDS</span>
      <h2>Tout ce qu’il faut pour progresser</h2>
      <div className="services-grid">
        {services.map((s) => (
          <div className="service-card" key={s.titre}>
            <span className="service-icon"><i className={`fa-solid ${s.icon}`} aria-hidden="true" /></span>
            <h3>{s.titre}</h3>
            <p>{s.texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Modalités / domaines ---------- */
export function DomainModalitiesSection() {
  const domaines = [
    { icon: "fa-hotel", titre: "Hôtellerie", texte: "Formation pratique et professionnelle pour les métiers d’accueil, restauration, gestion d’établissements et service client." },
    { icon: "fa-microphone-lines", titre: "Éloquence", texte: "Développez votre confiance, votre expression orale et votre présence pour mieux communiquer en public et en entreprise." },
    { icon: "fa-chart-line", titre: "Commerce & Gestion", texte: "Des contenus utiles pour l’organisation, la vente, la négociation, la gestion de clientèle et la performance commerciale." },
    { icon: "fa-book-open-reader", titre: "Supports de cours", texte: "Livres, guides et ressources pédagogiques structurés pour accompagner la progression dans plusieurs domaines d’activité." },
  ];

  return (
    <section className="domain-modalities-section">
      <span className="eyebrow eyebrow-light">Nos domaines</span>
      <h2>Des formations et ressources pour plusieurs filières</h2>
      <div className="domain-modalities-grid">
        {domaines.map((d) => (
          <div className="domain-modality-card" key={d.titre}>
            <span className="domain-modality-icon" aria-hidden="true"><i className={`fa-solid ${d.icon}`} /></span>
            <h3>{d.titre}</h3>
            <p>{d.texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Pourquoi nous ---------- */
export function WhyUsSection() {
  const points = [
    { titre: "Une pédagogie de terrain", texte: "Conçue par un enseignant-ingénieur qui connaît les vrais besoins du métier et de l’examen." },
    { titre: "Des supports actionnables", texte: "Chaque ouvrage aide à comprendre, pratiquer et retenir les notions essentielles sans perdre de temps." },
    { titre: "Un accès pensé pour la réalité locale", texte: "Paiement simple, lecture accessible hors ligne, et une expérience adaptée à des usages mobiles et fiables." },
  ];
  return (
    <section className="whyus-section">
      <span className="eyebrow">Pourquoi EDS</span>
      <h2>Une bibliothèque pensée pour aller plus loin</h2>
      <div className="whyus-grid">
        {points.map((p) => (
          <div className="whyus-item" key={p.titre}>
            <h3>{p.titre}</h3>
            <p>{p.texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Réalisations (galerie des couvertures) ---------- */
export function GallerySection({ livres }) {
  if (!livres || livres.length === 0) return null;
  return (
    <section className="gallery-section">
      <span className="eyebrow eyebrow-light">Réalisations</span>
      <h2>Nos ouvrages publiés</h2>
      <div className="gallery-grid">
        {livres.slice(0, 8).map((livre) => (
          <Link to={`/livre/${livre.slug}`} className="gallery-item" key={livre.id}>
            <img src={livre.couverture} alt={livre.titre} />
            <span className="gallery-item-title">{livre.titre}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Section immersive ---------- */
export function ImmersiveSection() {
  return (
    <section className="immersive-section">
      <div className="immersive-content">
        <span className="eyebrow">Revue et corrigée</span>
        <h2>L'essentiel des notions de cours. Des exercices types. Des examens corrigés.</h2>
        <p>Chaque ouvrage EDS réunit la théorie et la pratique, pour progresser du chantier jusqu'à l'examen.</p>
        <Link to="/catalogue" className="btn-primary">Parcourir le catalogue</Link>
      </div>
    </section>
  );
}

/* ---------- Témoignages ---------- */
import { useEffect, useState } from "react";
import { testimonialsService } from "../services/api";

export function TestimonialsSection() {
  const [temoignages, setTemoignages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [texte, setTexte] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Validation rules
  const NAME_MIN = 2;
  const NAME_MAX = 60;
  const MSG_MIN = 10;
  const MSG_MAX = 800;

  useEffect(() => {
    let mounted = true;
    testimonialsService
      .getTestimonials()
      .then((res) => {
        if (!mounted) return;
        const data = res.data || res;
        setTemoignages(data);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  const validate = () => {
    if (!nom || nom.trim().length < NAME_MIN) return `Le nom doit contenir au moins ${NAME_MIN} caractères.`;
    if (nom.trim().length > NAME_MAX) return `Le nom ne peut pas dépasser ${NAME_MAX} caractères.`;
    if (!texte || texte.trim().length < MSG_MIN) return `Le message doit contenir au moins ${MSG_MIN} caractères.`;
    if (texte.trim().length > MSG_MAX) return `Le message ne peut pas dépasser ${MSG_MAX} caractères.`;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const vErr = validate();
    if (vErr) {
      setFormError(vErr);
      return;
    }

    setSubmitting(true);
    try {
      const payload = { nom: nom.trim(), message: texte.trim(), rating };
      const created = await testimonialsService.createTestimonial(payload);
      setTemoignages((s) => [created, ...s]);
      setNom("");
      setTexte("");
      setRating(5);
      setSuccess("Merci ! Votre témoignage a été publié.");
    } catch (err) {
      console.error(err);
      setFormError("Échec lors de l'envoi du témoignage. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = MSG_MAX - (texte ? texte.length : 0);

  return (
    <section className="testimonials-section">
      <span className="eyebrow eyebrow-light">Témoignages</span>
      <h2>Ce qu'en disent les élèves</h2>

      <div className="testimonials-grid">
        {loading ? (
          <p>Chargement…</p>
        ) : (
          temoignages.map((t, idx) => (
            <blockquote className="testimonial-card" key={t.id || t.nom + idx}>
              <p>"{t.message || t.texte || t.text}"</p>
              — {t.nom}
            </blockquote>
          ))
        )}
      </div>

      <div className="testimonial-form dark">
        <h3>Laisser un témoignage</h3>
        {formError && <div className="form-error">{formError}</div>}
        {success && <div className="form-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Votre nom
            <input
              value={nom}
              maxLength={NAME_MAX}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ton nom ou pseudonyme"
            />
          </label>

          <label>
            Votre retour
            <textarea
              value={texte}
              maxLength={MSG_MAX}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Raconte en quelques phrases ce que tu as apprécié"
            />
            <div className="char-counter">{remaining} caractères restants</div>
          </label>

          <label>
            Note
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={4}>4</option>
              <option value={3}>3</option>
              <option value={2}>2</option>
              <option value={1}>1</option>
            </select>
          </label>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ---------- Notre processus ---------- */
export function ProcessSection() {
  const etapes = [
    { n: "01", titre: "Choisissez votre niveau", texte: "Parcourez le catalogue classé par classe et filière." },
    { n: "02", titre: "Achetez via Orange Money", texte: "Paiement rapide, directement depuis votre téléphone." },
    { n: "03", titre: "Lisez, même hors-ligne", texte: "Retrouvez votre ouvrage dans « Ma bibliothèque », à tout moment." },
  ];
  return (
    <section className="process-section">
      <span className="eyebrow">Comment ça marche</span>
      <h2>Notre processus</h2>
      <div className="process-grid">
        {etapes.map((e) => (
          <div className="process-item" key={e.n}>
            <span className="process-number">{e.n}</span>
            <h3>{e.titre}</h3>
            <p>{e.texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Call to action ---------- */
export function CTASection() {
  return (
    <section className="cta-section">
      <h2>Prêt à commencer ?</h2>
      <p>Créez votre compte et accédez à vos premiers ouvrages en quelques minutes.</p>
      <Link to="/inscription" className="btn-primary">Créer un compte</Link>
    </section>
  );
}