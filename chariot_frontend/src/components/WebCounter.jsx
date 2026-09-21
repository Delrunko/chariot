import { useEffect, useState, useRef } from "react";
import "./WebCounter.css";

export default function WebCounter({ className = "" }) {
  const [count, setCount] = useState(null);
  const hasFetched = useRef(false); // 🔒 Verrou pour éviter le double appel (React 18 Strict Mode)

  useEffect(() => {
    // Si la requête a déjà été faite, on annule (bloque le 2ème appel automatique)
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetch("http://127.0.0.1:8000/api/visit-counter/")
      .then((r) => r.json())
      .then((data) => setCount(data.count))
      .catch(() => setCount(null));
  }, []);

  if (count === null) return null;

  return (
    <div className={`web-counter ${className}`}>
      <span className="web-counter-number">{count}</span>
      <span className="web-counter-label">visites</span>
    </div>
  );
}