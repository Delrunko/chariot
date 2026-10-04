import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import { saveOfflineSnapshot } from "../lib/offlineStorage";
import { loadWithOfflineSnapshot } from "../lib/offlineData";

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

async function fetchPublicCatalog() {
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
  if (failedResult?.error) throw new Error(failedResult.error.message);

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
  const items = [...books, ...services].sort(
    (a, b) => new Date(b.date_ajout || 0) - new Date(a.date_ajout || 0),
  );

  return { categories, items };
}

async function cacheCategorySnapshots(catalog) {
  const writes = [
    ...catalog.categories.map(async (category) => {
      try {
        await saveOfflineSnapshot(`category:${category.slug}`, {
          category: { ...category, nom: category.name },
          items: catalog.items.filter((item) => item.categorie_slug === category.slug),
        });
      } catch (error) {
        console.warn(
          `Impossible d'enregistrer la catégorie ${category.slug} hors ligne.`,
          error,
        );
      }
    }),
    ...catalog.items.map(async (item) => {
      const isService = item.type_categorie === "service";
      const snapshot = {
        id: item.id,
        title: item.titre,
        slug: item.slug,
        description: item.description,
        price: item.prix,
        cover_path: item.couverture,
        available: true,
        subcategories: {
          name: item.sous_categorie,
          categories: { name: item.categorie },
        },
      };
      const key = isService ? `service-detail:${item.slug}` : `book-detail:${item.slug}`;
      try {
        await saveOfflineSnapshot(
          key,
          isService
            ? {
                ...snapshot,
                document_path: item.document,
                video_path: item.video,
                video_url: item.video_url,
                whatsapp_phone: item.whatsapp_phone,
                service_images: [],
              }
            : snapshot,
        );
      } catch (error) {
        console.warn(`Impossible d'enregistrer la fiche ${item.slug} hors ligne.`, error);
      }
    }),
  ];
  await Promise.all(writes);
}

export async function loadPublicCatalog() {
  const catalog = await loadWithOfflineSnapshot("public-catalog", fetchPublicCatalog);
  await cacheCategorySnapshots(catalog);
  return catalog;
}

export async function warmPublicCatalog() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const catalog = await loadWithOfflineSnapshot("public-catalog", fetchPublicCatalog);
  await cacheCategorySnapshots(catalog);
}
