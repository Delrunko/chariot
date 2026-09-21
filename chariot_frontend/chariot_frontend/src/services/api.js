import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

const api = axios.create({ baseURL: API_BASE_URL });

// --- Attache automatiquement le token JWT à chaque requête ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("eds_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Empreinte d'appareil simple, stable par navigateur ---
// Utilisée pour lier l'accès de lecture hors-ligne à CET appareil,
// conformément au cahier des charges (§4.3).
export function getEmpreinteAppareil() {
  let empreinte = localStorage.getItem("chariot_device_id");
  if (!empreinte) {
    empreinte = crypto.randomUUID();
    localStorage.setItem("eds_device_id", empreinte);
  }
  return empreinte;
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

// --- Catalogue / Vitrine ---
export const catalogService = {
  getCategories: () => api.get("/categories/"),
  getBooks: (params = {}) => api.get("/books/", { params }),
  getBook: (slug) => api.get(`/books/${slug}/`),
  getVitrine: () => api.get("/books/vitrine/"),
};

// --- Achats ---
export const purchaseService = {
  buy: (livreId, moyenPaiement = "orange_money") =>
    api.post("/purchases/", { livre: livreId, moyen_paiement: moyenPaiement }),
  myPurchases: () => api.get("/purchases/mes-achats/"),
};

// --- Bibliothèque / lecture hors-ligne ---
export const libraryService = {
  myLibrary: () => api.get("/library/"),
  revalidate: (livreId) =>
    api.post(`/library/${livreId}/revalider/`, { empreinte_appareil: getEmpreinteAppareil() }),
  readUrl: (livreId) =>
    `${API_BASE_URL}/library/${livreId}/read/?empreinte_appareil=${getEmpreinteAppareil()}`,
};

export default api;
