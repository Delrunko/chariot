import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import { useAuth } from "../context/AuthContext";
import "./AdminDashboard.css";

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const safeFileName = (name) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");

const relation = (value) => (Array.isArray(value) ? value[0] : value);

function formatSupabaseError(error) {
  if (!error || typeof error !== "object") return "Erreur inconnue.";
  return [
    typeof error.message === "string" ? error.message : "",
    typeof error.code === "string" ? `Code ${error.code}` : "",
    typeof error.hint === "string" ? error.hint : "",
  ]
    .filter(Boolean)
    .join(" — ") || "Erreur inconnue.";
}

async function uploadAsset(bucket, path, file, contentType = file.type) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: contentType || undefined,
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Le bucket Storage "${bucket}" n'existe pas dans ce projet Supabase. Exécutez le script fix_admin_rls.sql dans Supabase Studio, puis réessayez.`,
      );
    }
    throw error;
  }
  return path;
}

async function cleanupUploadedAssets(uploaded) {
  const results = await Promise.all(
    uploaded.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])),
  );
  results.forEach(({ error }) => {
    if (error) console.error("Impossible de nettoyer un fichier téléversé.", error);
  });
}

function mapCategory(category) {
  return {
    ...category,
    nom: category.name,
    ordre: category.sort_order,
    type_categorie: category.category_type,
    sous_categories: (category.subcategories || []).map((subcategory) => ({
      ...subcategory,
      nom: subcategory.name,
      categorie: subcategory.category_id,
      ordre: subcategory.sort_order,
    })),
  };
}

function mapBook(book) {
  const subcategory = relation(book.subcategories);
  const category = relation(subcategory?.categories);
  return {
    ...book,
    titre: book.title,
    prix: book.price,
    couverture: getStoragePublicUrl("covers", book.cover_path),
    fichier: book.pdf_path,
    disponible: book.available,
    mis_en_avant: book.featured,
    sous_categorie: subcategory?.id || "",
    categorie_nom: category?.name || "",
    sous_categorie_nom: subcategory?.name || "",
  };
}

function mapService(service) {
  const subcategory = relation(service.subcategories);
  const category = relation(subcategory?.categories);
  return {
    ...service,
    titre: service.title,
    prix: service.price,
    couverture: getStoragePublicUrl("covers", service.cover_path),
    document: service.document_path,
    video: service.video_path || "",
    disponible: service.available,
    sous_categorie: subcategory?.id || "",
    categorie_nom: category?.name || "",
    sous_categorie_nom: subcategory?.name || "",
    images: (service.service_images || []).map((image) => ({
      ...image,
      image: getStoragePublicUrl("covers", image.image_path),
    })),
  };
}

function mapOrder(order) {
  const book = relation(order.book);
  const service = relation(order.service);
  const profile = relation(order.profile);
  const personName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return {
    ...order,
    statut: order.status,
    montant: order.amount,
    date_achat: order.purchased_at,
    moyen_paiement: order.payment_method,
    reference_transaction: order.transaction_reference,
    utilisateur_username: profile?.username || personName || "Utilisateur",
    utilisateur__username: profile?.username || personName || "Utilisateur",
    livre_titre: book?.title || service?.title || "—",
    livre__titre: book?.title || service?.title || "—",
    produit_type: book ? "Livre" : "Service",
    produit_id: book?.id || service?.id,
  };
}

const emptyCategoryForm = { nom: "", description: "", ordre: "0", type_categorie: "livre" };
const emptySubCategoryForm = { nom: "", categorie: "", ordre: "0" };
const emptyBookForm = {
  titre: "",
  description: "",
  sous_categorie: "",
  prix: "",
  disponible: true,
  mis_en_avant: false,
  couverture: null,
  fichier: null,
};

const SIDEBAR_SECTIONS = [
  { id: "overview", label: "Vue d'ensemble", icon: "fa-solid fa-gauge" },
  { id: "categories", label: "Catégories", icon: "fa-solid fa-folder-tree" },
  { id: "subcategories", label: "Sous-catégories", icon: "fa-solid fa-sitemap" },
  { id: "books", label: "Livres", icon: "fa-solid fa-book" },
  { id: "hotellerie", label: "Hôtellerie", icon: "fa-solid fa-hotel" },
  { id: "eloquence", label: "Éloquence", icon: "fa-solid fa-microphone" },
  { id: "quotes", label: "Devis", icon: "fa-solid fa-file-invoice" },
  { id: "users", label: "Utilisateurs", icon: "fa-solid fa-users" },
  { id: "purchases", label: "Achats", icon: "fa-solid fa-receipt" },
  { id: "payment", label: "Paiement", icon: "fa-solid fa-money-bill-wave" },
  { id: "profile", label: "Mon profil", icon: "fa-solid fa-user-pen" },
];

export default function AdminDashboard() {
  const { user, session, isAdmin, signOut, acceptAuthenticatedProfile } = useAuth();

  if (!user || !isAdmin) {
    return <Navigate to="/connexion" replace />;
  }

  return (
    <AdminDashboardContent
      user={user}
      session={session}
      signOut={signOut}
      acceptAuthenticatedProfile={acceptAuthenticatedProfile}
    />
  );
}

function AdminDashboardContent({ user, session, signOut, acceptAuthenticatedProfile }) {
  const [stats, setStats] = useState({
    total_categories: 0,
    total_sous_categories: 0,
    total_livres: 0,
    total_achats: 0,
    total_utilisateurs: 0,
  });
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [services, setServices] = useState([]);
  const [latestAddedService, setLatestAddedService] = useState(null);
  const [users, setUsers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [recentAchats, setRecentAchats] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [quotesError, setQuotesError] = useState("");
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [subCategoryForm, setSubCategoryForm] = useState(emptySubCategoryForm);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState(null);
  const [editingBookId, setEditingBookId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingSlug, setDeletingSlug] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'category'|'sub'|'book', slug, label }

  // Navigation du dashboard (barre latérale)
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOuverte, setSidebarOuverte] = useState(false);

  // Field-level form errors for better UX
  const [categoryFormErrors, setCategoryFormErrors] = useState({});
  const [subCategoryFormErrors, setSubCategoryFormErrors] = useState({});
  const [bookFormErrors, setBookFormErrors] = useState({});
  const [profileForm, setProfileForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    telephone: user.telephone || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const loadAdminData = async () => {
    try {
      const results = await Promise.all([
        supabase.from("categories").select(`
          id, name, slug, description, category_type, sort_order, active,
          subcategories(id, category_id, name, slug, sort_order, active)
        `).order("sort_order").order("name"),
        supabase.from("books").select(`
          id, title, slug, description, subcategory_id, price, cover_path, pdf_path,
          available, featured, added_at, subcategories(id, name, slug, categories(name))
        `).order("added_at", { ascending: false }),
        supabase.from("services").select(`
          id, title, slug, description, subcategory_id, price, cover_path, document_path,
          video_path, video_url, available, added_at, whatsapp_phone,
          subcategories(id, name, slug, categories(name)), service_images(id, image_path, sort_order)
        `).order("added_at", { ascending: false }),
        supabase.from("profiles").select("id, username, first_name, last_name, telephone, role, created_at").order("created_at", { ascending: false }),
        supabase.from("orders").select(`
          id, user_id, book_id, service_id, status, payment_method, transaction_reference,
          amount, purchased_at, paid_at, profile:profiles(username, first_name, last_name),
          book:books(title), service:services(title)
        `).order("purchased_at", { ascending: false }),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("subcategories").select("*", { count: "exact", head: true }),
        supabase.from("books").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "paye"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const [categoriesRes, booksRes, servicesRes, usersRes, ordersRes] = results;
      const orderRows = (ordersRes.data || []).map(mapOrder);
      setStats({
        total_categories: results[5].count || 0,
        total_sous_categories: results[6].count || 0,
        total_livres: results[7].count || 0,
        total_achats: results[8].count || 0,
        total_utilisateurs: results[9].count || 0,
      });
      setRecentAchats(orderRows.slice(0, 8));
      setCategories((categoriesRes.data || []).map(mapCategory));
      setBooks((booksRes.data || []).map(mapBook));
      setServices((servicesRes.data || []).map(mapService));
      setUsers(usersRes.data || []);
      setPurchases(orderRows);
      setError("");
      await loadAdminQuotes();
    } catch (err) {
      console.error("Impossible de charger les données d'administration Supabase.", err);
      setError(`Impossible de charger le tableau de bord administrateur : ${formatSupabaseError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminQuotes = async () => {
    try {
      const { data: quoteRows, error: quoteError } = await supabase
        .from("quotes")
        .select("*, category:categories(name)")
        .order("created_at", { ascending: false });

      if (quoteError) throw quoteError;

      const quoteIds = quoteRows.map((quote) => quote.id);
      let imagesByQuote = new Map();
      let warning = "";

      if (quoteIds.length) {
        const { data: quoteImages, error: imagesError } = await supabase
          .from("quote_images")
          .select("id, quote_id, image_path")
          .in("quote_id", quoteIds);

        if (imagesError) {
          console.error("Impossible de charger les images des devis.", imagesError);
          warning = `Les images des devis sont indisponibles : ${formatSupabaseError(imagesError)}`;
        } else {
          imagesByQuote = (quoteImages || []).reduce((imagesById, image) => {
            const images = imagesById.get(image.quote_id) || [];
            images.push({
              ...image,
              image: getStoragePublicUrl("covers", image.image_path),
            });
            imagesById.set(image.quote_id, images);
            return imagesById;
          }, new Map());
        }
      }

      const mappedQuotes = await Promise.all(quoteRows.map(async (quote) => {
        let pdfUrl = "";
        if (quote.pdf_path) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("pdfs")
            .createSignedUrl(quote.pdf_path, 3600);
          if (signedError) {
            console.error(`Impossible de créer le lien PDF du devis ${quote.id}.`, signedError);
            warning = warning || `Le PDF du devis ${quote.id} est indisponible : ${formatSupabaseError(signedError)}`;
          } else {
            pdfUrl = signedData.signedUrl;
          }
        }
        return {
          ...quote,
          nom: quote.client_name,
          telephone: quote.client_phone,
          prix_estime: quote.estimated_price,
          categorie: relation(quote.category)?.name || "",
          pdf_file: pdfUrl,
          images: imagesByQuote.get(quote.id) || [],
        };
      }));

      setQuotes(mappedQuotes);
      setQuotesError(warning);
    } catch (quoteLoadError) {
      console.error("Impossible de charger les devis administrateur.", quoteLoadError);
      setQuotes([]);
      setQuotesError(`Les devis sont indisponibles : ${formatSupabaseError(quoteLoadError)}`);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        name: categoryForm.nom.trim(),
        slug: slugify(categoryForm.nom),
        description: categoryForm.description,
        sort_order: Number(categoryForm.ordre || 0),
        category_type: categoryForm.type_categorie,
      };

      if (editingCategoryId) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editingCategoryId);
        if (error) throw error;
        setMessage("Catégorie modifiée avec succès.");
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
        setMessage("Catégorie créée avec succès.");
      }

      setCategoryForm(emptyCategoryForm);
      setEditingCategoryId(null);
      setShowCategoryModal(false);
      await loadAdminData();
    } catch (err) {
      console.error("Échec de l'enregistrement de la catégorie.", err);
      setError(err instanceof Error ? err.message : "L'enregistrement de la catégorie a échoué.");
    }
  };

  const handleSubCategorySubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        name: subCategoryForm.nom.trim(),
        slug: slugify(subCategoryForm.nom),
        category_id: subCategoryForm.categorie,
        sort_order: Number(subCategoryForm.ordre || 0),
      };

      if (editingSubCategoryId) {
        const { error } = await supabase.from("subcategories").update(payload).eq("id", editingSubCategoryId);
        if (error) throw error;
        setMessage("Sous-catégorie modifiée avec succès.");
      } else {
        const { error } = await supabase.from("subcategories").insert(payload);
        if (error) throw error;
        setMessage("Sous-catégorie créée avec succès.");
      }

      setSubCategoryForm(emptySubCategoryForm);
      setEditingSubCategoryId(null);
      setShowSubCategoryModal(false);
      await loadAdminData();
    } catch (err) {
      console.error("Échec de l'enregistrement de la sous-catégorie.", err);
      setError(err instanceof Error ? err.message : "L'enregistrement de la sous-catégorie a échoué.");
    }
  };

  const handleBookSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!bookForm.sous_categorie) {
      setError("Veuillez choisir une sous-catégorie.");
      return;
    }

    const id = editingBookId || crypto.randomUUID();
    const existingBook = books.find((book) => book.id === id);
    if (!bookForm.fichier && !existingBook?.pdf_path) {
      setError("Sélectionnez le fichier PDF du livre avant de l'enregistrer.");
      return;
    }
    if (
      bookForm.fichier &&
      (!bookForm.fichier.name.toLowerCase().endsWith(".pdf") ||
        (bookForm.fichier.type &&
          !["application/pdf", "application/octet-stream"].includes(bookForm.fichier.type)))
    ) {
      setError("Le fichier du livre doit être un document PDF valide.");
      return;
    }

    const uploaded = [];
    try {
      let coverPath = existingBook?.cover_path || "";
      let pdfPath = existingBook?.pdf_path || null;
      if (bookForm.couverture) {
        coverPath = await uploadAsset(
          "covers",
          `books/${id}/${crypto.randomUUID()}-${safeFileName(bookForm.couverture.name)}`,
          bookForm.couverture,
        );
        uploaded.push({ bucket: "covers", path: coverPath });
      }
      if (!coverPath) throw new Error("Une image de couverture est obligatoire.");
      if (bookForm.fichier) {
        pdfPath = await uploadAsset(
          "pdfs",
          `books/${id}/${crypto.randomUUID()}-${safeFileName(bookForm.fichier.name)}`,
          bookForm.fichier,
          "application/pdf",
        );
        uploaded.push({ bucket: "pdfs", path: pdfPath });
      }

      const payload = {
        title: bookForm.titre.trim(),
        slug: slugify(bookForm.titre),
        description: bookForm.description || "",
        subcategory_id: bookForm.sous_categorie,
        price: Number(bookForm.prix || 0),
        cover_path: coverPath,
        pdf_path: pdfPath,
        available: Boolean(bookForm.disponible),
        featured: Boolean(bookForm.mis_en_avant),
      };
      const result = editingBookId
        ? await supabase.from("books").update(payload).eq("id", id)
        : await supabase.from("books").insert({ id, ...payload });
      if (result.error) throw result.error;

      setMessage(bookForm.fichier ? `Livre enregistré. PDF téléversé : ${bookForm.fichier.name}` : "Livre enregistré avec succès.");
      setBookForm(emptyBookForm);
      setEditingBookId(null);
      setShowBookModal(false);
      await loadAdminData();
    } catch (err) {
      await cleanupUploadedAssets(uploaded);
      console.error("Échec de l'enregistrement du livre.", err);
      setError(formatSupabaseError(err));
    }
  };

  const allSubCategories = categories.flatMap((category) =>
    (category.sous_categories || []).map((sub) => ({
      ...sub,
      categorie_nom: category.nom,
    }))
  );
  const editingBook = books.find((book) => book.id === editingBookId);

  const getSubCategoryIdForBook = (book) => {
    const candidate = book.sous_categorie;
    if (!candidate) return "";
    const match = allSubCategories.find(
      (item) =>
        item.nom === candidate ||
        item.slug === candidate ||
        `${item.categorie_nom} — ${item.nom}` === candidate ||
        String(item.id) === String(candidate)
    );
    return match ? String(match.id) : "";
  };

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [activePurchase, setActivePurchase] = useState(null);

  // Quick Hôtellerie add form state
  const [quickHotelForm, setQuickHotelForm] = useState({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, images: [], video_url: "" });
  const [quickHotelError, setQuickHotelError] = useState("");
  const [quickHotelMessage, setQuickHotelMessage] = useState("");
  const [, setCreatingHotellerieCategory] = useState(false);

  // Quick Éloquence add form state (same form as Hôtellerie, no document/pdf)
  const [quickEloquenceForm, setQuickEloquenceForm] = useState({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, fichier: null, video: null });
  const [quickEloquenceError, setQuickEloquenceError] = useState("");
  const [quickEloquenceMessage, setQuickEloquenceMessage] = useState("");
  const [, setCreatingEloquenceCategory] = useState(false);

  // Service edit/delete state
  const [editingService, setEditingService] = useState(null); // service object being edited
  const [serviceEditForm, setServiceEditForm] = useState({ titre: '', description: '', prix: '0', sous_categorie: '', couverture: null, new_images: [], whatsapp_phone: '', disponible: true });
  const [serviceEditErrors, setServiceEditErrors] = useState({});
  const [serviceSaving, setServiceSaving] = useState(false);

  // Accessibility: focus first input when a modal opens and close on ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setSidebarOuverte(false);
        setShowCategoryModal(false);
        setShowSubCategoryModal(false);
        setShowBookModal(false);
        setShowPurchaseModal(false);
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const openModalSelector = showCategoryModal || showSubCategoryModal || showBookModal || showPurchaseModal || showDeleteModal || editingService;
    if (openModalSelector) {
      setTimeout(() => {
        const modal = document.querySelector('.admin-modal');
        if (modal) {
          const firstInput = modal.querySelector('input, textarea, select, button');
          if (firstInput) firstInput.focus();
        }
      }, 50);
    }
  }, [showCategoryModal, showSubCategoryModal, showBookModal, showPurchaseModal, showDeleteModal, editingService]);

  // Simple focus-trap for modal (handles Tab cycling)
  const handleModalKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const modal = e.currentTarget;
    const focusable = modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const startEditCategory = (category) => {
    setCategoryForm({
      nom: category.nom,
      description: category.description || "",
      ordre: String(category.ordre ?? 0),
      type_categorie: category.type_categorie || "livre",
    });
    setEditingCategoryId(category.id);
    setMessage("");
    setError("");
    setCategoryFormErrors({});
    setShowCategoryModal(true);
  };

  const startEditSubCategory = (subCategory) => {
    setSubCategoryForm({
      nom: subCategory.nom,
      categorie: String(subCategory.categorie || ""),
      ordre: String(subCategory.ordre ?? 0),
    });
    setEditingSubCategoryId(subCategory.id);
    setMessage("");
    setError("");
    setSubCategoryFormErrors({});
    setShowSubCategoryModal(true);
  };

  const startEditBook = (book) => {
    setBookForm({
      titre: book.titre,
      description: book.description || "",
      sous_categorie: getSubCategoryIdForBook(book),
      prix: String(book.prix ?? 0),
      disponible: Boolean(book.disponible),
      mis_en_avant: Boolean(book.mis_en_avant),
      couverture: null,
      fichier: null,
    });
    setEditingBookId(book.id);
    setMessage("");
    setError("");
    setBookFormErrors({});
    setShowBookModal(true);
  };

  // Start editing an existing service in the admin dashboard
  const startEditService = (svc) => {
    setEditingService(svc);
    setServiceEditErrors({});
    // try to find the numeric subcategory id from loaded categories
    const sousId = svc.sous_categorie || "";

    setServiceEditForm({
      titre: svc.titre || "",
      description: svc.description || "",
      prix: String(svc.prix || 0),
      sous_categorie: sousId,
      couverture: null,
      new_images: [],
      document: null,
      video: null,
      video_url: svc.video_url || "",
      whatsapp_phone: svc.whatsapp_phone || "",
      disponible: svc.disponible !== undefined ? Boolean(svc.disponible) : true,
    });
    setMessage("");
  };

  const submitServiceEdit = async (e) => {
    e.preventDefault();
    if (!editingService) return;
    setServiceSaving(true);
    setServiceEditErrors({});
    const uploaded = [];
    try {
      const id = editingService.id;
      let coverPath = editingService.cover_path;
      let documentPath = editingService.document_path || null;
      let videoPath = editingService.video_path || null;
      if (serviceEditForm.couverture) {
        coverPath = await uploadAsset(
          "covers",
          `services/${id}/${crypto.randomUUID()}-${safeFileName(serviceEditForm.couverture.name)}`,
          serviceEditForm.couverture,
        );
        uploaded.push({ bucket: "covers", path: coverPath });
      }
      if (!coverPath) throw new Error("Une image de couverture est obligatoire.");
      if (serviceEditForm.document) {
        documentPath = await uploadAsset(
          "pdfs",
          `services/${id}/${crypto.randomUUID()}-${safeFileName(serviceEditForm.document.name)}`,
          serviceEditForm.document,
          "application/pdf",
        );
        uploaded.push({ bucket: "pdfs", path: documentPath });
      }
      if (serviceEditForm.video) {
        videoPath = await uploadAsset(
          "media",
          `services/${id}/${crypto.randomUUID()}-${safeFileName(serviceEditForm.video.name)}`,
          serviceEditForm.video,
        );
        uploaded.push({ bucket: "media", path: videoPath });
      }

      const payload = {
        title: serviceEditForm.titre.trim(),
        slug: slugify(serviceEditForm.titre),
        description: serviceEditForm.description || "",
        subcategory_id: serviceEditForm.sous_categorie,
        price: Number(serviceEditForm.prix || 0),
        cover_path: coverPath,
        document_path: documentPath,
        video_path: videoPath,
        video_url: serviceEditForm.video_url || "",
        whatsapp_phone: serviceEditForm.whatsapp_phone || "",
        available: Boolean(serviceEditForm.disponible),
      };
      const { error: updateError } = await supabase.from("services").update(payload).eq("id", id);
      if (updateError) throw updateError;

      if (serviceEditForm.new_images?.length) {
        const imagePaths = await Promise.all(serviceEditForm.new_images.map(async (file) => {
          const path = `services/${id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
          await uploadAsset("covers", path, file);
          uploaded.push({ bucket: "covers", path });
          return path;
        }));
        const { error: imagesError } = await supabase.from("service_images").insert(
          imagePaths.map((image_path, index) => ({ service_id: id, image_path, sort_order: index })),
        );
        if (imagesError) throw imagesError;
      }

      setEditingService(null);
      setMessage('Service mis à jour.');
      await loadAdminData();
    } catch (err) {
      await cleanupUploadedAssets(uploaded);
      console.error("Échec de la mise à jour du service.", err);
      setError(formatSupabaseError(err));
    } finally {
      setServiceSaving(false);
    }
  };

  const handleDeleteService = async (svc) => {
    if (!svc || !svc.id) return;
    // Use the global confirmation modal flow: set the delete target and show the modal
    setDeleteTarget({ type: 'service', slug: svc.id, label: svc.titre || svc.slug });
    setShowDeleteModal(true);
    setError('');
  };

  // Create Hôtellerie category if missing
  const ensureHotellerieCategory = async () => {
    const exists = categories.find((c) => c.nom && c.nom.toLowerCase() === "hôtellerie" || c.nom && c.nom.toLowerCase() === "hotellerie");
    if (exists) return exists;
    setCreatingHotellerieCategory(true);
    try {
      const { data, error } = await supabase.from("categories").insert({
        name: "Hôtellerie",
        slug: "hotellerie",
        description: "Services liés à l'hôtellerie",
        sort_order: 0,
        category_type: "service",
      }).select("id, name, slug, description, category_type, sort_order, active").single();
      if (error) throw error;
      await loadAdminData();
      return mapCategory(data);
    } catch (err) {
      console.error("Impossible de créer la catégorie Hôtellerie.", err);
      setQuickHotelError(`Impossible de créer la catégorie Hôtellerie : ${formatSupabaseError(err)}`);
      return null;
    } finally {
      setCreatingHotellerieCategory(false);
    }
  };

  // Create Éloquence category if missing
  const ensureEloquenceCategory = async () => {
    const exists = categories.find((c) => (c.nom || "").toLowerCase() === "éloquence" || (c.nom || "").toLowerCase() === "eloquence");
    if (exists) return exists;
    setCreatingEloquenceCategory(true);
    try {
      const { data, error } = await supabase.from("categories").insert({
        name: "Éloquence",
        slug: "eloquence",
        description: "Services et formations en prise de parole",
        sort_order: 0,
        category_type: "service",
      }).select("id, name, slug, description, category_type, sort_order, active").single();
      if (error) throw error;
      await loadAdminData();
      return mapCategory(data);
    } catch (err) {
      console.error("Impossible de créer la catégorie Éloquence.", err);
      setQuickEloquenceError(`Impossible de créer la catégorie Éloquence : ${formatSupabaseError(err)}`);
      return null;
    } finally {
      setCreatingEloquenceCategory(false);
    }
  };

  const ensureGeneralSubcategory = async (category) => {
    const { data: existing, error: lookupError } = await supabase
      .from("subcategories")
      .select("id")
      .eq("category_id", category.id)
      .eq("name", "Général")
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("subcategories")
      .insert({ category_id: category.id, name: "Général", slug: "general", sort_order: 0 })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const createQuickService = async (form, category, { includeImages = false, pdfFile = null, videoFile = null } = {}) => {
    const id = crypto.randomUUID();
    const uploaded = [];
    let insertedServiceId = null;
    try {
      if (!form.couverture) throw new Error("Une image de couverture est obligatoire.");
      const coverPath = await uploadAsset(
        "covers",
        `services/${id}/${crypto.randomUUID()}-${safeFileName(form.couverture.name)}`,
        form.couverture,
      );
      uploaded.push({ bucket: "covers", path: coverPath });
      const subcategoryId = form.sous_categorie || await ensureGeneralSubcategory(category);

      let documentPath = null;
      let videoPath = null;
      if (pdfFile) {
        documentPath = await uploadAsset(
          "pdfs",
          `services/${id}/${crypto.randomUUID()}-${safeFileName(pdfFile.name)}`,
          pdfFile,
          "application/pdf",
        );
        uploaded.push({ bucket: "pdfs", path: documentPath });
      }
      if (videoFile) {
        videoPath = await uploadAsset(
          "media",
          `services/${id}/${crypto.randomUUID()}-${safeFileName(videoFile.name)}`,
          videoFile,
        );
        uploaded.push({ bucket: "media", path: videoPath });
      }

      const { data: service, error: insertError } = await supabase
        .from("services")
        .insert({
          id,
          title: form.titre.trim(),
          slug: slugify(form.titre),
          description: form.description || "",
          subcategory_id: subcategoryId,
          price: Number(form.prix || 0),
          cover_path: coverPath,
          document_path: documentPath,
          video_path: videoPath,
          video_url: form.video_url || "",
          available: true,
          whatsapp_phone: "",
        })
        .select("id, title, slug")
        .single();
      if (insertError) throw insertError;
      insertedServiceId = service.id;

      if (includeImages && form.images?.length) {
        const imagePaths = await Promise.all(form.images.map(async (file) => {
          const path = `services/${id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
          await uploadAsset("covers", path, file);
          uploaded.push({ bucket: "covers", path });
          return path;
        }));
        const { error: imagesError } = await supabase.from("service_images").insert(
          imagePaths.map((image_path, index) => ({ service_id: id, image_path, sort_order: index })),
        );
        if (imagesError) throw imagesError;
      }

      await loadAdminData();
      setLatestAddedService({
        id: service.id,
        titre: service.title,
        slug: service.slug,
        prix: form.prix,
        sous_categorie: allSubCategories.find((item) => item.id === subcategoryId)?.nom || "",
        couverture: getStoragePublicUrl("covers", coverPath),
        images: form.images || [],
      });
      return service;
    } catch (error) {
      if (insertedServiceId) {
        const { error: deleteError } = await supabase.from("services").delete().eq("id", insertedServiceId);
        if (deleteError) console.error("Impossible d'annuler la création partielle du service.", deleteError);
      }
      await cleanupUploadedAssets(uploaded);
      throw error;
    }
  };

  const submitQuickHotelItem = async (e) => {
    e.preventDefault();
    setQuickHotelError("");
    setQuickHotelMessage("");

    try {
      // Ensure category exists
      const category = (categories.find((c) => (c.nom || "").toLowerCase() === "hôtellerie" || (c.nom || "").toLowerCase() === "hotellerie") ) || await ensureHotellerieCategory();
      if (!category) {
        setQuickHotelError("La catégorie Hôtellerie est introuvable et n'a pas pu être créée.");
        return;
      }

      await createQuickService(quickHotelForm, category, { includeImages: true });
      setQuickHotelMessage("Élément d'hôtellerie ajouté avec succès.");
      setQuickHotelForm({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, images: [], video_url: "" });
    } catch (err) {
      console.error("Échec de l'ajout du service Hôtellerie.", err);
      setQuickHotelError(formatSupabaseError(err));
    }
  };

  const submitQuickEloquenceItem = async (e) => {
    e.preventDefault();
    setQuickEloquenceError("");
    setQuickEloquenceMessage("");

    try {
      // Ensure category exists
      const category = (categories.find((c) => (c.nom || "").toLowerCase() === "éloquence" || (c.nom || "").toLowerCase() === "eloquence") ) || await ensureEloquenceCategory();
      if (!category) {
        setQuickEloquenceError("La catégorie Éloquence est introuvable et n'a pas pu être créée.");
        return;
      }

      await createQuickService(quickEloquenceForm, category, {
        pdfFile: quickEloquenceForm.fichier,
        videoFile: quickEloquenceForm.video,
      });
      setQuickEloquenceMessage("Élément d'Éloquence ajouté avec succès.");
      setQuickEloquenceForm({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, fichier: null, video: null });
    } catch (err) {
      console.error("Échec de l'ajout du service Éloquence.", err);
      setQuickEloquenceError(formatSupabaseError(err));
    }
  };

  // Open a custom confirmation modal for deletion
  const handleDeleteCategory = async (id, label) => {
    setDeleteTarget({ type: 'category', slug: id, label: label || id });
    setShowDeleteModal(true);
    setError('');
  };

  const handleDeleteSubCategory = async (id, label) => {
    setDeleteTarget({ type: 'sub', slug: id, label: label || id });
    setShowDeleteModal(true);
    setError('');
  };

  const handleDeleteBook = async (id, label) => {
    setDeleteTarget({ type: 'book', slug: id, label: label || id });
    setShowDeleteModal(true);
    setError('');
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    const { type, slug } = deleteTarget;
    setShowDeleteModal(false);
    setDeletingSlug(slug);
    setError('');
    try {
      let result;
      if (type === "category") result = await supabase.from("categories").delete().eq("id", slug);
      else if (type === "sub") result = await supabase.from("subcategories").delete().eq("id", slug);
      else if (type === "book") result = await supabase.from("books").delete().eq("id", slug);
      else if (type === "service") result = await supabase.from("services").delete().eq("id", slug);
      else if (type === "quote") result = await supabase.from("quotes").delete().eq("id", slug);
      if (result?.error) throw result.error;
      setMessage("Élément supprimé.");
      setDeleteTarget(null);
      // if a quote was open, close it
      if (type === 'quote') { setSelectedQuote(null); setShowQuoteModal(false); }
      await loadAdminData();
    } catch (err) {
      console.error("Échec de la suppression.", err);
      setError(err instanceof Error ? err.message : "La suppression a échoué.");
    } finally {
      setDeletingSlug(null);
    }
  };


  const handleDeleteQuote = (id) => {
    // Find the full quote object to show details in the confirmation modal
    const q = quotes.find((x) => String(x.id) === String(id) || x.id === id) || null;

    // Try to compute an estimated total from items if available
    let computedTotal = null;
    try {
      if (q) {
        let items = q.items || [];
        if (typeof items === 'string' && items) items = JSON.parse(items);
        if (Array.isArray(items) && items.length) {
          computedTotal = items.reduce((acc, it) => {
            const prix = (it && (it.prix || it.price)) ? Number(it.prix || it.price) : 0;
            const qty = (it && (it.quantite || it.qty || it.quantity)) ? Number(it.quantite || it.qty || it.quantity) : 1;
            return acc + (qty * prix);
          }, 0);
        } else if (q.prix_estime) {
          computedTotal = Number(q.prix_estime);
        }
      }
    } catch {
      computedTotal = null;
    }

    setDeleteTarget({ type: 'quote', slug: id, label: `Devis #${id}`, quote: q, total: computedTotal });
    setShowDeleteModal(true);
  };

  const [purchaseAdminForm, setPurchaseAdminForm] = useState({ reference_transaction: "" });

  const openPurchaseModal = (achat) => {
    setActivePurchase(achat);
    setPurchaseAdminForm({ reference_transaction: achat.reference_transaction || "" });
    setShowPurchaseModal(true);
  };

  const handleApprovePurchase = async (id) => {
    try {
      const { data, error } = await supabase.rpc("admin_update_order", {
        requested_order_id: id,
        requested_status: "paye",
        requested_reference: purchaseAdminForm.reference_transaction || null,
      });
      if (error) throw error;
      if (!data) throw new Error("Cette commande a déjà été traitée.");
      setMessage('Achat approuvé.');
      setShowPurchaseModal(false);
      await loadAdminData();
    } catch (err) {
      console.error("Échec de l'approbation de la commande.", err);
      setError(err instanceof Error ? err.message : "Échec lors de l'approbation.");
    }
  };

  const handleRejectPurchase = async (id) => {
    try {
      const { data, error } = await supabase.rpc("admin_update_order", {
        requested_order_id: id,
        requested_status: "echoue",
        requested_reference: null,
      });
      if (error) throw error;
      if (!data) throw new Error("Cette commande a déjà été traitée.");
      setMessage('Achat marqué comme échoué.');
      setShowPurchaseModal(false);
      await loadAdminData();
    } catch (err) {
      console.error("Échec du rejet de la commande.", err);
      setError(err instanceof Error ? err.message : "Échec lors du rejet.");
    }
  };

    // Payment settings handlers
    const [paymentSettings, setPaymentSettings] = useState({ merchant_number: "656877046" });
    const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);

    const loadPaymentSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("payment_config")
          .select("id, merchant_number")
          .order("id")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) setPaymentSettings(data);
      } catch (e) {
        console.error("Impossible de charger la configuration de paiement.", e);
        setError("Impossible de charger les paramètres de paiement.");
      }
    };

    const savePaymentSettings = async () => {
      setPaymentSettingsSaving(true);
      try {
        const payload = {
          merchant_number: paymentSettings.merchant_number.trim(),
        };
        const result = paymentSettings.id
          ? await supabase.from("payment_config").update(payload).eq("id", paymentSettings.id)
          : await supabase.from("payment_config").insert(payload);
        if (result.error) throw result.error;
        setMessage('Paramètres de paiement mis à jour.');
      } catch (e) {
        console.error("Impossible d'enregistrer la configuration de paiement.", e);
        setError('Échec lors de la sauvegarde des paramètres de paiement.');
      } finally {
        setPaymentSettingsSaving(false);
      }
    };

    const saveProfile = async (event) => {
      event.preventDefault();
      setProfileSaving(true);
      setError("");
      setMessage("");
      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .update({
            first_name: profileForm.first_name.trim(),
            last_name: profileForm.last_name.trim(),
            telephone: profileForm.telephone.trim() || null,
          })
          .eq("id", user.id)
          .select("id, username, first_name, last_name, telephone, role")
          .single();
        if (profileError) throw profileError;
        acceptAuthenticatedProfile(session, data);
        setMessage("Votre profil a été mis à jour.");
      } catch (profileError) {
        console.error("Impossible d'enregistrer le profil administrateur.", profileError);
        setError(profileError instanceof Error ? profileError.message : "La mise à jour du profil a échoué.");
      } finally {
        setProfileSaving(false);
      }
    };

    useEffect(() => { loadPaymentSettings(); }, []);

  const currentSectionLabel = SIDEBAR_SECTIONS.find((s) => s.id === activeSection)?.label || "";

  return (
    <div className="admin-dashboard-layout">
      {/* ---------- BARRE LATÉRALE ---------- */}
      <aside className={`admin-sidebar ${sidebarOuverte ? "admin-sidebar-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-brand-mark">EDS</span>
          <span className="admin-sidebar-brand-text">EDS Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          {SIDEBAR_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`admin-sidebar-link ${activeSection === section.id ? "admin-sidebar-link-active" : ""}`}
              onClick={() => {
                setActiveSection(section.id);
                setSidebarOuverte(false);
              }}
            >
              <i className={section.icon} aria-hidden="true" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-user-pill">{user.full_name || user.username || user.email}</span>
          </div>
          <button type="button" className="btn-outline admin-sidebar-logout" onClick={() => { void signOut(); }}>
            Déconnexion
          </button>
        </div>
      </aside>
      {sidebarOuverte && (
        <button
          type="button"
          className="admin-sidebar-overlay"
          aria-label="Fermer le menu d'administration"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      {/* ---------- CONTENU PRINCIPAL ---------- */}
      <div className="admin-page">
        <div className="admin-shell">
          <header className="admin-header">
            <div className="admin-header-left">
              <button
                type="button"
                className="admin-mobile-menu-toggle"
                aria-label={sidebarOuverte ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={sidebarOuverte}
                onClick={() => setSidebarOuverte((ouverte) => !ouverte)}
              >
                <i className={`fa-solid ${sidebarOuverte ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" />
              </button>
              <div>
                <p className="eyebrow eyebrow-light">Administration</p>
                <h1>{currentSectionLabel}</h1>
              </div>
            </div>
          </header>

          {message && <div className="admin-alert admin-alert-success">{message}</div>}
          {error && <div className="admin-alert admin-alert-error">{error}</div>}

          {loading ? (
            <div className="admin-loading">Chargement du tableau de bord...</div>
          ) : (
            <>
              {/* ===================== VUE D'ENSEMBLE ===================== */}
              {activeSection === "overview" && (
                <>
                  <section className="admin-stats-grid">
                    <article className="admin-stat-card">
                      <span>Catégories</span>
                      <strong>{stats.total_categories}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span>Sous-catégories</span>
                      <strong>{stats.total_sous_categories}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span>Livres</span>
                      <strong>{stats.total_livres}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span>Achats</span>
                      <strong>{stats.total_achats}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span>Utilisateurs</span>
                      <strong>{stats.total_utilisateurs}</strong>
                    </article>
                  </section>

                  <section className="admin-lists">
                    <div className="admin-list-card admin-list-card-wide">
                      <h2>Achats récents</h2>
                      <ul>
                        {recentAchats.length === 0 ? (
                          <li>Aucun achat récent.</li>
                        ) : (
                          recentAchats.slice(0, 8).map((achat) => (
                            <li key={achat.id}>
                              <span>{achat.utilisateur__username} — {achat.livre__titre}</span>
                              <strong>{achat.statut}</strong>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="admin-list-card admin-list-card-wide">
                      <h2>Achats en attente de confirmation</h2>
                      <ul>
                        {purchases.filter(p => p.statut === 'en_attente').length === 0 ? (
                          <li>Aucun achat en attente.</li>
                        ) : (
                          purchases.filter(p => p.statut === 'en_attente').map((achat) => (
                            <li key={achat.id} className="admin-purchase-row" onClick={() => openPurchaseModal(achat)} style={{cursor:'pointer'}}>
                              <div className="admin-purchase-meta">
                                <span>{achat.utilisateur_username || "Utilisateur"} — {achat.livre_titre}</span>
                                <small>{achat.montant} FCFA • {achat.moyen_paiement}</small>
                              </div>
                              <div className="admin-purchase-actions">
                                <strong style={{textTransform:'uppercase', color:'#d97706'}}>{achat.statut}</strong>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </section>
                </>
              )}

              {/* ===================== CATÉGORIES ===================== */}
              {activeSection === "categories" && (
                <section className="admin-grid">
                  <form className="admin-card" onSubmit={handleCategorySubmit}>
                    <h2>{editingCategoryId ? "Modifier la catégorie" : "Ajouter une catégorie"}</h2>
                    <label>
                      Nom
                      <input
                        value={categoryForm.nom}
                        onChange={(e) => setCategoryForm({ ...categoryForm, nom: e.target.value })}
                        placeholder="Ex: Mécanique"
                        required
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        rows="3"
                        placeholder="Description de la catégorie"
                      />
                    </label>
                    <label>
                      Ordre d’affichage
                      <input
                        type="number"
                        min="0"
                        value={categoryForm.ordre}
                        onChange={(e) => setCategoryForm({ ...categoryForm, ordre: e.target.value })}
                      />
                    </label>
                    <label>
                      Type de catégorie
                      <select
                        value={categoryForm.type_categorie}
                        onChange={(e) => setCategoryForm({ ...categoryForm, type_categorie: e.target.value })}
                      >
                        <option value="livre">Livres (achat + lecture en ligne)</option>
                        <option value="service">Services (demande via WhatsApp)</option>
                      </select>
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" className="btn-primary">{editingCategoryId ? "Mettre à jour" : "Enregistrer"}</button>
                      {editingCategoryId && (
                        <button type="button" className="btn-outline" onClick={() => { setCategoryForm(emptyCategoryForm); setEditingCategoryId(null); }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="admin-list-card">
                    <h2>Catégories existantes</h2>
                    <ul>
                      {categories.map((category) => (
                        <li key={category.id}>
                          <span>{category.nom}</span>
                          <div className="admin-list-actions">
                            <button type="button" className="admin-mini-btn admin-mini-btn-edit" onClick={() => startEditCategory(category)}>Modifier</button>
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteCategory(category.id, category.nom)} disabled={deletingSlug === category.id}>{deletingSlug === category.id ? 'Suppression...' : 'Supprimer'}</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== SOUS-CATÉGORIES ===================== */}
              {activeSection === "subcategories" && (
                <section className="admin-grid">
                  <form className="admin-card" onSubmit={handleSubCategorySubmit}>
                    <h2>{editingSubCategoryId ? "Modifier la sous-catégorie" : "Ajouter une sous-catégorie"}</h2>
                    <label>
                      Catégorie
                      <select
                        value={subCategoryForm.categorie}
                        onChange={(e) => setSubCategoryForm({ ...subCategoryForm, categorie: e.target.value })}
                        required
                      >
                        <option value="">Choisir une catégorie</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.nom}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nom
                      <input
                        value={subCategoryForm.nom}
                        onChange={(e) => setSubCategoryForm({ ...subCategoryForm, nom: e.target.value })}
                        placeholder="Ex: 1ère année"
                        required
                      />
                    </label>
                    <label>
                      Ordre d’affichage
                      <input
                        type="number"
                        min="0"
                        value={subCategoryForm.ordre}
                        onChange={(e) => setSubCategoryForm({ ...subCategoryForm, ordre: e.target.value })}
                      />
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" className="btn-primary">{editingSubCategoryId ? "Mettre à jour" : "Enregistrer"}</button>
                      {editingSubCategoryId && (
                        <button type="button" className="btn-outline" onClick={() => { setSubCategoryForm(emptySubCategoryForm); setEditingSubCategoryId(null); }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="admin-list-card">
                    <h2>Sous-catégories existantes</h2>
                    <ul>
                      {allSubCategories.map((sub) => (
                        <li key={sub.id}>
                          <span>{sub.categorie_nom} / {sub.nom}</span>
                          <div className="admin-list-actions">
                            <button type="button" className="admin-mini-btn admin-mini-btn-edit" onClick={() => startEditSubCategory(sub)}>Modifier</button>
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteSubCategory(sub.id, sub.nom)} disabled={deletingSlug === sub.id}>{deletingSlug === sub.id ? 'Suppression...' : 'Supprimer'}</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== LIVRES ===================== */}
              {activeSection === "books" && (
                <section className="admin-grid">
                  <form className="admin-card admin-card-wide" onSubmit={handleBookSubmit}>
                    <h2>{editingBookId ? "Modifier le livre" : "Ajouter un livre"}</h2>
                    <div className="admin-book-form">
                      <label>
                        Titre
                        <input
                          value={bookForm.titre}
                          onChange={(e) => setBookForm({ ...bookForm, titre: e.target.value })}
                          placeholder="Ex: Calcul de structure"
                          required
                        />
                      </label>
                      <label>
                        Prix (FCFA)
                        <input
                          type="number"
                          min="0"
                          value={bookForm.prix}
                          onChange={(e) => setBookForm({ ...bookForm, prix: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Sous-catégorie
                        <select
                          value={bookForm.sous_categorie}
                          onChange={(e) => setBookForm({ ...bookForm, sous_categorie: e.target.value })}
                          required
                        >
                          <option value="">Choisir une sous-catégorie</option>
                          {allSubCategories.map((sub) => (
                            <option key={sub.id} value={sub.id}>{sub.categorie_nom} / {sub.nom}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={bookForm.disponible}
                          onChange={(e) => setBookForm({ ...bookForm, disponible: e.target.checked })}
                        />
                        Disponible
                      </label>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={bookForm.mis_en_avant}
                          onChange={(e) => setBookForm({ ...bookForm, mis_en_avant: e.target.checked })}
                        />
                        Mettre en avant
                      </label>
                      <label className="admin-full-row">
                        Description
                        <textarea
                          rows="4"
                          value={bookForm.description}
                          onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                          placeholder="Courte description du livre"
                        />
                      </label>
                      <label>
                        Couverture
                        <input
                          type="file"
                          accept="image/*"
                          required={!editingBook?.cover_path}
                          onChange={(e) => setBookForm({ ...bookForm, couverture: e.target.files?.[0] || null })}
                        />
                      </label>
                      <label>
                        Fichier du livre
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          required={!editingBook?.pdf_path}
                          onChange={(e) => setBookForm({ ...bookForm, fichier: e.target.files?.[0] || null })}
                        />
                        {bookForm.fichier && (
                          <small className="book-upload-selection">
                            Sélectionné : {bookForm.fichier.name} ({(bookForm.fichier.size / 1024 / 1024).toFixed(2)} Mo)
                          </small>
                        )}
                        <small>PDF du livre — pour corriger un ancien fichier, sélectionnez de nouveau le PDF original.</small>
                      </label>
                    </div>
                    <div className="admin-form-actions">
                      <button type="submit" className="btn-primary">{editingBookId ? "Mettre à jour" : "Ajouter le livre"}</button>
                      {editingBookId && (
                        <button type="button" className="btn-outline" onClick={() => { setBookForm(emptyBookForm); setEditingBookId(null); }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="admin-list-card admin-list-card-wide">
                    <h2>Livres existants</h2>
                    <ul>
                      {books.map((book) => (
                        <li key={book.id}>
                          <span>{book.titre}</span>
                          <div className="admin-list-actions">
                            <button type="button" className="admin-mini-btn admin-mini-btn-edit" onClick={() => startEditBook(book)}>Modifier</button>
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteBook(book.id, book.titre)} disabled={deletingSlug === book.id}>{deletingSlug === book.id ? 'Suppression...' : 'Supprimer'}</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== HÔTELLERIE (ajout rapide) ===================== */}
              {activeSection === "hotellerie" && (
                <section className="admin-grid">
                  <div className="admin-card">
                    <h2>Ajouter un élément — Hôtellerie</h2>
                    <p>Formulaire rapide pour ajouter un service dans la catégorie <strong>Hôtellerie</strong>. Si la catégorie n'existe pas, elle sera créée automatiquement.</p>
                    {quickHotelMessage && <div className="admin-alert admin-alert-success">{quickHotelMessage}</div>}
                    {quickHotelError && <div className="admin-alert admin-alert-error">{quickHotelError}</div>}
                    <form onSubmit={submitQuickHotelItem}>
                      <label>
                        Titre
                        <input value={quickHotelForm.titre} onChange={(e) => setQuickHotelForm({ ...quickHotelForm, titre: e.target.value })} placeholder="Ex: Chambre standard" required />
                      </label>
                      <label>
                        Prix (FCFA)
                        <input type="number" min="0" value={quickHotelForm.prix} onChange={(e) => setQuickHotelForm({ ...quickHotelForm, prix: e.target.value })} required />
                      </label>
                      <label>
                        Sous-catégorie (optionnel)
                        <select value={quickHotelForm.sous_categorie} onChange={(e) => setQuickHotelForm({ ...quickHotelForm, sous_categorie: e.target.value })}>
                          <option value="">— (Créer 'Général' si vide) —</option>
                          {(categories.find(c => (c.nom||"").toLowerCase()==='hôtellerie' || (c.nom||"").toLowerCase()==='hotellerie')?.sous_categories || []).map(s => (
                            <option key={s.id} value={s.id}>{s.nom}</option>
                          ))}
                        </select>
                      </label>
                                      <label className="admin-full-row">
                        Description
                        <textarea rows="3" value={quickHotelForm.description} onChange={(e) => setQuickHotelForm({ ...quickHotelForm, description: e.target.value })} />
                      </label>
                                      <label>
                                        Couverture (image principale)
                                        <input type="file" accept="image/*" onChange={(e) => setQuickHotelForm({ ...quickHotelForm, couverture: e.target.files?.[0] || null })} />
                                        <small className="muted">Image de couverture requise pour le service.</small>
                                      </label>
                                      <label>
                                        Images (galerie)
                                        <input type="file" accept="image/*" multiple onChange={(e) => setQuickHotelForm({ ...quickHotelForm, images: Array.from(e.target.files || []) })} />
                                        <small className="muted">Vous pouvez choisir plusieurs images. Elles seront ajoutées à la galerie du service.</small>
                                      </label>
                                      <label>
                                        URL vidéo (YouTube, Vimeo)
                                        <input type="url" placeholder="https://..." value={quickHotelForm.video_url} onChange={(e) => setQuickHotelForm({ ...quickHotelForm, video_url: e.target.value })} />
                                      </label>
                                      <div className="admin-form-actions">
                                        <button type="submit" className="btn-primary">Ajouter</button>
                                        <button type="button" className="btn-outline" onClick={() => { setQuickHotelForm({ titre: "", description: "", prix: "0", sous_categorie: "", images: [] }); setQuickHotelError(''); setQuickHotelMessage(''); }}>Réinitialiser</button>
                                      </div>
                    </form>
                  </div>

                  <div className="admin-list-card">
                    <h2>Ressources — Hôtellerie</h2>

                    {latestAddedService && (
                      <div className="admin-latest-card">
                        <strong>Dernier ajouté</strong>
                        <div className="admin-latest-row">
                          {latestAddedService.couverture && (
                            <img src={latestAddedService.couverture} alt={latestAddedService.titre} style={{width:80, height:60, objectFit:'cover', borderRadius:6, marginRight:10}} />
                          )}
                          <div>
                            <div style={{fontWeight:700}}>{latestAddedService.titre}</div>
                            <div style={{fontSize:'0.9rem', color:'#666'}}>{latestAddedService.sous_categorie || ''}</div>
                            <div style={{marginTop:6}}>{Number(latestAddedService.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                          </div>
                        </div>
                        {latestAddedService.images && latestAddedService.images.length > 0 && (
                          <div style={{marginTop:8}}>
                            <small>Images: {latestAddedService.images.length}</small>
                          </div>
                        )}
                      </div>
                    )}

                    <ul>
                      {services.length === 0 ? (
                        <li>Aucun élément trouvé pour l'instant.</li>
                      ) : (
                        services.map(svc => (
                          <li key={svc.id} style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between'}}>
                            <div style={{display:'flex', alignItems:'center', gap:10}}>
                              {svc.couverture && <img src={svc.couverture} alt={svc.titre} style={{width:56, height:44, objectFit:'cover', borderRadius:6}} />}
                              <div>
                                <div style={{fontWeight:700}}>{svc.titre}</div>
                                <div style={{fontSize:'0.85rem', color:'#666'}}>{svc.sous_categorie_nom || ''} • {Number(svc.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                              </div>
                            </div>

                            <div style={{display:'flex', gap:8}}>
                              <button className="btn-outline" onClick={() => startEditService(svc)}>Éditer</button>
                              <button className="btn-danger" onClick={() => handleDeleteService(svc)} disabled={deletingSlug === svc.id}>{deletingSlug === svc.id ? 'Suppression…' : 'Supprimer'}</button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== ÉLOQUENCE (ajout rapide) ===================== */}
              {activeSection === "eloquence" && (
                (() => {
                  // Determine subcategories that belong to Éloquence and filter services accordingly
                  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  const eloCat = categories.find((c) => normalize(c.nom) === normalize('eloquence') || String(c.slug || '').toLowerCase() === 'eloquence');
                  const eloSubIds = (eloCat?.sous_categories || []).map((s) => String(s.id));
                  // If eloCat not found, try to infer subcategories by matching category name on existing allSubCategories
                  const eloSubList = eloCat?.sous_categories && eloCat.sous_categories.length ? eloCat.sous_categories : allSubCategories.filter((s) => normalize(s.categorie_nom).includes(normalize('eloquence')));

                  const serviceMatchesEloquence = (svc) => {
                    if (!svc) return false;
                    const candidate = svc.sous_categorie;
                    if (!candidate) return false;
                    // The API returns sous_categorie as a formatted string like
                    // "Éloquence — Development personnel" (em dash), not an id or object.
                    if (typeof candidate === 'string') {
                      const catLabel = normalize(eloCat?.nom || 'eloquence');
                      if (normalize(candidate).includes(catLabel)) return true;
                    }
                    // Fallbacks for other possible shapes (numeric id, object, slug)
                    if (eloSubIds.includes(String(candidate))) return true;
                    return (eloSubList || []).some((s) => String(s.id) === String(candidate) || s.nom === candidate || s.slug === candidate || `${s.categorie_nom || eloCat?.nom || ''} — ${s.nom}` === candidate);
                  };

                  const eloquenceServices = (services || []).filter(serviceMatchesEloquence);
                  const eloquenceLatest = eloquenceServices.length ? eloquenceServices[0] : null;

                  return (
                    <section className="admin-grid">
                      <div className="admin-card">
                        <h2>Ajouter un élément — Éloquence</h2>
                        <p>Formulaire rapide pour ajouter un service dans la catégorie <strong>Éloquence</strong>.</p>
                        {quickEloquenceMessage && <div className="admin-alert admin-alert-success">{quickEloquenceMessage}</div>}
                        {quickEloquenceError && <div className="admin-alert admin-alert-error">{quickEloquenceError}</div>}
                        <form onSubmit={submitQuickEloquenceItem}>
                          <label>
                            Titre
                            <input value={quickEloquenceForm.titre} onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, titre: e.target.value })} placeholder="Ex: Coaching prise de parole" required />
                          </label>
                          <label>
                            Prix (FCFA)
                            <input type="number" min="0" value={quickEloquenceForm.prix} onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, prix: e.target.value })} required />
                          </label>
                          <label>
                            Sous-catégorie (optionnel)
                            <select value={quickEloquenceForm.sous_categorie} onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, sous_categorie: e.target.value })}>
                              <option value="">— (Créer 'Général' si vide) —</option>
                              {(eloSubList || []).map(s => (
                                <option key={s.id} value={s.id}>{s.nom}</option>
                              ))}
                            </select>
                          </label>

                          <label className="admin-full-row">
                            Description
                            <textarea rows="3" value={quickEloquenceForm.description} onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, description: e.target.value })} />
                          </label>
                          <label>
                            Couverture (image principale)
                            <input type="file" accept="image/*" onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, couverture: e.target.files?.[0] || null })} />
                            <small className="muted">Image de couverture requise pour le service.</small>
                          </label>
                          <label>
                            Fichier (PDF, DOCX)
                            <input type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, fichier: e.target.files?.[0] || null })} />
                            <small className="muted">Fichier principal (PDF/DOCX) pour l'élément d'Éloquence.</small>
                          </label>
                          <label>
                            Fichier vidéo (mp4, webm)
                            <input type="file" accept="video/*" onChange={(e) => setQuickEloquenceForm({ ...quickEloquenceForm, video: e.target.files?.[0] || null })} />
                            <small className="muted">Téléverser la vidéo principale pour l'élément d'Éloquence.</small>
                          </label>
                          <div className="admin-form-actions">
                            <button type="submit" className="btn-primary">Ajouter</button>
                            <button type="button" className="btn-outline" onClick={() => { setQuickEloquenceForm({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, fichier: null, video: null }); setQuickEloquenceError(''); setQuickEloquenceMessage(''); }}>Réinitialiser</button>
                          </div>
                        </form>
                      </div>

                      <div className="admin-list-card">
                        <h2>Ressources — Éloquence</h2>
                        {eloquenceLatest && (
                          <div className="admin-latest-card">
                            <strong>Dernier ajouté</strong>
                            <div className="admin-latest-row">
                              {eloquenceLatest.couverture && (
                                <img src={eloquenceLatest.couverture} alt={eloquenceLatest.titre} style={{width:80, height:60, objectFit:'cover', borderRadius:6, marginRight:10}} />
                              )}
                              <div>
                                <div style={{fontWeight:700}}>{eloquenceLatest.titre}</div>
                                <div style={{fontSize:'0.9rem', color:'#666'}}>{eloquenceLatest.sous_categorie || ''}</div>
                                <div style={{marginTop:6}}>{Number(eloquenceLatest.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                              </div>
                            </div>
                          </div>
                        )}

                        <ul>
                          {eloquenceServices.length === 0 ? (
                            <li>Aucun élément trouvé pour l'instant.</li>
                          ) : (
                            eloquenceServices.map(svc => (
                              <li key={svc.id} style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between'}}>
                                <div style={{display:'flex', alignItems:'center', gap:10}}>
                                  {svc.couverture && <img src={svc.couverture} alt={svc.titre} style={{width:56, height:44, objectFit:'cover', borderRadius:6}} />}
                                  <div>
                                    <div style={{fontWeight:700}}>{svc.titre}</div>
                                    <div style={{fontSize:'0.85rem', color:'#666'}}>{svc.sous_categorie_nom || ''} • {Number(svc.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                                  </div>
                                </div>

                                <div style={{display:'flex', gap:8}}>
                                  <button className="btn-outline" onClick={() => startEditService(svc)}>Éditer</button>
                                  <button className="btn-danger" onClick={() => handleDeleteService(svc)} disabled={deletingSlug === svc.id}>{deletingSlug === svc.id ? 'Suppression…' : 'Supprimer'}</button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </section>
                  );
                })()
              )}

              {/* ===================== UTILISATEURS ===================== */}
              {activeSection === "quotes" && (
                              <>
                              <section className="admin-list-card admin-list-card-wide">
                  <h2>Devis reçus</h2>
                  {quotesError && <div className="admin-alert admin-alert-error">{quotesError}</div>}
                  {quotes.length === 0 ? (
                    <div className="empty">{quotesError ? "Les devis n'ont pas pu être chargés." : "Aucun devis reçu."}</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{width:80}}>ID</th>
                            <th>Client</th>
                            <th>Téléphone</th>
                            <th>Date</th>
                            <th>Catégorie</th>
                            <th style={{width:120}}>Statut</th>
                            <th style={{width:120}}>PDF</th>
                            <th style={{width:140}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotes.map((q) => (
                            <tr key={q.id}>
                              <td>{q.id}</td>
                              <td style={{fontWeight:700}}>{q.client_name || '—'}</td>
                              <td>{q.client_phone || '—'}</td>
                              <td>{new Date(q.created_at).toLocaleString()}</td>
                              <td>{q.categorie ? q.categorie : '-'}</td>
                              <td>
                                {q.pdf_file ? (
                                  <span className="quote-status-badge quote-status-processed">Traité</span>
                                ) : (
                                  <span className="quote-status-badge quote-status-new">Nouveau</span>
                                )}
                              </td>
                              <td>
                                {q.pdf_file ? (
                                  <a href={q.pdf_file} target="_blank" rel="noreferrer" className="btn-pdf">PDF</a>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td>
                                <button type="button" className="admin-mini-btn" onClick={() => { setSelectedQuote(q); setShowQuoteModal(true); }}>Voir</button>
                                <button type="button" className="admin-mini-btn" style={{marginLeft:8}} onClick={() => handleDeleteQuote && handleDeleteQuote(q.id)}>Supprimer</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                    {showQuoteModal && selectedQuote && (
                      <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowQuoteModal(false); setSelectedQuote(null); } }}>
                        <div className="admin-modal admin-modal-wide" role="dialog" aria-modal="true">
                          <div className="admin-modal-header">
                            <h3>Devis — #{selectedQuote.id}</h3>
                          </div>
                          <div className="quote-details-grid">
                            <div>
                              <p style={{margin:0, fontWeight:700}}>{selectedQuote.client_name || 'Anonyme'}</p>
                              <p style={{margin:'6px 0 0', color:'#666'}}>{selectedQuote.client_phone} • {selectedQuote.client_email}</p>
                              <p style={{margin:'8px 0 0', color:'#666'}}>Reçu: {new Date(selectedQuote.created_at).toLocaleString()}</p>
                              {selectedQuote.event_date && <p style={{margin:'8px 0 0'}}>Date souhaitée: {selectedQuote.event_date}</p>}
                              {selectedQuote.address && <p style={{margin:'8px 0 0'}}>Lieu: {selectedQuote.address}</p>}
                              {selectedQuote.prix_estime && <p style={{margin:'8px 0 0', fontWeight:800}}>Prix estimé: {Number(selectedQuote.prix_estime).toLocaleString('fr-FR')} FCFA</p>}

                              <h4 style={{marginTop:12}}>Détails</h4>
                              <div style={{whiteSpace:'pre-wrap', background:'#fafafa', padding:10, borderRadius:8, border:'1px solid var(--line)'}}>
                                {/* items may be JSON array or free text */}
                                {(() => {
                                  try {
                                    const it = typeof selectedQuote.items === 'string' ? JSON.parse(selectedQuote.items) : selectedQuote.items || [];
                                    if (Array.isArray(it) && it.length) {
                                      return (
                                        <ul style={{paddingLeft:18, margin:0}}>
                                          {it.map((x, idx) => (
                                            <li key={idx}>{(x.titre || x.name || JSON.stringify(x))} {x.quantite ? ` x${x.quantite}` : ''} {x.prix ? ` — ${Number(x.prix).toLocaleString('fr-FR')} FCFA` : ''}</li>
                                          ))}
                                        </ul>
                                      );
                                    }
                                    // fallback to message / raw
                                    return <div>{selectedQuote.message || (selectedQuote.items && String(selectedQuote.items)) || '-'}</div>;
                                  } catch {
                                    return <div>{selectedQuote.message || selectedQuote.items || '-'}</div>;
                                  }
                                })()}
                              </div>

                            </div>

                            <div>
                              <h4>Images</h4>
                              <div className="quote-image-grid">
                                {(selectedQuote.images || []).length === 0 && <div className="empty">Aucune image attachée.</div>}
                                {(selectedQuote.images || []).map((im) => (
                                  <img key={im.id} src={im.image} alt="ref" onClick={() => window.open(im.image, '_blank')} />
                                ))}
                              </div>

                              <div style={{display:'flex', gap:8, marginTop:12}}>
                                {selectedQuote.pdf_file ? (<a href={selectedQuote.pdf_file} target="_blank" rel="noreferrer" className="btn-primary">Télécharger le PDF</a>) : null}
                                <button className="btn-outline" onClick={() => { setShowQuoteModal(false); setSelectedQuote(null); }}>Fermer</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>

              )}

              {activeSection === "users" && (
                <section className="admin-lists">
                  <div className="admin-list-card admin-list-card-wide">
                    <h2>Utilisateurs</h2>
                    <ul>
                      {users.map((userItem) => (
                        <li key={userItem.id}>
                          <span>{userItem.username}</span>
                          <strong>{userItem.role}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== ACHATS ===================== */}
              {activeSection === "purchases" && (
                <section className="admin-lists">
                  <div className="admin-list-card admin-list-card-wide">
                    <h2>Achats en attente de confirmation</h2>
                    <ul>
                      {purchases.filter(p => p.statut === 'en_attente').length === 0 ? (
                        <li>Aucun achat en attente.</li>
                      ) : (
                        purchases.filter(p => p.statut === 'en_attente').map((achat) => (
                          <li key={achat.id} className="admin-purchase-row" onClick={() => openPurchaseModal(achat)} style={{cursor:'pointer'}}>
                            <div className="admin-purchase-meta">
                              <span>{achat.utilisateur_username || "Utilisateur"} — {achat.livre_titre}</span>
                              <small>{achat.montant} FCFA • {achat.moyen_paiement}</small>
                            </div>
                            <div className="admin-purchase-actions">
                              <strong style={{textTransform:'uppercase', color:'#d97706'}}>{achat.statut}</strong>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="admin-list-card admin-list-card-wide">
                    <h2>Gestion des achats</h2>
                    <ul>
                      {purchases.slice(0, 12).map((achat) => (
                        <li key={achat.id} className="admin-purchase-row" onClick={() => openPurchaseModal(achat)} style={{cursor:'pointer'}}>
                          <div className="admin-purchase-meta">
                            <span>{achat.utilisateur_username || "Utilisateur"} — {achat.livre_titre}</span>
                            <small>{achat.montant} FCFA • {achat.moyen_paiement}</small>
                          </div>
                          <div className="admin-purchase-actions">
                            <strong style={{textTransform:'uppercase'}}>{achat.statut}</strong>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ===================== PARAMÈTRES PAIEMENT ===================== */}
              {activeSection === "payment" && (
                <section className="admin-grid">
                  <div className="admin-card">
                    <h2>Paramètres paiement</h2>
                    <div style={{display:'flex', flexDirection:'column', gap:8}}>
                      <label>
                        Numéro Orange Money pour les dépôts
                        <input type="tel" value={paymentSettings.merchant_number || ''} onChange={(e) => setPaymentSettings({ ...paymentSettings, merchant_number: e.target.value })} required />
                      </label>
                      <p>Les clients effectueront un dépôt du montant exact directement à ce numéro. Aucun code marchand ni code USSD ne sera affiché.</p>
                      <div style={{display:'flex', gap:8}}>
                        <button className="btn-primary" onClick={savePaymentSettings} disabled={paymentSettingsSaving}>{paymentSettingsSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "profile" && (
                <section className="admin-grid">
                  <form className="admin-card" onSubmit={saveProfile}>
                    <h2>Mon profil administrateur</h2>
                    <label>
                      Prénom
                      <input
                        value={profileForm.first_name}
                        onChange={(event) => setProfileForm({ ...profileForm, first_name: event.target.value })}
                        autoComplete="given-name"
                      />
                    </label>
                    <label>
                      Nom
                      <input
                        value={profileForm.last_name}
                        onChange={(event) => setProfileForm({ ...profileForm, last_name: event.target.value })}
                        autoComplete="family-name"
                      />
                    </label>
                    <label>
                      Téléphone
                      <input
                        type="tel"
                        value={profileForm.telephone}
                        onChange={(event) => setProfileForm({ ...profileForm, telephone: event.target.value })}
                        autoComplete="tel"
                      />
                    </label>
                    <label>
                      Adresse email
                      <input type="email" value={user.email || ""} readOnly />
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" className="btn-primary" disabled={profileSaving}>
                        {profileSaving ? "Enregistrement…" : "Enregistrer mon profil"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* ===================== MODALES (toujours montées) ===================== */}
              {showCategoryModal && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowCategoryModal(false); setEditingCategoryId(null); setCategoryForm(emptyCategoryForm); setCategoryFormErrors({}); } }}>
                  <div className="admin-modal" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>{editingCategoryId ? "Modifier la catégorie" : "Ajouter une catégorie"}</h3>
                    {error && <div className="admin-alert admin-alert-error">{error}</div>}
                    <form onSubmit={handleCategorySubmit}>
                      <label>
                        Nom
                        <input value={categoryForm.nom} onChange={(e) => setCategoryForm({ ...categoryForm, nom: e.target.value })} required />
                        {categoryFormErrors.nom && <div className="field-error">{Array.isArray(categoryFormErrors.nom) ? categoryFormErrors.nom.join(', ') : categoryFormErrors.nom}</div>}
                      </label>
                      <label>
                        Description
                        <textarea rows="3" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                        {categoryFormErrors.description && <div className="field-error">{Array.isArray(categoryFormErrors.description) ? categoryFormErrors.description.join(', ') : categoryFormErrors.description}</div>}
                      </label>
                      <label>
                        Ordre
                        <input type="number" min="0" value={categoryForm.ordre} onChange={(e) => setCategoryForm({ ...categoryForm, ordre: e.target.value })} />
                        {categoryFormErrors.ordre && <div className="field-error">{Array.isArray(categoryFormErrors.ordre) ? categoryFormErrors.ordre.join(', ') : categoryFormErrors.ordre}</div>}
                      </label>
                      <label>
                        Type de catégorie
                        <select value={categoryForm.type_categorie} onChange={(e) => setCategoryForm({ ...categoryForm, type_categorie: e.target.value })}>
                          <option value="livre">Livres (achat + lecture en ligne)</option>
                          <option value="service">Services (demande via WhatsApp)</option>
                        </select>
                      </label>
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-primary">{editingCategoryId ? "Mettre à jour" : "Enregistrer"}</button>
                        <button type="button" className="btn-outline" onClick={() => { setShowCategoryModal(false); setEditingCategoryId(null); setCategoryForm(emptyCategoryForm); setCategoryFormErrors({}); }}>Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showSubCategoryModal && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowSubCategoryModal(false); setEditingSubCategoryId(null); setSubCategoryForm(emptySubCategoryForm); setSubCategoryFormErrors({}); } }}>
                  <div className="admin-modal" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>{editingSubCategoryId ? "Modifier la sous-catégorie" : "Ajouter une sous-catégorie"}</h3>
                    {error && <div className="admin-alert admin-alert-error">{error}</div>}
                    <form onSubmit={handleSubCategorySubmit}>
                      <label>
                        Catégorie
                        <select value={subCategoryForm.categorie} onChange={(e) => setSubCategoryForm({ ...subCategoryForm, categorie: e.target.value })} required>
                          <option value="">Choisir une catégorie</option>
                          {categories.map((c) => (<option key={c.id} value={c.id}>{c.nom}</option>))}
                        </select>
                        {subCategoryFormErrors.categorie && <div className="field-error">{Array.isArray(subCategoryFormErrors.categorie) ? subCategoryFormErrors.categorie.join(', ') : subCategoryFormErrors.categorie}</div>}
                      </label>
                      <label>
                        Nom
                        <input value={subCategoryForm.nom} onChange={(e) => setSubCategoryForm({ ...subCategoryForm, nom: e.target.value })} required />
                        {subCategoryFormErrors.nom && <div className="field-error">{Array.isArray(subCategoryFormErrors.nom) ? subCategoryFormErrors.nom.join(', ') : subCategoryFormErrors.nom}</div>}
                      </label>
                      <label>
                        Ordre
                        <input type="number" min="0" value={subCategoryForm.ordre} onChange={(e) => setSubCategoryForm({ ...subCategoryForm, ordre: e.target.value })} />
                        {subCategoryFormErrors.ordre && <div className="field-error">{Array.isArray(subCategoryFormErrors.ordre) ? subCategoryFormErrors.ordre.join(', ') : subCategoryFormErrors.ordre}</div>}
                      </label>
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-primary">{editingSubCategoryId ? "Mettre à jour" : "Enregistrer"}</button>
                        <button type="button" className="btn-outline" onClick={() => { setShowSubCategoryModal(false); setEditingSubCategoryId(null); setSubCategoryForm(emptySubCategoryForm); setSubCategoryFormErrors({}); }}>Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showBookModal && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowBookModal(false); setEditingBookId(null); setBookForm(emptyBookForm); setBookFormErrors({}); } }}>
                  <div className="admin-modal admin-modal-wide" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>{editingBookId ? "Modifier le livre" : "Ajouter un livre"}</h3>
                    {error && <div className="admin-alert admin-alert-error">{error}</div>}
                    <form onSubmit={handleBookSubmit}>
                      <label>
                        Titre
                        <input value={bookForm.titre} onChange={(e) => setBookForm({ ...bookForm, titre: e.target.value })} required />
                        {bookFormErrors.titre && <div className="field-error">{Array.isArray(bookFormErrors.titre) ? bookFormErrors.titre.join(', ') : bookFormErrors.titre}</div>}
                      </label>
                      <label>
                        Prix (FCFA)
                        <input type="number" min="0" value={bookForm.prix} onChange={(e) => setBookForm({ ...bookForm, prix: e.target.value })} required />
                        {bookFormErrors.prix && <div className="field-error">{Array.isArray(bookFormErrors.prix) ? bookFormErrors.prix.join(', ') : bookFormErrors.prix}</div>}
                      </label>
                      <label>
                        Sous-catégorie
                        <select value={bookForm.sous_categorie} onChange={(e) => setBookForm({ ...bookForm, sous_categorie: e.target.value })} required>
                          <option value="">Choisir une sous-catégorie</option>
                          {allSubCategories.map((sub) => (<option key={sub.id} value={sub.id}>{sub.categorie_nom} / {sub.nom}</option>))}
                        </select>
                        {bookFormErrors.sous_categorie && <div className="field-error">{Array.isArray(bookFormErrors.sous_categorie) ? bookFormErrors.sous_categorie.join(', ') : bookFormErrors.sous_categorie}</div>}
                      </label>
                      <label>
                        Disponible
                        <input type="checkbox" checked={bookForm.disponible} onChange={(e) => setBookForm({ ...bookForm, disponible: e.target.checked })} />
                      </label>
                      <label>
                        Mettre en avant
                        <input type="checkbox" checked={bookForm.mis_en_avant} onChange={(e) => setBookForm({ ...bookForm, mis_en_avant: e.target.checked })} />
                      </label>
                      <label className="admin-full-row">
                        Description
                        <textarea rows="4" value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} />
                        {bookFormErrors.description && <div className="field-error">{Array.isArray(bookFormErrors.description) ? bookFormErrors.description.join(', ') : bookFormErrors.description}</div>}
                      </label>
                      <label>
                        Couverture
                        <input type="file" accept="image/*" required={!editingBook?.cover_path} onChange={(e) => setBookForm({ ...bookForm, couverture: e.target.files?.[0] || null })} />
                        {bookFormErrors.couverture && <div className="field-error">{Array.isArray(bookFormErrors.couverture) ? bookFormErrors.couverture.join(', ') : bookFormErrors.couverture}</div>}
                      </label>
                      <label>
                        Fichier du livre
                        <input type="file" accept="application/pdf,.pdf" required={!editingBook?.pdf_path} onChange={(e) => setBookForm({ ...bookForm, fichier: e.target.files?.[0] || null })} />
                        {bookForm.fichier && (
                          <small className="book-upload-selection">
                            Sélectionné : {bookForm.fichier.name} ({(bookForm.fichier.size / 1024 / 1024).toFixed(2)} Mo)
                          </small>
                        )}
                        <small>PDF du livre — pour corriger un ancien fichier, sélectionnez de nouveau le PDF original.</small>
                        {bookFormErrors.fichier && <div className="field-error">{Array.isArray(bookFormErrors.fichier) ? bookFormErrors.fichier.join(', ') : bookFormErrors.fichier}</div>}
                      </label>
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-primary">{editingBookId ? "Mettre à jour" : "Ajouter le livre"}</button>
                        <button type="button" className="btn-outline" onClick={() => { setShowBookModal(false); setEditingBookId(null); setBookForm(emptyBookForm); setBookFormErrors({}); }}>Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {editingService && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setEditingService(null); setServiceEditErrors({}); } }}>
                  <div className="admin-modal admin-modal-wide" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>Éditer le service — {editingService.titre}</h3>
                    {serviceEditErrors && Object.keys(serviceEditErrors).length > 0 && <div className="admin-alert admin-alert-error">{JSON.stringify(serviceEditErrors)}</div>}
                    <form onSubmit={submitServiceEdit}>
                      <label>
                        Titre
                        <input value={serviceEditForm.titre} onChange={(e) => setServiceEditForm({ ...serviceEditForm, titre: e.target.value })} required />
                      </label>

                      <label>
                        Sous-catégorie
                        <select value={serviceEditForm.sous_categorie} onChange={(e) => setServiceEditForm({ ...serviceEditForm, sous_categorie: e.target.value })} required>
                          <option value="">— Choisir —</option>
                          {categories.flatMap(c => (c.sous_categories || []).map(s => ({...s, categorie_nom: c.nom}))).map(sc => (
                            <option key={sc.id} value={sc.id}>{sc.categorie_nom} / {sc.nom}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Prix (FCFA)
                        <input type="number" value={serviceEditForm.prix} onChange={(e) => setServiceEditForm({ ...serviceEditForm, prix: e.target.value })} />
                      </label>

                      <label>
                        WhatsApp
                        <input value={serviceEditForm.whatsapp_phone} onChange={(e) => setServiceEditForm({ ...serviceEditForm, whatsapp_phone: e.target.value })} placeholder="2376..." />
                      </label>

                      <label className="admin-full-row">
                        Description
                        <textarea rows="3" value={serviceEditForm.description} onChange={(e) => setServiceEditForm({ ...serviceEditForm, description: e.target.value })} />
                      </label>

                      <label>
                        Remplacer la couverture
                        <input type="file" accept="image/*" onChange={(e) => setServiceEditForm({ ...serviceEditForm, couverture: e.target.files?.[0] || null })} />
                      </label>

                      <label>
                        Remplacer le document (PDF, DOCX)
                        <input
                          type="file"
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => setServiceEditForm({ ...serviceEditForm, document: e.target.files?.[0] || null })}
                        />
                        <small className="muted">Laisser vide pour conserver le document actuel.</small>
                      </label>

                      <label>
                        Remplacer la vidéo (mp4, webm)
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => setServiceEditForm({ ...serviceEditForm, video: e.target.files?.[0] || null })}
                        />
                        <small className="muted">Laisser vide pour conserver la vidéo actuelle.</small>
                      </label>

                      <label>
                        Ou URL vidéo (YouTube, Vimeo)
                        <input
                          type="url"
                          placeholder="https://..."
                          value={serviceEditForm.video_url}
                          onChange={(e) => setServiceEditForm({ ...serviceEditForm, video_url: e.target.value })}
                        />
                      </label>

                      <label>
                        Ajouter des images à la galerie
                        <input type="file" accept="image/*" multiple onChange={(e) => setServiceEditForm({ ...serviceEditForm, new_images: Array.from(e.target.files || []) })} />
                      </label>

                      <div className="admin-form-actions">
                        <button type="submit" className="btn-primary">{serviceSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                        <button type="button" className="btn-outline" onClick={() => { setEditingService(null); setServiceEditErrors({}); }}>Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showDeleteModal && deleteTarget && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowDeleteModal(false); setDeleteTarget(null); } }}>
                  <div className="admin-modal" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>Confirmer la suppression</h3>
                    {deleteTarget.type === 'quote' && deleteTarget.quote ? (
                      <>
                        <div style={{marginBottom:8}}>
                          <strong>{deleteTarget.label}</strong>
                        </div>
                        <div style={{marginBottom:8}}>
                          <div><strong>Client :</strong> {deleteTarget.quote.client_name || '—'}</div>
                          <div><strong>Téléphone :</strong> {deleteTarget.quote.client_phone || '—'}</div>
                          <div><strong>Reçu :</strong> {deleteTarget.quote.created_at ? new Date(deleteTarget.quote.created_at).toLocaleString() : '—'}</div>
                          {deleteTarget.total != null ? (
                            <div style={{marginTop:6, fontWeight:800}}>Total estimé : {Number(deleteTarget.total).toLocaleString('fr-FR')} FCFA</div>
                          ) : (deleteTarget.quote.prix_estime ? (
                            <div style={{marginTop:6, fontWeight:800}}>Prix estimé : {Number(deleteTarget.quote.prix_estime).toLocaleString('fr-FR')} FCFA</div>
                          ) : null)}
                        </div>

                        <div style={{background:'#fafafa', padding:10, borderRadius:8, border:'1px solid var(--line)', maxHeight:180, overflow:'auto'}}>
                          <strong>Détails :</strong>
                          <div style={{marginTop:6}}>
                            {(() => {
                              try {
                                const it = typeof deleteTarget.quote.items === 'string' ? JSON.parse(deleteTarget.quote.items) : (deleteTarget.quote.items || []);
                                if (Array.isArray(it) && it.length) {
                                  return (
                                    <ul style={{paddingLeft:18, margin:0}}>
                                      {it.map((x, idx) => (
                                        <li key={idx}>{(x.titre || x.name || JSON.stringify(x))} {x.quantite ? ` x${x.quantite}` : ''} {x.prix ? ` — ${Number(x.prix).toLocaleString('fr-FR')} FCFA` : ''}</li>
                                      ))}
                                    </ul>
                                  );
                                }
                                return <div>{deleteTarget.quote.message || (deleteTarget.quote.items && String(deleteTarget.quote.items)) || '-'}</div>;
                              } catch {
                                return <div>{deleteTarget.quote.message || deleteTarget.quote.items || '-'}</div>;
                              }
                            })()}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p>Veux-tu vraiment supprimer "{deleteTarget.label}" ? Cette action est irréversible.</p>
                    )}
                    <div className="admin-form-actions" style={{marginTop:12}}>
                      <button type="button" className="btn-outline" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>Annuler</button>
                      <button type="button" className="btn-primary" onClick={performDelete} disabled={!!deletingSlug}>{deletingSlug ? 'Suppression...' : 'Supprimer'}</button>
                    </div>
                  </div>
                </div>
              )}

              {showPurchaseModal && activePurchase && (
                <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowPurchaseModal(false); setActivePurchase(null); setPurchaseAdminForm({ reference_transaction: "", note: "" }); } }}>
                  <div className="admin-modal" onKeyDown={handleModalKeyDown} role="dialog" aria-modal="true">
                    <h3>Détails de l'achat</h3>
                    <div style={{marginBottom:8}}>
                      <strong>Client :</strong> {activePurchase.utilisateur_username || activePurchase.utilisateur || 'Utilisateur'}
                    </div>
                    <div style={{marginBottom:8}}>
                      <strong>Livre :</strong> {activePurchase.livre_titre}
                    </div>
                    <div style={{marginBottom:8}}>
                      <strong>Montant :</strong> {activePurchase.montant} FCFA
                    </div>
                    <div style={{marginBottom:8}}>
                      <strong>Moyen :</strong> {activePurchase.moyen_paiement}
                    </div>

                    <label>
                      Référence transaction (optionnel)
                      <input value={purchaseAdminForm.reference_transaction} onChange={(e) => setPurchaseAdminForm({ ...purchaseAdminForm, reference_transaction: e.target.value })} />
                    </label>

                    <div className="admin-form-actions">
                      <button type="button" className="btn-primary" onClick={() => handleApprovePurchase(activePurchase.id)}>Approuver</button>
                      <button type="button" className="btn-outline" onClick={() => handleRejectPurchase(activePurchase.id)}>Rejeter</button>
                      <button type="button" className="btn-outline" onClick={() => { setShowPurchaseModal(false); setActivePurchase(null); setPurchaseAdminForm({ reference_transaction: "" }); }}>Fermer</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}