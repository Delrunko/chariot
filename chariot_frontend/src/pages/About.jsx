import "./About.css";

export default function About() {
  return (
    <div className="about">
      <section className="about-hero">
        <span className="eyebrow">Notre mission</span>
        <h1>Mettre l'ouvrage technique entre toutes les mains, où que l'on soit</h1>
        <p>
          Ets DOUMBOU SERVICES EXPRESS d'un constat simple : les élèves et étudiants en
          filière Maçonnerie &amp; Bâtiment n'ont pas toujours un accès facile
          à leurs manuels de référence. Nous rendons ces ouvrages disponibles
          en ligne, achetables en quelques instants, et consultables même
          sans connexion internet.
        </p>
      </section>

      <section className="about-values">
        <div className="about-value">
          <span className="about-value-mark">01</span>
          <h3>Un catalogue pensé pour la filière</h3>
          <p>
            De la 1ère année jusqu'à la Terminale F4, chaque ouvrage est
            classé par niveau pour que l'élève retrouve exactement ce dont
            il a besoin, sans se perdre dans un catalogue générique.
          </p>
        </div>
        <div className="about-value">
          <span className="about-value-mark">02</span>
          <h3>Un accès qui suit l'élève, pas la connexion</h3>
          <p>
            Une fois un livre acheté, il reste consultable même hors ligne —
            pensé pour les réalités de connexion du terrain, pas seulement
            pour un usage en ville.
          </p>
        </div>
        <div className="about-value">
          <span className="about-value-mark">03</span>
          <h3>Un paiement simple, à la portée de tous</h3>
          <p>
            L'achat se fait directement via Orange Money, sans carte
            bancaire ni démarche compliquée.
          </p>
        </div>
      </section>

      <section className="about-story">
        <div className="about-story-text">
          <span className="eyebrow">Notre histoire</span>
          <h2>Une réalisation portée par BigData Center &amp; IA</h2>
          <p>
            EDS est développé par l'équipe de BigData Center &amp; IA,
            pour le compte d'un formateur et vendeur d'ouvrages techniques
            engagé depuis plusieurs années auprès des élèves de la filière
            Maçonnerie &amp; Bâtiment. La plateforme est pensée, conçue et
            améliorée en continu pour rester au plus près des besoins réels
            des élèves et de leurs enseignants.
          </p>
        </div>
      </section>
    </div>
  );
}
