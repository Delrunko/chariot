import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000/api"
    : "https://chariot-backend-lmms.onrender.com/api")
).replace(/\/+$/, "");

function secureUrl(url) {
  if (!url) return url;

  try {
    const normalized = new URL(url, window.location.origin);
    const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(normalized.hostname);
    if (normalized.protocol === "http:" && !isLocalHost) {
      normalized.protocol = "https:";
    }
    return normalized.toString();
  } catch {
    return url.replace(/^http:/i, "https:");
  }
}

const api = axios.create({ 
  baseURL: secureUrl(API_BASE_URL),
  timeout: 60000, // CORRECTION 1 : Attendre 60 secondes que Render se réveille
});

// --- Device fingerprint helper ---
export function getEmpreinteAppareil() {
  let empreinte = localStorage.getItem("eds_device_id");
  if (!empreinte) {
    empreinte = crypto.randomUUID();
    localStorage.setItem("eds_device_id", empreinte);
  }
  return empreinte;
}

export const adminService = {
  dashboard: () => api.get("/auth/admin/dashboard/"),
  users: () => api.get("/auth/admin/users/"),
};

export const catalogService = {
  getCategories: () => api.get("/categories/"),
  getBooks: (params = {}) => api.get("/books/", { params }),
  getBook: (slug) => api.get(`/books/${slug}/`),
};

export const serviceService = {
  getServices: (params = {}) => api.get('/services/', { params }),
  getService: (slug) => api.get(`/services/${slug}/`),
  createService: (formData) => api.post('/services/', formData),
  uploadImages: (slug, formData) => api.post(`/services/${slug}/images/`, formData),
  updateService: (slug, formData) => api.patch(`/services/${slug}/`, formData),
  deleteService: (slug) => api.delete(`/services/${slug}/`),
};

// Quotes / Devis
export const quotesService = {
  createQuote: (payload) => api.post('/quotes/', payload),
};

export const testimonialsService = {
  createTestimonial: (payload) => {
    const headers = { "Content-Type": "application/json" };
    return fetch(secureUrl(`${API_BASE_URL}/testimonials/`), { method: 'POST', headers, body: JSON.stringify(payload) }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        const err = new Error('Echec envoi témoignage');
        err.response = { status: res.status, data: text };
        throw err;
      }
      return res.json();
    });
  }
};

export const purchaseService = {
  buy: (livreId, moyenPaiement = "orange_money") =>
    api.post("/purchases/", { livre: livreId, moyen_paiement: moyenPaiement }),

  buyService: (serviceId, moyenPaiement = "orange_money", referenceTransaction = "") =>
    api.post("/purchases/service/", {
      service: serviceId,
      moyen_paiement: moyenPaiement,
      reference_transaction: referenceTransaction,
    }),

  create: async (payload) => {
    const res = await fetch(secureUrl(`${API_BASE_URL}/purchases/`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      let json;
      try { json = JSON.parse(errText); } catch(e) { json = errText; }
      const err = new Error("Purchase creation failed");
      err.response = { data: json, status: res.status };
      throw err;
    }
    return res.json();
  },

  myPurchases: () => api.get("/purchases/mes-achats/"),

  myServicePurchases: () => api.get("/purchases/service/mes-achats/"),

  adminServicePurchases: () => api.get("/purchases/admin/service/"),
  adminServiceUpdate: (id, payload) => api.patch(`/purchases/admin/service/${id}/`, payload),

  adminPurchases: () => api.get("/purchases/admin/"),
  updateStatus: (id, statut) => api.patch(`/purchases/admin/${id}/`, { statut }),
  adminUpdate: (id, payload) => api.patch(`/purchases/admin/${id}/`, payload),
  getPaymentSettings: () => api.get(`/purchases/admin/payment-settings/`),
  updatePaymentSettings: (data) => api.put(`/purchases/admin/payment-settings/`, data),
};

export const libraryService = {
  myLibrary: () => api.get("/library/"),
  revalidate: (livreId) =>
    api.post(`/library/${livreId}/revalider/`, { empreinte_appareil: getEmpreinteAppareil() }),
  readUrl: (livreId) =>
    secureUrl(`${API_BASE_URL}/library/${livreId}/read/?empreinte_appareil=${getEmpreinteAppareil()}`),
  
  readDocument: async (livreId) => {
    const empreinte = getEmpreinteAppareil();
    const readUrl = secureUrl(`${API_BASE_URL}/library/${livreId}/read/?empreinte_appareil=${empreinte}`);

    // CORRECTION 2 : Ajouter un timeout de 60 secondes pour les requêtes fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const getErrorMessage = async (response) => {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return data.detail || "Impossible d'ouvrir le document.";
      }

      if (contentType.includes("text/html")) {
        return `Le serveur n'a pas pu préparer le PDF (erreur ${response.status}). Réessayez plus tard.`;
      }

      const text = await response.text();
      if (/^\s*(<!doctype\s+html|<html\b)/i.test(text)) {
        return `Le serveur n'a pas pu préparer le PDF (erreur ${response.status}). Réessayez plus tard.`;
      }
      return text || `Impossible d'ouvrir le document (erreur ${response.status}).`;
    };

    try {
      let res = await fetch(readUrl, { 
        signal: controller.signal 
      });

      if (!res.ok && (res.status === 404 || res.status === 426)) {
        const revalRes = await fetch(`${API_BASE_URL}/library/${livreId}/revalider/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empreinte_appareil: empreinte }),
          signal: controller.signal,
        });

        if (!revalRes.ok) {
          throw new Error(await getErrorMessage(revalRes));
        }

        res = await fetch(readUrl, { 
          signal: controller.signal 
        });
      }

      if (!res.ok) {
        throw new Error(await getErrorMessage(res));
      }

      const contentType = res.headers.get("content-type") || "";
      if (
        !contentType.includes("application/pdf") &&
        !contentType.includes("application/octet-stream")
      ) {
        throw new Error("Le serveur a renvoyé un contenu qui n'est pas un PDF.");
      }

      const blob = await res.blob();
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      return URL.createObjectURL(pdfBlob);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error("Le serveur met trop de temps à répondre (réveil en cours). Veuillez patienter 30 secondes et réessayer.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

export default api;