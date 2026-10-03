const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000/api"
    : "https://chariot-backend-lmms.onrender.com/api")
).replace(/\/+$/, "");

function getQuotesUrl() {
  const url = new URL(`${API_BASE_URL}/quotes/`, window.location.origin);
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    url.protocol = "https:";
  }
  return url.toString();
}

export async function createQuote(formData) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(getQuotesUrl(), {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    }

    if (!response.ok) {
      const detail =
        typeof data === "string"
          ? data
          : data?.detail || data?.message || JSON.stringify(data);
      throw new Error(detail || `Erreur ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre. Réessayez dans un instant.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
