import { useEffect, useState, useRef } from "react";
import api from "../services/api";
import "./WebCounter.css";

export default function WebCounter({ className = "" }) {
  const [count, setCount] = useState(null);
  const hasFetched = useRef(false); // verrou anti double appel (Strict Mode)

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        const res = await api.get("/visit-counter/");
        setCount(res.data.count);
      } catch {
        setCount(null);
      }
    })();
  }, []);

  if (count === null) return null;

  return (
    <div className={`web-counter ${className}`}>
      <span className="web-counter-number">{count}</span>
      <span className="web-counter-label">visites</span>
    </div>
  );
}