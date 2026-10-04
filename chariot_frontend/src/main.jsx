import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

async function startApplication() {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => window.setTimeout(resolve, 5000)),
      ]);
    } catch (error) {
      console.error("Impossible d'activer le mode hors connexion.", error);
    }
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void startApplication();
