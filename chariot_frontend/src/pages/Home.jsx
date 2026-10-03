import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import BookShelfCarousel from "../components/BookShelfCarousel";
import {
  StatsSection,
  AboutTeaser,
  ServicesSection,
  DomainModalitiesSection,
  WhyUsSection,
  GallerySection,
  ImmersiveSection,
  TestimonialsSection,
  ProcessSection,
  CTASection,
} from "../components/HomeSections";
import "./Home.css";

export default function Home() {
  const [livres, setLivres] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let active = true;

    const loadFeaturedBooks = async () => {
      const { data, error } = await supabase
        .from("books")
        .select("id, title, slug, cover_path, price, featured, added_at")
        .eq("available", true)
        .eq("featured", true)
        .order("added_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      if (active) {
        setLivres(
          (data ?? []).map((book) => ({
            ...book,
            titre: book.title,
            couverture: getStoragePublicUrl("covers", book.cover_path),
            prix: book.price,
            date_ajout: book.added_at,
          })),
        );
      }
    };

    loadFeaturedBooks()
      .catch((error) => {
        console.error("Impossible de charger la vitrine depuis Supabase.", error);
        if (active) setLivres([]);
      })
      .finally(() => {
        if (active) setChargement(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home">
      {/* HERO + CARROUSEL */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-text fade-in-up">
            <span className="eyebrow">La référence du terrain</span>
            <h1>
              Des supports de cours et d’examens pour <span className="highlight">réussir en Maçonnerie &amp; Bâtiment</span>
            </h1>
            <p>
              Retrouvez les outils pédagogiques qui vous aident à apprendre, réviser et progresser — même sans connexion.
            </p>

            <div className="home-hero-actions">
              <Link to="/catalogue" className="btn-primary">Voir le catalogue</Link>
              <Link to="/inscription" className="btn-outline btn-outline-light">Créer un compte</Link>
            </div>

            <ul className="home-hero-trust">
              <li>7 niveaux couverts</li>
              <li>Lecture hors ligne</li>
              <li>Paiement Orange Money</li>
            </ul>
          </div>

          {!chargement && <BookShelfCarousel livres={livres} />}
        </div>
      </section>

      {/* CHIFFRES / CONFIANCE */}
      <StatsSection />

      {/* À PROPOS */}
      <AboutTeaser />

      {/* SERVICES */}
      <ServicesSection />

      {/* DOMAINES / MODALITÉS */}
      <DomainModalitiesSection />

      {/* POURQUOI NOUS */}
      <WhyUsSection />

      {/* RÉALISATIONS */}
      <GallerySection livres={livres} />

      {/* SECTION IMMERSIVE */}
      <ImmersiveSection />

      {/* TÉMOIGNAGES */}
      <TestimonialsSection />

      {/* NOTRE PROCESSUS */}
      <ProcessSection />

      {/* CALL TO ACTION */}
      <CTASection />
    </div>
  );
}