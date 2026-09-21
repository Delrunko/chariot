import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api, { adminService, catalogService, purchaseService, serviceService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./AdminDashboard.css";

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
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
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
  const [purchaseFormErrors, setPurchaseFormErrors] = useState({});

  const loadAdminData = async () => {
    try {
      const [dashboardRes, categoriesRes, booksRes, servicesRes, usersRes, purchasesRes, quotesRes] = await Promise.all([
        adminService.dashboard(),
        catalogService.getCategories(),
        catalogService.getBooks(),
        serviceService.getServices(),
        adminService.users(),
        purchaseService.adminPurchases(),
        api.get('/quotes/'),
      ]);

      setStats(dashboardRes.data.stats || {});
      setRecentAchats(dashboardRes.data.recent_achats || []);
      setCategories(categoriesRes.data || []);
      setBooks(booksRes.data || []);
      setServices(servicesRes.data || []);
      setUsers(usersRes.data || []);
      setPurchases(purchasesRes.data || []);
      setQuotes(quotesRes.data || []);
    } catch (err) {
      setError("Impossible de charger le tableau de bord administrateur.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  if (!user || user.role !== "admin") {
    return <Navigate to="/connexion" replace />;
  }

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        nom: categoryForm.nom,
        description: categoryForm.description,
        ordre: Number(categoryForm.ordre || 0),
        type_categorie: categoryForm.type_categorie,
      };

      if (editingCategoryId) {
        await api.patch(`/categories/${editingCategoryId}/`, payload);
        setMessage("Catégorie modifiée avec succès.");
      } else {
        await api.post("/categories/", payload);
        setMessage("Catégorie créée avec succès.");
      }

      setCategoryForm(emptyCategoryForm);
      setEditingCategoryId(null);
      setShowCategoryModal(false);
      await loadAdminData();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setCategoryFormErrors(data);
        const flat = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setError(flat);
      } else {
        const msg = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : (editingCategoryId ? "La modification de la catégorie a échoué." : "La création de la catégorie a échoué.");
        setError(msg);
      }
    }
  };

  const handleSubCategorySubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        nom: subCategoryForm.nom,
        categorie: Number(subCategoryForm.categorie),
        ordre: Number(subCategoryForm.ordre || 0),
      };

      if (editingSubCategoryId) {
        await api.patch(`/sous-categories/${editingSubCategoryId}/`, payload);
        setMessage("Sous-catégorie modifiée avec succès.");
      } else {
        await api.post("/sous-categories/", payload);
        setMessage("Sous-catégorie créée avec succès.");
      }

      setSubCategoryForm(emptySubCategoryForm);
      setEditingSubCategoryId(null);
      setShowSubCategoryModal(false);
      await loadAdminData();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setSubCategoryFormErrors(data);
        const flat = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setError(flat);
      } else {
        const msg = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : (editingSubCategoryId ? "La modification de la sous-catégorie a échoué." : "La création de la sous-catégorie a échoué.");
        setError(msg);
      }
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

    try {
      const formData = new FormData();
      formData.append("titre", bookForm.titre);
      formData.append("description", bookForm.description || "");
      formData.append("sous_categorie", String(bookForm.sous_categorie));
      formData.append("prix", String(Number(bookForm.prix || 0)));
      formData.append("disponible", String(bookForm.disponible));
      formData.append("mis_en_avant", String(bookForm.mis_en_avant));

      if (bookForm.couverture) {
        formData.append("couverture", bookForm.couverture);
      }
      if (bookForm.fichier) {
        formData.append("fichier", bookForm.fichier);
      }

      if (editingBookId) {
        await api.patch(`/books/${editingBookId}/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Livre modifié avec succès.");
      } else {
        await api.post("/books/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Livre ajouté avec succès.");
      }

      setBookForm(emptyBookForm);
      setEditingBookId(null);
      setShowBookModal(false);
      await loadAdminData();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setBookFormErrors(data);
        const flat = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setError(flat);
      } else {
        const msg = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : (editingBookId ? "La modification du livre a échoué." : "L’ajout du livre a échoué. Vérifiez les fichiers et les champs requis.");
        setError(msg);
      }
    }
  };

  const allSubCategories = categories.flatMap((category) =>
    (category.sous_categories || []).map((sub) => ({
      ...sub,
      categorie_nom: category.nom,
    }))
  );

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
  const [creatingHotellerieCategory, setCreatingHotellerieCategory] = useState(false);

  // Quick Éloquence add form state (same form as Hôtellerie, no document/pdf)
  const [quickEloquenceForm, setQuickEloquenceForm] = useState({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, fichier: null, video: null });
  const [quickEloquenceError, setQuickEloquenceError] = useState("");
  const [quickEloquenceMessage, setQuickEloquenceMessage] = useState("");
  const [creatingEloquenceCategory, setCreatingEloquenceCategory] = useState(false);

  // Service edit/delete state
  const [editingService, setEditingService] = useState(null); // service object being edited
  const [serviceEditForm, setServiceEditForm] = useState({ titre: '', description: '', prix: '0', sous_categorie: '', couverture: null, new_images: [], whatsapp_phone: '', disponible: true });
  const [serviceEditErrors, setServiceEditErrors] = useState({});
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceDeleting, setServiceDeleting] = useState(null);

  // Accessibility: focus first input when a modal opens and close on ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
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
    setEditingCategoryId(category.slug);
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
    setEditingSubCategoryId(subCategory.slug);
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
    setEditingBookId(book.slug);
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
    let sousId = '';
    try {
      const candidate = allSubCategories.find((it) => {
        return String(it.id) === String(svc.sous_categorie) || it.nom === svc.sous_categorie || `${it.categorie_nom} — ${it.nom}` === svc.sous_categorie;
      });
      if (candidate) sousId = String(candidate.id);
    } catch (e) {
      sousId = String(svc.sous_categorie || '');
    }

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
    e && e.preventDefault();
    if (!editingService) return;
    setServiceSaving(true);
    setServiceEditErrors({});
    try {
      const formData = new FormData();
      formData.append('titre', serviceEditForm.titre);
      formData.append('description', serviceEditForm.description || '');
      formData.append('prix', String(Number(serviceEditForm.prix || 0)));
      formData.append('sous_categorie', String(serviceEditForm.sous_categorie));
      formData.append('disponible', String(!!serviceEditForm.disponible));
      formData.append('whatsapp_phone', serviceEditForm.whatsapp_phone || '');
      if (serviceEditForm.couverture) formData.append('couverture', serviceEditForm.couverture);
      if (serviceEditForm.document) formData.append('document', serviceEditForm.document);
      if (serviceEditForm.video) formData.append('video', serviceEditForm.video);
      if (serviceEditForm.video_url) formData.append('video_url', serviceEditForm.video_url);

      // Update service (PATCH) - backend accepts multipart
      const { data: updated } = await serviceService.updateService(editingService.slug, formData);

      // If new images were selected, upload them to the images action
      if (serviceEditForm.new_images && serviceEditForm.new_images.length > 0) {
        const imagesForm = new FormData();
        serviceEditForm.new_images.forEach((f) => imagesForm.append('images', f));
        await serviceService.uploadImages(updated.slug || updated.id, imagesForm);
      }

      // Optimistically update local state
      setServices((prev) => (prev || []).map((s) => (s.id === updated.id || s.slug === updated.slug ? updated : s)));
      setEditingService(null);
      setMessage('Service mis à jour.');
      // Refresh admin data in background
      loadAdminData().catch(() => {});
    } catch (err) {
      const resp = err?.response;
      if (resp) {
        setServiceEditErrors(resp.data || {});
        const parts = [];
        const data = resp.data;
        if (data && typeof data === 'object') {
          if (data.detail) parts.push(String(data.detail));
          for (const [k, v] of Object.entries(data)) {
            if (k === 'detail') continue;
            const val = Array.isArray(v) ? v.join(' ') : String(v);
            parts.push(`${k}: ${val}`);
          }
          setServiceEditErrors(data);
          setError(`Erreur ${resp.status}: ${parts.join(' | ')}`);
        } else {
          setError(`Erreur ${resp.status}: ${String(data)}`);
        }
      } else {
        setError(err?.message || 'La mise à jour a échoué.');
      }
    } finally {
      setServiceSaving(false);
    }
  };

  const handleDeleteService = async (svc) => {
    if (!svc || !svc.slug) return;
    // Use the global confirmation modal flow: set the delete target and show the modal
    setDeleteTarget({ type: 'service', slug: svc.slug, label: svc.titre || svc.slug });
    setShowDeleteModal(true);
    setError('');
  };

  // Create Hôtellerie category if missing
  const ensureHotellerieCategory = async () => {
    const exists = categories.find((c) => c.nom && c.nom.toLowerCase() === "hôtellerie" || c.nom && c.nom.toLowerCase() === "hotellerie");
    if (exists) return exists;
    setCreatingHotellerieCategory(true);
    try {
      const payload = { nom: "Hôtellerie", description: "Services liés à l'hôtellerie", ordre: 0, type_categorie: "service" };
      const res = await api.post("/categories/", payload);
      await loadAdminData();
      return res.data;
    } catch (err) {
      setQuickHotelError("Impossible de créer la catégorie Hôtellerie.");
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
      const payload = { nom: "Éloquence", description: "Services et formations en prise de parole", ordre: 0, type_categorie: "service" };
      const res = await api.post("/categories/", payload);
      await loadAdminData();
      return res.data;
    } catch (err) {
      setQuickEloquenceError("Impossible de créer la catégorie Éloquence.");
      return null;
    } finally {
      setCreatingEloquenceCategory(false);
    }
  };

  const submitQuickHotelItem = async (e) => {
    e && e.preventDefault();
    setQuickHotelError("");
    setQuickHotelMessage("");

    try {
      // Ensure category exists
      const category = (categories.find((c) => (c.nom || "").toLowerCase() === "hôtellerie" || (c.nom || "").toLowerCase() === "hotellerie") ) || await ensureHotellerieCategory();
      if (!category) {
        setQuickHotelError("La catégorie Hôtellerie est introuvable et n'a pas pu être créée.");
        return;
      }

      // If no subcategory selected, create a default one (Ex: Général)
      let sousId = quickHotelForm.sous_categorie;
      if (!sousId) {
        const defaultName = "Général";
        // try to find sous-categorie
        const existingSub = (category.sous_categories || []).find((s) => (s.nom || "").toLowerCase() === defaultName.toLowerCase());
        if (existingSub) sousId = existingSub.id;
        else {
          const subRes = await api.post("/sous-categories/", { nom: defaultName, categorie: category.id, ordre: 0 });
          sousId = subRes.data.id;
          await loadAdminData();
        }
      }

      // Create the service (no document/pdf for Hôtellerie)
      const formData = new FormData();
      formData.append("titre", quickHotelForm.titre);
      formData.append("description", quickHotelForm.description || "");
      formData.append("sous_categorie", String(sousId));
      formData.append("prix", String(Number(quickHotelForm.prix || 0)));
      formData.append("disponible", "true");
      formData.append("mis_en_avant", "false");

      // couverture
      if (quickHotelForm.couverture) {
        formData.append("couverture", quickHotelForm.couverture);
      }
      // images
      (quickHotelForm.images || []).forEach((file) => {
        formData.append("images", file);
      });
      // video url
      if (quickHotelForm.video_url) {
        formData.append("video_url", quickHotelForm.video_url);
      }

      const { data } = await api.post("/services/", formData);
      // Prepend the new service to the local state so it appears immediately
      if (data) {
        setServices((prev) => [data, ...(prev || [])]);
        setLatestAddedService(data);
      }
      setQuickHotelMessage("Élément d'hôtellerie ajouté avec succès.");
      setQuickHotelForm({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, images: [], video_url: "" });
      // Refresh admin data in background (keeps data consistent)
      loadAdminData().catch(() => {});
    } catch (err) {
      // Provide a detailed error message for the UI
      try {
        const resp = err?.response;
        if (resp) {
          const status = resp.status;
          const data = resp.data;
          if (data && typeof data === 'object') {
            const parts = [];
            if (data.detail) parts.push(String(data.detail));
            for (const [k, v] of Object.entries(data)) {
              if (k === 'detail') continue;
              const val = Array.isArray(v) ? v.join(' ') : String(v);
              parts.push(`${k}: ${val}`);
            }
            setQuickHotelError(`Erreur ${status}: ${parts.join(' | ')}`);
          } else {
            setQuickHotelError(`Erreur ${status}: ${String(data)}`);
          }
        } else if (err?.message) {
          setQuickHotelError(`Erreur réseau: ${err.message}`);
        } else {
          setQuickHotelError('Erreur inconnue lors de l\'ajout.');
        }
      } catch (e) {
        setQuickHotelError('Erreur lors du traitement de la réponse d\'erreur.');
      }
    }
  };

  const submitQuickEloquenceItem = async (e) => {
    e && e.preventDefault();
    setQuickEloquenceError("");
    setQuickEloquenceMessage("");

    try {
      // Ensure category exists
      const category = (categories.find((c) => (c.nom || "").toLowerCase() === "éloquence" || (c.nom || "").toLowerCase() === "eloquence") ) || await ensureEloquenceCategory();
      if (!category) {
        setQuickEloquenceError("La catégorie Éloquence est introuvable et n'a pas pu être créée.");
        return;
      }

      // If no subcategory selected, create a default one (Ex: Général)
      let sousId = quickEloquenceForm.sous_categorie;
      if (!sousId) {
        const defaultName = "Général";
        const existingSub = (category.sous_categories || []).find((s) => (s.nom || "").toLowerCase() === defaultName.toLowerCase());
        if (existingSub) sousId = existingSub.id;
        else {
          const subRes = await api.post("/sous-categories/", { nom: defaultName, categorie: category.id, ordre: 0 });
          sousId = subRes.data.id;
          await loadAdminData();
        }
      }

      // Create the service (Éloquence uses same form as Hôtellerie, no document/pdf)
      const formData = new FormData();
      formData.append("titre", quickEloquenceForm.titre);
      formData.append("description", quickEloquenceForm.description || "");
      formData.append("sous_categorie", String(sousId));
      formData.append("prix", String(Number(quickEloquenceForm.prix || 0)));
      formData.append("disponible", "true");
      formData.append("mis_en_avant", "false");

      if (quickEloquenceForm.couverture) {
        formData.append("couverture", quickEloquenceForm.couverture);
      }
      // Attach the PDF/primary file for Éloquence (same as book 'fichier')
      if (quickEloquenceForm.fichier) {
        formData.append("fichier", quickEloquenceForm.fichier);
      }
      // Attach direct video file (new for Éloquence)
      if (quickEloquenceForm.video) {
        formData.append("video", quickEloquenceForm.video);
      }

      const { data } = await api.post("/services/", formData);
      if (data) {
        setServices((prev) => [data, ...(prev || [])]);
        setLatestAddedService(data);
      }
      setQuickEloquenceMessage("Élément d'Éloquence ajouté avec succès.");
      setQuickEloquenceForm({ titre: "", description: "", prix: "0", sous_categorie: "", couverture: null, fichier: null, video: null });
      loadAdminData().catch(() => {});
    } catch (err) {
      try {
        const resp = err?.response;
        if (resp) {
          const status = resp.status;
          const data = resp.data;
          if (data && typeof data === 'object') {
            const parts = [];
            if (data.detail) parts.push(String(data.detail));
            for (const [k, v] of Object.entries(data)) {
              if (k === 'detail') continue;
              const val = Array.isArray(v) ? v.join(' ') : String(v);
              parts.push(`${k}: ${val}`);
            }
            setQuickEloquenceError(`Erreur ${status}: ${parts.join(' | ')}`);
          } else {
            setQuickEloquenceError(`Erreur ${status}: ${String(data)}`);
          }
        } else if (err?.message) {
          setQuickEloquenceError(`Erreur réseau: ${err.message}`);
        } else {
          setQuickEloquenceError('Erreur inconnue lors de l\'ajout.');
        }
      } catch (e) {
        setQuickEloquenceError('Erreur lors du traitement de la réponse d\'erreur.');
      }
    }
  };

  // Open a custom confirmation modal for deletion
  const handleDeleteCategory = async (slug, label) => {
    setDeleteTarget({ type: 'category', slug, label: label || slug });
    setShowDeleteModal(true);
    setError('');
  };

  const handleDeleteSubCategory = async (slug, label) => {
    setDeleteTarget({ type: 'sub', slug, label: label || slug });
    setShowDeleteModal(true);
    setError('');
  };

  const handleDeleteBook = async (slug, label) => {
    setDeleteTarget({ type: 'book', slug, label: label || slug });
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
      let res;
      if (type === 'category') res = await api.delete(`/categories/${slug}/`);
      else if (type === 'sub') res = await api.delete(`/sous-categories/${slug}/`);
      else if (type === 'book') res = await api.delete(`/books/${slug}/`);
      else if (type === 'service') res = await serviceService.deleteService(slug);
      else if (type === 'quote') res = await api.delete(`/quotes/${slug}/`);
      setMessage(res?.data?.detail || 'Élé­ment supprimé.');
      setDeleteTarget(null);
      // if a quote was open, close it
      if (type === 'quote') { setSelectedQuote(null); setShowQuoteModal(false); }
      await loadAdminData();
    } catch (err) {
      const data = err?.response?.data;
      setError(data ? (typeof data === 'string' ? data : JSON.stringify(data)) : (err.message || 'La suppression a échoué.'));
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
    } catch (e) {
      computedTotal = null;
    }

    setDeleteTarget({ type: 'quote', slug: id, label: `Devis #${id}`, quote: q, total: computedTotal });
    setShowDeleteModal(true);
  };

  const handleStatusChange = async (id, nextStatus) => {
    try {
      await purchaseService.updateStatus(id, nextStatus);
      setMessage("Statut de l’achat mis à jour.");
      await loadAdminData();
    } catch (err) {
      // try to extract field errors
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : "La mise à jour du statut a échoué.";
      setError(msg);
    }
  };

  const [purchaseAdminForm, setPurchaseAdminForm] = useState({ reference_transaction: "" });

  const openPurchaseModal = (achat) => {
    setActivePurchase(achat);
    setPurchaseAdminForm({ reference_transaction: achat.reference_transaction || "" });
    setShowPurchaseModal(true);
  };

  const handleApprovePurchase = async (id) => {
    try {
      const payload = { statut: 'paye' };
      if (purchaseAdminForm.reference_transaction) payload.reference_transaction = purchaseAdminForm.reference_transaction;
      await purchaseService.adminUpdate(id, payload);
      setMessage('Achat approuvé.');
      setShowPurchaseModal(false);
      await loadAdminData();
    } catch (err) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : 'Échec lors de l\'approbation.';
      setError(msg);
    }
  };

  const handleRejectPurchase = async (id) => {
    try {
      const payload = { statut: 'echoue' };
      await purchaseService.adminUpdate(id, payload);
      setMessage('Achat marqué comme échoué.');
      setShowPurchaseModal(false);
      await loadAdminData();
    } catch (err) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : 'Échec lors du rejet.';
      setError(msg);
    }
  };

    // Payment settings handlers
    const [paymentSettings, setPaymentSettings] = useState({ merchant_code: '000000', merchant_number: '696618526' });
    const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);

    const loadPaymentSettings = async () => {
      try {
        const res = await purchaseService.getPaymentSettings();
        setPaymentSettings(res.data);
      } catch (e) {
        // ignore silently or show a non-blocking message
      }
    };

    const savePaymentSettings = async () => {
      setPaymentSettingsSaving(true);
      try {
        await purchaseService.updatePaymentSettings(paymentSettings);
        setMessage('Paramètres de paiement mis à jour.');
        await loadAdminData();
      } catch (e) {
        setError('Échec lors de la sauvegarde des paramètres de paiement.');
      } finally {
        setPaymentSettingsSaving(false);
      }
    };

    useEffect(() => { loadPaymentSettings(); }, []);

  const currentSectionLabel = SIDEBAR_SECTIONS.find((s) => s.id === activeSection)?.label || "";

  return (
    <div className="admin-dashboard-layout">
      {/* ---------- BARRE LATÉRALE ---------- */}
      <aside className="admin-sidebar">
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
              onClick={() => setActiveSection(section.id)}
            >
              <i className={section.icon} aria-hidden="true" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-user-pill">{user.username}</span>
          </div>
          <button type="button" className="btn-outline admin-sidebar-logout" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ---------- CONTENU PRINCIPAL ---------- */}
      <div className="admin-page">
        <div className="admin-shell">
          <header className="admin-header">
            <div className="admin-header-left">
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
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteCategory(category.slug, category.nom)} disabled={deletingSlug === category.slug}>{deletingSlug === category.slug ? 'Suppression...' : 'Supprimer'}</button>
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
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteSubCategory(sub.slug, sub.nom)} disabled={deletingSlug === sub.slug}>{deletingSlug === sub.slug ? 'Suppression...' : 'Supprimer'}</button>
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
                          onChange={(e) => setBookForm({ ...bookForm, couverture: e.target.files?.[0] || null })}
                        />
                      </label>
                      <label>
                        Fichier du livre
                        <input
                          type="file"
                          onChange={(e) => setBookForm({ ...bookForm, fichier: e.target.files?.[0] || null })}
                        />
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
                            <button type="button" className="admin-mini-btn admin-mini-btn-delete" onClick={() => handleDeleteBook(book.slug, book.titre)} disabled={deletingSlug === book.slug}>{deletingSlug === book.slug ? 'Suppression...' : 'Supprimer'}</button>
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
                                <div style={{fontSize:'0.85rem', color:'#666'}}>{svc.sous_categorie || ''} • {Number(svc.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                              </div>
                            </div>

                            <div style={{display:'flex', gap:8}}>
                              <button className="btn-outline" onClick={() => startEditService(svc)}>Éditer</button>
                              <button className="btn-danger" onClick={() => handleDeleteService(svc)} disabled={serviceDeleting === svc.slug}>{serviceDeleting === svc.slug ? 'Suppression…' : 'Supprimer'}</button>
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
                                    <div style={{fontSize:'0.85rem', color:'#666'}}>{svc.sous_categorie || ''} • {Number(svc.prix || 0).toLocaleString('fr-FR')} FCFA</div>
                                  </div>
                                </div>

                                <div style={{display:'flex', gap:8}}>
                                  <button className="btn-outline" onClick={() => startEditService(svc)}>Éditer</button>
                                  <button className="btn-danger" onClick={() => handleDeleteService(svc)} disabled={serviceDeleting === svc.slug}>{serviceDeleting === svc.slug ? 'Suppression…' : 'Supprimer'}</button>
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
                  {quotes.length === 0 ? (
                    <div className="empty">Aucun devis reçu.</div>
                  ) : (
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
                  )}
                </section>

                    {showQuoteModal && selectedQuote && (
                      <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowQuoteModal(false); setSelectedQuote(null); } }}>
                        <div className="admin-modal admin-modal-wide" role="dialog" aria-modal="true">
                          <div className="admin-modal-header">
                            <h3>Devis — #{selectedQuote.id}</h3>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:12}}>
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
                                  } catch (e) {
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
                        Code marchand
                        <input value={paymentSettings.merchant_code || ''} onChange={(e) => setPaymentSettings({ ...paymentSettings, merchant_code: e.target.value })} />
                      </label>
                      <label>
                        Numéro marchand
                        <input value={paymentSettings.merchant_number || ''} onChange={(e) => setPaymentSettings({ ...paymentSettings, merchant_number: e.target.value })} />
                      </label>
                      <div style={{display:'flex', gap:8}}>
                        <button className="btn-primary" onClick={savePaymentSettings} disabled={paymentSettingsSaving}>{paymentSettingsSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
                      </div>
                    </div>
                  </div>
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
                        <input type="file" accept="image/*" onChange={(e) => setBookForm({ ...bookForm, couverture: e.target.files?.[0] || null })} />
                        {bookFormErrors.couverture && <div className="field-error">{Array.isArray(bookFormErrors.couverture) ? bookFormErrors.couverture.join(', ') : bookFormErrors.couverture}</div>}
                      </label>
                      <label>
                        Fichier du livre
                        <input type="file" onChange={(e) => setBookForm({ ...bookForm, fichier: e.target.files?.[0] || null })} />
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
                              } catch (e) {
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