import axios from "axios";

const API_BASE_URL = "https://chariot-backend-lmms.onrender.com/api";

const api = axios.create({ baseURL: API_BASE_URL });

// --- Attach JWT token to each request ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("eds_access_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
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

// Helper to build fetch headers including Authorization when available
function buildFetchHeaders(additional = {}) {
  const token = localStorage.getItem("eds_access_token");
  const headers = { ...additional };
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}

// --- Auth ---
export const authService = {
  register: (data) => api.post("/auth/register/", data),
  login: async (username, password) => {
    const { data } = await api.post("/auth/login/", { username, password });
    localStorage.setItem("eds_access_token", data.access);
    localStorage.setItem("eds_refresh_token", data.refresh);
    return data;
  },
  logout: () => {
    localStorage.removeItem("eds_access_token");
    localStorage.removeItem("eds_refresh_token");
  },
  me: () => api.get("/auth/me/"),
  isAuthenticated: () => !!localStorage.getItem("eds_access_token"),
};

export const adminService = {
  dashboard: () => api.get("/auth/admin/dashboard/"),
  users: () => api.get("/auth/admin/users/"),
};

export const catalogService = {
  getCategories: () => api.get("/categories/"),
  getBooks: (params = {}) => api.get("/books/", { params }),
  getBook: (slug) => api.get(`/books/${slug}/`),
  getVitrine: () => api.get("/books/vitrine/"),
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
  // payload: { client_name, client_email, client_phone, message, categorie, items }
  createQuote: (payload) => api.post('/quotes/', payload),
};

export const testimonialsService = {
  getTestimonials: () => api.get('/testimonials/'),
  createTestimonial: (payload) => {
    const headers = buildFetchHeaders({ 'Content-Type': 'application/json' });
    return fetch(`${API_BASE_URL}/testimonials/`, { method: 'POST', headers, body: JSON.stringify(payload) }).then(async (res) => {
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
  // legacy helper: quick buy using axios
  buy: (livreId, moyenPaiement = "orange_money") =>
    api.post("/purchases/", { livre: livreId, moyen_paiement: moyenPaiement }),

  // Service (Éloquence) quick buy
  buyService: (serviceId, moyenPaiement = "orange_money", referenceTransaction = "") =>
    api.post("/purchases/service/", {
      service: serviceId,
      moyen_paiement: moyenPaiement,
      reference_transaction: referenceTransaction,
    }),

  // Create a purchase with arbitrary payload (useful to send reference_transaction etc.)
  create: async (payload) => {
    const headers = buildFetchHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_BASE_URL}/purchases/`, {
      method: "POST",
      headers,
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

  myPurchases: async () => {
    const token = localStorage.getItem("eds_access_token");
    if (token) {
      const res = await fetch(`${API_BASE_URL}/purchases/mes-achats/`, { headers: buildFetchHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    return api.get("/purchases/mes-achats/");
  },

  myServicePurchases: async () => {
    const token = localStorage.getItem("eds_access_token");
    if (token) {
      const res = await fetch(`${API_BASE_URL}/purchases/service/mes-achats/`, { headers: buildFetchHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    return api.get("/purchases/service/mes-achats/");
  },

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
    `${API_BASE_URL}/library/${livreId}/read/?empreinte_appareil=${getEmpreinteAppareil()}`,
  readDocument: async (livreId) => {
    const empreinte = getEmpreinteAppareil();
    const readUrl = `${API_BASE_URL}/library/${livreId}/read/?empreinte_appareil=${empreinte}`;

    // Try to fetch the document
    let res = await fetch(readUrl, { headers: buildFetchHeaders() });

    // If no access (404) or server asks for revalidation (426), attempt revalidation once
    if (!res.ok && (res.status === 404 || res.status === 426)) {
      // Attempt to revalidate (will create/update AccesLecture if user has PAYE achat)
      const revalRes = await fetch(`${API_BASE_URL}/library/${livreId}/revalider/`, {
        method: "POST",
        headers: buildFetchHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ empreinte_appareil: empreinte }),
      });

      if (!revalRes.ok) {
        // revalidation failed — propagate original error or revalidation message
        const errText = await revalRes.text();
        throw new Error(errText || "Revalidation impossible.");
      }

      // Revalidation succeeded — try to fetch the document again
      res = await fetch(readUrl, { headers: buildFetchHeaders() });
    }

    if (!res.ok) {
      const payload = await res.text();
      throw new Error(payload || "Impossible d'ouvrir le document.");
    }

    const blob = await res.blob();
    // Force the MIME type to application/pdf so the browser's PDF viewer
    // renders it correctly inside the iframe, even if the server didn't
    // send the right Content-Type header.
    const pdfBlob = new Blob([blob], { type: "application/pdf" });
    return URL.createObjectURL(pdfBlob);
  },
};

export default api
