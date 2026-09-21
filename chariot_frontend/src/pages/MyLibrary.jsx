import { useEffect, useState } from "react";
import { libraryService, purchaseService, serviceService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import RestrictedVideoPlayer from "../components/RestrictedVideoPlayer";
import "./MyLibrary.css";

const statutLabel = (statut) => {
  const s = (statut || "").toString().toLowerCase();
  if (s.includes("paye") || s === "payé" || s === "paid") return "Payé";
  if (s.includes("attente")) return "En attente";
  return statut || "—";
};

const statutClass = (statut) => {
  const s = (statut || "").toString().toLowerCase();
  if (s.includes("paye") || s === "payé" || s === "paid") return "status-paid";
  if (s.includes("attente")) return "status-pending";
  return "status-default";
};

const AccountIcon = () => (
  <svg viewBox="0 0 24 24" className="account-avatar-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4.5 19c1.4-3.2 4.2-4.8 7.5-4.8s6.1 1.6 7.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M6 7l1 12.5A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.5L18 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/**
 * "Ma bibliothèque" : liste des livres achetés, avec le statut de
 * revalidation hors-ligne (cahier des charges §4.3).
 */
export default function MyLibrary() {
  const [acces, setAcces] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [livreEnLecture, setLivreEnLecture] = useState(null);
  const [servicePurchases, setServicePurchases] = useState([]);
  const [chargementServices, setChargementServices] = useState(true);
  const [showReaderModal, setShowReaderModal] = useState(false);
  const [readerDocumentUrl, setReaderDocumentUrl] = useState(null);
  const [readerLivreId, setReaderLivreId] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState(null);
  const [videoModalTitle, setVideoModalTitle] = useState(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    libraryService
      .myLibrary()
      .then(({ data }) => {
        if (!cancelled) setAcces(data);
      })
      .finally(() => {
        if (!cancelled) setChargement(false);
      });

    const loadServicePurchases = async () => {
      try {
        const res = await purchaseService.myServicePurchases();
        const payload = res?.data ?? res;
        if (!cancelled) {
          setServicePurchases(Array.isArray(payload) ? payload : []);
        }
      } catch (e) {
        if (!cancelled) setServicePurchases([]);
      } finally {
        if (!cancelled) setChargementServices(false);
      }
    };

    loadServicePurchases();
    const interval = setInterval(loadServicePurchases, 10000);

    const majStatut = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", majStatut);
    window.addEventListener("offline", majStatut);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", majStatut);
      window.removeEventListener("offline", majStatut);
    };
  }, []);

  const revalider = async (livreId) => {
    await libraryService.revalidate(livreId);
    const { data } = await libraryService.myLibrary();
    setAcces(data);
  };

  const [suppressionEnCours, setSuppressionEnCours] = useState(null); // id de l'accès en cours de suppression
  const [erreurSuppression, setErreurSuppression] = useState("");

  const supprimerLivre = async (acces) => {
    const confirme = window.confirm(`Retirer "${acces.livre.titre}" de votre bibliothèque ?`);
    if (!confirme) return;

    setErreurSuppression("");
    setSuppressionEnCours(acces.id);
    try {
      await libraryService.remove(acces.livre.id);
      setAcces((prev) => prev.filter((a) => a.id !== acces.id));
    } catch (e) {
      setErreurSuppression("Impossible de supprimer ce livre pour le moment.");
    } finally {
      setSuppressionEnCours(null);
    }
  };

  useEffect(() => {
    if (!showVideoModal) return;

    const onKey = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && ["s", "p", "c", "u"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (key === "f12") {
        e.preventDefault();
        e.stopPropagation();
      }
      if (ctrlOrCmd && e.shiftKey && ["i", "j", "c"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (key === "printscreen") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e) => e.preventDefault();
    const onSelectStart = (e) => e.preventDefault();
    const onCopy = (e) => e.preventDefault();
    const onDragStart = (e) => e.preventDefault();

    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('selectstart', onSelectStart);
    window.addEventListener('copy', onCopy);
    window.addEventListener('dragstart', onDragStart);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('selectstart', onSelectStart);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('dragstart', onDragStart);
    };
  }, [showVideoModal]);

  const resolveServiceAction = async (p) => {
    const svc = p.service && typeof p.service === 'object' ? p.service : null;
    const tryDoc = svc && (svc.document || svc.fichier || svc.file || svc.file_url || svc.document_url);
    const tryVideo = svc && (svc.video || svc.video_url || svc.videourl);
    const altDoc = p.document || p.fichier || p.document_url || p.file_url;
    const altVideo = p.video || p.video_url;

    if (tryDoc || altDoc) {
      setReaderDocumentUrl(tryDoc || altDoc);
      setReaderLivreId(svc && svc.id ? svc.id : null);
      setShowReaderModal(true);
      return;
    }
    if (tryVideo || altVideo) {
      setVideoModalUrl(tryVideo || altVideo);
      setVideoModalTitle((svc && svc.titre) || p.service_titre || p.service_title || 'Vidéo du service');
      setShowVideoModal(true);
      return;
    }

    const identifier = svc?.slug || svc?.id || p.service;
    try {
      let svcRes = null;
      try { svcRes = await serviceService.getService(identifier); } catch (err) {
        try { svcRes = await serviceService.getServices({ id: identifier }); } catch (err2) { svcRes = null; }
      }
      const data = svcRes?.data ?? svcRes ?? null;
      const serviceObj = Array.isArray(data) ? data[0] : data;
      const doc = serviceObj?.document || serviceObj?.fichier || serviceObj?.file_url || serviceObj?.document_url;
      const video = serviceObj?.video_url || serviceObj?.video;
      if (doc) { setReaderDocumentUrl(doc); setReaderLivreId(serviceObj.id || null); setShowReaderModal(true); return; }
      if (video) { setVideoModalUrl(video); setVideoModalTitle(serviceObj.titre || serviceObj.title || 'Vidéo du service'); setShowVideoModal(true); return; }
      setReaderDocumentUrl(null); setReaderLivreId(null); setShowReaderModal(true);
    } catch (e) {
      setReaderDocumentUrl(null); setReaderLivreId(null); setShowReaderModal(true);
    }
  };

  return (
    <div className="my-library">
      <div className="library-header">
        <h1 className="library-title">Ma bibliothèque</h1>
        <p className={`connection-status ${enLigne ? "online" : "offline"}`}>
          {enLigne ? "Connecté — lecture disponible" : "Hors-ligne — lecture depuis le cache local"}
        </p>
      </div>

      {user && (
        <div className="account-card">
          <div className="account-avatar"><AccountIcon /></div>
          <div className="account-identity">
            <div className="account-name">{user.username}</div>
            {user.email && <div className="account-email">{user.email}</div>}
            <div className="account-role">Rôle : {user.role || (user.est_admin ? 'admin' : 'client')}</div>
          </div>
          <div className="account-stats">
            <div className="account-stat">
              <span className="account-stat-value">{acces.length}</span>
              <span className="account-stat-label">Livres achetés</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{servicePurchases.length}</span>
              <span className="account-stat-label">Services achetés</span>
            </div>
          </div>
        </div>
      )}

      {chargement && <p className="library-loading">Chargement…</p>}
      {!chargement && acces.length === 0 && (
        <p className="library-empty">Vous n'avez encore acheté aucun livre.</p>
      )}

      {!chargementServices && servicePurchases.length > 0 && (
        <section className="library-section">
          <h2 className="section-title">Mes achats de services</h2>
          <div className="service-purchase-list">
            {servicePurchases.map((p) => {
              const svc = p.service && typeof p.service === 'object' ? p.service : null;
              const cover = svc ? (svc.couverture || svc.cover || svc.cover_image) : (p.couverture || p.cover);
              const titre = (svc && (svc.titre || svc.title)) || p.service_titre || p.service_title || (typeof p.service === 'string' ? p.service : `Service #${p.service}`);
              const isPaid = statutClass(p.statut) === 'status-paid';

              return (
                <div key={p.id} className="service-purchase-row">
                  <div className="service-purchase-cover">
                    {cover ? <img src={cover} alt="" /> : <div className="service-purchase-cover-empty" />}
                  </div>

                  <div className="service-purchase-main">
                    <div className="service-purchase-title">{titre}</div>
                    <div className="service-purchase-date">
                      {p.date_achat ? new Date(p.date_achat).toLocaleString() : ''}
                    </div>
                  </div>

                  <div className="service-purchase-status">
                    <span className={`status-badge ${statutClass(p.statut)}`}>{statutLabel(p.statut)}</span>
                    {isPaid && (
                      <button type="button" className="btn-primary" onClick={() => resolveServiceAction(p)}>
                        Lire
                      </button>
                    )}
                  </div>

                  {playingVideoId === p.id && playingVideoUrl && (
                    <div className="service-purchase-inline-video">
                      {/(youtube|vimeo|youtu\.be|watch\?v=)/i.test(playingVideoUrl) ? (
                        <div className="inline-video-frame-wrap">
                          <iframe title="video" src={playingVideoUrl} frameBorder="0" allowFullScreen />
                        </div>
                      ) : (
                        <video controls src={playingVideoUrl} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {acces.length > 0 && (
        <section className="library-section">
          <h2 className="section-title">Mes livres</h2>
          {erreurSuppression && <p className="library-error">{erreurSuppression}</p>}
          <div className="my-library-grid">
            {acces.map((a) => (
              <div key={a.id} className="book-card">
                <div className="book-card-cover-wrap">
                  <img className="book-card-cover" src={a.livre.couverture} alt={a.livre.titre} />
                  <button
                    type="button"
                    className="book-card-delete"
                    title="Supprimer ce livre"
                    aria-label="Supprimer ce livre"
                    onClick={() => supprimerLivre(a)}
                    disabled={suppressionEnCours === a.id}
                  >
                    <TrashIcon />
                  </button>
                </div>
                <div className="book-card-body">
                  <h3 className="book-card-title">{a.livre.titre}</h3>
                  {a.doit_revalider ? (
                    <>
                      <p className="revalidate-warning">Revalidation en ligne requise</p>
                      <button type="button" className="btn-outline" onClick={() => revalider(a.livre.id)} disabled={!enLigne}>
                        Revalider maintenant
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary" onClick={() => setLivreEnLecture(a.livre.id)}>
                      Lire
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {livreEnLecture && (
        <ReaderModal livreId={livreEnLecture} open={Boolean(livreEnLecture)} onClose={() => setLivreEnLecture(null)} />
      )}
      {showReaderModal && (
        <ReaderModal
          open={true}
          livreId={readerLivreId}
          documentUrl={readerDocumentUrl}
          onClose={() => { setShowReaderModal(false); setReaderDocumentUrl(null); setReaderLivreId(null); setPlayingVideoId(null); setPlayingVideoUrl(null); }}
        />
      )}

      {showVideoModal && videoModalUrl && (
        <div
          className="admin-modal-overlay"
          onMouseDown={(e) => {
            if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) {
              setShowVideoModal(false);
              setVideoModalUrl(null);
              setVideoModalTitle(null);
            }
          }}
        >
          <div className="admin-modal admin-modal-wide" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <h3>{videoModalTitle || 'Vidéo'}</h3>
            </div>
            {/(youtube|vimeo|youtu\.be|watch\?v=)/i.test(videoModalUrl) ? (
              <div className="inline-video-frame-wrap">
                <iframe title="video" src={videoModalUrl} frameBorder="0" allowFullScreen />
              </div>
            ) : (
              <RestrictedVideoPlayer
                src={videoModalUrl}
                appName="EDS"
                clientName={user?.username || ""}
                clientNumber={user?.telephone || user?.phone || user?.numero || user?.numero_whatsapp || ""}
              />
            )}
            <div className="admin-form-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setShowVideoModal(false);
                  setVideoModalUrl(null);
                  setVideoModalTitle(null);
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}