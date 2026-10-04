import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { loadPublicCatalog } from "../services/publicCatalog";
import BookCard from "../components/BookCard";
import RevealOnScroll from "../components/RevealOnScroll";
import ServiceCard from "../components/ServiceCard";
import "./Home.css";

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [livres, setLivres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [servicesAchetesIds, setServicesAchetesIds] = useState(new Set());

  const sousCategorie = searchParams.get("sous_categorie");
  const categorie = searchParams.get("categorie");
  const recherche = searchParams.get("q") || "";

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      const { categories, items } = await loadPublicCatalog();

      if (mounted) {
        setCategoryOptions(categories);
        setLivres(items);
      }
    };

    loadCatalog()
      .catch((loadError) => {
        if (mounted) {
          const errorMessage =
            loadError instanceof Error ? loadError.message : String(loadError);
          setLivres([]);
          setErreur(
            loadError instanceof TypeError ||
            /failed to fetch|networkerror|network request failed/i.test(errorMessage)
              ? "Connexion à Supabase impossible. Vérifiez l'URL du projet et votre connexion."
              : errorMessage
                ? errorMessage
                : "Impossible de charger le catalogue depuis Supabase.",
          );
        }
      })
      .finally(() => {
        if (mounted) setChargement(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;

    const loadPaidServiceOrders = async (userId) => {
      const currentRequestId = ++requestId;
      if (!userId) {
        if (mounted) setServicesAchetesIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("service_id")
        .eq("user_id", userId)
        .eq("status", "paye")
        .not("service_id", "is", null);

      if (error) {
        console.error("Impossible de charger les achats de services depuis Supabase.", error);
        if (mounted && currentRequestId === requestId) {
          setServicesAchetesIds(new Set());
        }
        return;
      }

      if (mounted && currentRequestId === requestId) {
        setServicesAchetesIds(
          new Set((data ?? []).map((order) => String(order.service_id))),
        );
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Impossible de vérifier la session Supabase.", error);
        return loadPaidServiceOrders(null);
      }
      return loadPaidServiceOrders(data.session?.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void loadPaidServiceOrders(session?.user.id ?? null);
      }, 0);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const livresAffiches = useMemo(() => {
    const terme = normalizeText(recherche);
    return livres.filter((livre) => {
      if (categorie && livre.categorie_slug !== categorie) return false;
      if (sousCategorie && livre.sous_categorie_slug !== sousCategorie) return false;
      if (!terme) return true;
      const haystack = [
        livre.titre,
        livre.description,
        livre.categorie,
        livre.sous_categorie,
      ]
        .filter(Boolean)
        .join(" ");

      return normalizeText(haystack).includes(terme);
    });
  }, [livres, categorie, sousCategorie, recherche]);

  const categories = categoryOptions.filter(Boolean);

  const handleSearch = (event) => {
    const nextValue = event.target.value;
    const params = new URLSearchParams(searchParams);

    if (nextValue.trim()) {
      params.set("q", nextValue.trim());
    } else {
      params.delete("q");
    }

    setSearchParams(params, { replace: true });
  };

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("categorie");
    params.delete("sous_categorie");
    params.delete("q");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <div className="catalog-header-copy">
          <span className="eyebrow">Catalogue</span>
          <h1>Tous les ouvrages pour réussir</h1>
          <p>
            Retrouvez les supports de cours, exercices et corrigés adaptés à votre niveau, votre filière et votre rythme d’apprentissage.
          </p>
        </div>

        <div className="catalog-header-stats">
          <div className="catalog-stat">
            <span className="catalog-stat-value">{livres.length}</span>
            <span className="catalog-stat-label">ouvrages</span>
          </div>
          <div className="catalog-stat">
            <span className="catalog-stat-value">7</span>
            <span className="catalog-stat-label">niveaux</span>
          </div>
          <div className="catalog-stat">
            <span className="catalog-stat-value">100%</span>
            <span className="catalog-stat-label">hors ligne</span>
          </div>
        </div>
      </header>

      <div className="catalog-search-panel">
        <label className="catalog-search" htmlFor="catalog-search">
          <span className="catalog-search-icon" aria-hidden="true">⌕</span>
          <input
            id="catalog-search"
            type="search"
            value={recherche}
            onChange={handleSearch}
            placeholder="Rechercher un livre, une catégorie ou un niveau..."
            aria-label="Rechercher dans le catalogue"
          />
        </label>
        {(categorie || sousCategorie || recherche) && (
          <button type="button" className="catalog-clear" onClick={resetFilters}>
            Réinitialiser
          </button>
        )}
      </div>

      <div className="catalog-toolbar">
        <button type="button" onClick={resetFilters} className={`catalog-filter ${!categorie && !sousCategorie && !recherche ? "active" : ""}`}>
          Tous
        </button>
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.slug || cat.id || cat.nom}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              // Use slug (backend expects category slug)
              params.set("categorie", cat.slug || cat.nom);
              params.delete("sous_categorie");
              setSearchParams(params, { replace: true });
            }}
            className={`catalog-filter ${categorie === (cat.slug || cat.nom) ? "active" : ""}`}
          >
            {cat.nom || cat}
          </button>
        ))}
      </div>

      {chargement && <div className="catalog-state">Chargement…</div>}
      {!chargement && erreur && (
        <div className="catalog-state catalog-empty" role="alert">
          Le catalogue est temporairement indisponible : {erreur}
        </div>
      )}
      {!chargement && !erreur && livresAffiches.length === 0 && (
        <div className="catalog-state catalog-empty">
          {recherche
            ? `Aucun résultat pour « ${recherche} » dans cette sélection.`
            : "Aucun livre dans cette catégorie pour le moment."}
        </div>
      )}

      {!chargement && !erreur && livresAffiches.length > 0 && (
        <div className="catalog-results-meta">
          {recherche ? `Résultats pour “${recherche}”` : "Tous les ouvrages"} · {livresAffiches.length} trouvé{livresAffiches.length > 1 ? "s" : ""}
        </div>
      )}

      {!chargement && !erreur && livresAffiches.length > 0 && (
        <div className="catalog-grid">
          {livresAffiches.map((livre, idx) => (
            <RevealOnScroll key={livre.id} delai={(idx % 8) * 60}>
              {livre.type_categorie === "service" ? (
                <ServiceCard
                  livre={livre}
                  achete={servicesAchetesIds.has(String(livre.id))}
                />
              ) : (
                <BookCard livre={livre} />
              )}
            </RevealOnScroll>
          ))}
        </div>
      )}
    </div>
  );
}