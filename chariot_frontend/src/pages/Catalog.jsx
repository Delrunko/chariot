import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import BookCard from "../components/BookCard";
import RevealOnScroll from "../components/RevealOnScroll";
import ServiceCard from "../components/ServiceCard";
import "./Home.css";

const catalogRelations = `
  subcategories!inner (
    id,
    name,
    slug,
    active,
    categories!inner (
      id,
      name,
      slug,
      category_type,
      active
    )
  )
`;

const relationRecord = (value) => (Array.isArray(value) ? value[0] : value);

function mapCatalogItem(item, type) {
  const subcategory = relationRecord(item.subcategories);
  const category = relationRecord(subcategory?.categories);

  return {
    id: item.id,
    titre: item.title,
    slug: item.slug,
    description: item.description,
    prix: item.price,
    couverture: getStoragePublicUrl("covers", item.cover_path),
    date_ajout: item.added_at,
    categorie: category?.name ?? "",
    categorie_slug: category?.slug ?? "",
    sous_categorie: subcategory?.name ?? "",
    sous_categorie_slug: subcategory?.slug ?? "",
    type_categorie: type,
    ...(type === "service"
      ? {
          document: item.document_path,
          video: item.video_path,
          video_url: item.video_url,
          whatsapp_phone: item.whatsapp_phone,
        }
      : {}),
  };
}

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
      const [categoriesResult, booksResult, servicesResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, category_type, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("books")
          .select(`
            id,
            title,
            slug,
            description,
            price,
            cover_path,
            added_at,
            ${catalogRelations}
          `)
          .eq("available", true)
          .eq("subcategories.active", true)
          .eq("subcategories.categories.active", true)
          .order("added_at", { ascending: false }),
        supabase
          .from("services")
          .select(`
            id,
            title,
            slug,
            description,
            price,
            cover_path,
            document_path,
            video_path,
            video_url,
            whatsapp_phone,
            added_at,
            ${catalogRelations}
          `)
          .eq("available", true)
          .eq("subcategories.active", true)
          .eq("subcategories.categories.active", true)
          .order("added_at", { ascending: false }),
      ]);

      const failedResult = [categoriesResult, booksResult, servicesResult].find(
        (result) => result.error,
      );
      if (failedResult?.error) {
        throw new Error(failedResult.error.message);
      }

      const categories = (categoriesResult.data ?? []).map((category) => ({
        ...category,
        nom: category.name,
      }));
      const books = (booksResult.data ?? []).map((book) =>
        mapCatalogItem(book, "livre"),
      );
      const services = (servicesResult.data ?? []).map((service) =>
        mapCatalogItem(service, "service"),
      );
      const merged = [...books, ...services].sort(
        (a, b) => new Date(b.date_ajout || 0) - new Date(a.date_ajout || 0),
      );

      if (mounted) {
        setCategoryOptions(categories);
        setLivres(merged);
      }
    };

    loadCatalog()
      .catch((loadError) => {
        if (mounted) {
          const errorMessage =
            loadError instanceof Error ? loadError.message : String(loadError);
          const isNetworkError =
            loadError instanceof TypeError ||
            /failed to fetch|networkerror|network request failed/i.test(errorMessage);
          setLivres([]);
          setErreur(
            isNetworkError
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