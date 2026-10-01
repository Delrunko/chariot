import { useEffect, useState } from "react";
import { catalogService } from "../services/api";
import "./WebCounter.css";

let visitCounterRequest;

function getCachedCount() {
  try {
    const storedCount = localStorage.getItem("eds_visit_count");
    if (storedCount === null) return null;
    const count = Number(storedCount);
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

export default function WebCounter({ className = "" }) {
  const [count, setCount] = useState(getCachedCount);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!visitCounterRequest) {
      visitCounterRequest = catalogService.visitCounter().catch((requestError) => {
        visitCounterRequest = null;
        throw requestError;
      });
    }

    visitCounterRequest
      .then((data) => {
        if (!Number.isSafeInteger(data.count) || data.count < 0) {
          throw new Error("Le serveur a renvoyé un compteur de visites invalide.");
        }
        if (active) {
          setCount(data.count);
          setError("");
          try {
            localStorage.setItem("eds_visit_count", String(data.count));
          } catch (storageError) {
            setError(storageError.message);
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={`web-counter ${className}`}
      title={error || "Nombre de visites du site"}
      aria-label={count === null ? "Nombre de visites indisponible" : `${count} visites`}
      aria-live="polite"
    >
      <span className="web-counter-number">{count ?? "—"}</span>
      <span className="web-counter-label">visites</span>
    </div>
  );
}