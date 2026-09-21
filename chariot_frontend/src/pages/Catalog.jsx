import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { catalogService, serviceService, purchaseService } from "../services/api";
import { useAuth } from "../context/AuthContext";
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
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [servicesAchetesIds, setServicesAchetesIds] = useState(new Set());
  const { user } = useAuth();

  const sousCategorie = searchParams.get("sous_categorie");
  const categorie = searchParams.get("categorie");
  const recherche = searchParams.get("q") || "";

  useEffect(() => {
    // Load available categories from the API so we can use slugs for filtering
    let mounted = true;
    catalogService
      .getCategories()
      .then((res) => {
        if (!mounted) return;
        setCategoryOptions(res?.data || []);
      })
      .catch(() => setCategoryOptions([]));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // Load the services the current user has already paid for, so we can
    // show the "Acheté" badge on ServiceCard (mirrors deja_achete for books).
    let mounted = true;
    if (!user) {
      setServicesAchetesIds(new Set());
      return () => { mounted = false; };
    }
    purchaseService
      .myServicePurchases()
      .then((res) => {
        if (!mounted) return;
        const payload = res?.data ?? res ?? [];
        const list = Array.isArray(payload) ? payload : [];
        const ids = list
          .filter((p) => {
            const s = (p.statut || "").toString().toLowerCase();
            return s.includes("paye") || s === "payé" || s === "paid";
          })
          .map((p) => {
            if (p.service && typeof p.service === "object") return String(p.service.id);
            return String(p.service);
          });
        setServicesAchetesIds(new Set(ids));
      })
      .catch(() => setServicesAchetesIds(new Set()));
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    setChargement(true);
    // Include the search term when requesting from the backend so the DB does the filtering
    const params = {
      sous_categorie: sousCategorie || undefined,
      categorie: categorie || undefined,
      search: recherche || undefined,
    };

    Promise.all([
      catalogService.getBooks(params),
      serviceService.getServices(params),
    ])
      .then(([booksRes, servicesRes]) => {
        const books = booksRes?.data || [];
        const services = servicesRes?.data || [];
        // Fusionner les deux listes et trier par date d'ajout si disponible
        const merged = [...books, ...services].sort((a, b) => {
          const da = new Date(a.date_ajout || a.created_at || 0).getTime();
          const db = new Date(b.date_ajout || b.created_at || 0).getTime();
          return db - da;
        });
        setLivres(merged);
      })
      .catch(() => setLivres([]))
      .finally(() => setChargement(false));
  }, [sousCategorie, categorie, recherche]);

  const livresAffiches = useMemo(() => {
    const terme = normalizeText(recherche);
    if (!terme) return livres;

    return livres.filter((livre) => {
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
  }, [livres, recherche]);

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
      {!chargement && livresAffiches.length === 0 && (
        <div className="catalog-state catalog-empty">
          {recherche
            ? `Aucun résultat pour « ${recherche} » dans cette sélection.`
            : "Aucun livre dans cette catégorie pour le moment."}
        </div>
      )}

      {!chargement && livresAffiches.length > 0 && (
        <div className="catalog-results-meta">
          {recherche ? `Résultats pour “${recherche}”` : "Tous les ouvrages"} · {livresAffiches.length} trouvé{livresAffiches.length > 1 ? "s" : ""}
        </div>
      )}

      {!chargement && livresAffiches.length > 0 && (
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