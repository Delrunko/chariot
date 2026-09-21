import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryService } from "../services/api";
import "./MyLibrary.css";

/**
 * "Ma bibliothèque" : liste des livres achetés, avec le statut de
 * revalidation hors-ligne (cahier des charges §4.3).
 */
export default function MyLibrary() {
  const [acces, setAcces] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [enLigne, setEnLigne] = useState(navigator.onLine);

  useEffect(() => {
    libraryService
      .myLibrary()
      .then(({ data }) => setAcces(data))
      .finally(() => setChargement(false));

    const majStatut = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", majStatut);
    window.addEventListener("offline", majStatut);
    return () => {
      window.removeEventListener("online", majStatut);
      window.removeEventListener("offline", majStatut);
    };
  }, []);

  const revalider = async (livreId) => {
    await libraryService.revalidate(livreId);
    const { data } = await libraryService.myLibrary();
    setAcces(data);
  };

  return (
    <div className="my-library">
      <h1>Ma bibliothèque</h1>
      <p className={`connection-status ${enLigne ? "online" : "offline"}`}>
        {enLigne ? "● Connecté — lecture disponible" : "● Hors-ligne — lecture depuis le cache local"}
      </p>

      {chargement && <p>Chargement…</p>}
      {!chargement && acces.length === 0 && <p>Vous n'avez encore acheté aucun livre.</p>}

      <div className="my-library-grid">
        {acces.map((a) => (
          <div key={a.id} className="library-item">
            <img src={a.livre.couverture} alt={a.livre.titre} />
            <div className="library-item-info">
              <h3>{a.livre.titre}</h3>
              {a.doit_revalider ? (
                <>
                  <p className="revalidate-warning">Revalidation en ligne requise</p>
                  <button onClick={() => revalider(a.livre.id)} disabled={!enLigne}>
                    Revalider maintenant
                  </button>
                </>
              ) : (
                <Link to={`/lire/${a.livre.id}`} className="btn-primary">
                  Lire
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
