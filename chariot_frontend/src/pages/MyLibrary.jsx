import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { libraryService, purchaseService, serviceService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import RestrictedVideoPlayer from "../components/RestrictedVideoPlayer";
import "./MyLibrary.css";

const statutLabel = (statut) => {
  const s = (statut || "").toString().toLowerCase();
  if (s === "paye" || s === "payé" || s === "paid") return "Approuvé";
  if (s.includes("attente")) return "En attente d'approbation";
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

const normalizeList = (response) => {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
};

const getBookId = (purchase) => {
  const id = purchase?.livre_detail?.id ?? purchase?.livre?.id ?? purchase?.livre;
  return id == null ? null : String(id);
};

const getBookStatus = (status) => String(status || "").trim().toLowerCase();

const formatDate = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

export default function MyLibrary() {
  const [acces, setAcces] = useState([]);
  const [achats, setAchats] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreurChargement, setErreurChargement] = useState("");
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [filtre, setFiltre] = useState("tout");
  const [livreEnLecture, setLivreEnLecture] = useState(null);
  const [servicePurchases, setServicePurchases] = useState([]);
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

    const loadDashboard = async (showSpinner = false) => {
      if (showSpinner && !cancelled) setActualisation(true);
      const results = await Promise.allSettled([
        libraryService.myLibrary(),
        purchaseService.myPurchases(),
        purchaseService.myServicePurchases(),
      ]);

      if (cancelled) return;

      const failed = [];
      if (results[0].status === "fulfilled") {
        setAcces(normalizeList(results[0].value));
      } else {
        failed.push("bibliothèque");
      }
      if (results[1].status === "fulfilled") {
        setAchats(normalizeList(results[1].value));
      } else {
        failed.push("achats de livres");
      }
      if (results[2].status === "fulfilled") {
        setServicePurchases(normalizeList(results[2].value));
      } else {
        failed.push("achats de services");
      }
      setErreurChargement(
        failed.length
          ? `Impossible d'actualiser ${failed.join(", ")}. Vérifiez votre connexion puis réessayez.`
          : ""
      );
      setChargement(false);
      setActualisation(false);
    };

    loadDashboard();
    const interval = setInterval(() => {
      if (navigator.onLine) loadDashboard();
    }, 20000);

    const majStatut = () => {
      setEnLigne(navigator.onLine);
      if (navigator.onLine) loadDashboard(true);
    };
    window.addEventListener("online", majStatut);
    window.addEventListener("offline", majStatut);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", majStatut);
      window.removeEventListener("offline", majStatut);
    };
  }, []);

  const approvedBooks = useMemo(() => {
    const accessByBook = new Map();
    acces.forEach((access) => {
      const id = access?.livre?.id;
      const current = id == null ? null : accessByBook.get(String(id));
      if (
        id != null &&
        (!current || (current.doit_revalider && !access.doit_revalider))
      ) {
        accessByBook.set(String(id), access);
      }
    });

    const booksById = new Map();
    achats
      .filter((purchase) => getBookStatus(purchase.statut) === "paye")
      .forEach((purchase) => {
        const id = getBookId(purchase);
        if (!id || booksById.has(id)) return;
        const access = accessByBook.get(id);
        const book = purchase.livre_detail || access?.livre || {
          id: purchase.livre,
          titre: purchase.livre_titre || "Livre acheté",
        };
        booksById.set(id, {
          id: access?.id ?? `purchase-${purchase.id}`,
          livre: book,
          doit_revalider: Boolean(access?.doit_revalider),
          date_achat: purchase.date_achat,
        });
      });

    acces.forEach((access) => {
      const id = access?.livre?.id;
      if (id != null && !booksById.has(String(id))) {
        booksById.set(String(id), access);
      }
    });
    return Array.from(booksById.values());
  }, [achats, acces]);

  const pendingBooks = useMemo(() => {
    const approvedIds = new Set(approvedBooks.map((book) => String(book.livre.id)));
    const pendingByBook = new Map();
    achats
      .filter((purchase) => getBookStatus(purchase.statut) === "en_attente")
      .forEach((purchase) => {
        const id = getBookId(purchase);
        if (!id || approvedIds.has(id) || pendingByBook.has(id)) return;
        pendingByBook.set(id, purchase);
      });
    return Array.from(pendingByBook.values());
  }, [achats, approvedBooks]);

  const paidServiceCount = useMemo(() => {
    const paidServiceIds = new Set(
      servicePurchases
        .filter((purchase) => getBookStatus(purchase.statut) === "paye")
        .map((purchase) => String(purchase.service?.id ?? purchase.service))
    );
    return paidServiceIds.size;
  }, [servicePurchases]);

  const recharger = async () => {
    setActualisation(true);
    setErreurChargement("");
    const results = await Promise.allSettled([
      libraryService.myLibrary(),
      purchaseService.myPurchases(),
      purchaseService.myServicePurchases(),
    ]);
    if (results[0].status === "fulfilled") setAcces(normalizeList(results[0].value));
    if (results[1].status === "fulfilled") setAchats(normalizeList(results[1].value));
    if (results[2].status === "fulfilled") setServicePurchases(normalizeList(results[2].value));
    const failed = results.some((result) => result.status === "rejected");
    setErreurChargement(
      failed ? "Une partie de votre espace n'a pas pu être actualisée. Réessayez." : ""
    );
    setActualisation(false);
  };

  const revalider = async (livreId) => {
    setErreurChargement("");
    try {
      await libraryService.revalidate(livreId);
      const { data } = await libraryService.myLibrary();
      setAcces(normalizeList(data));
    } catch {
      setErreurChargement("La revalidation a échoué. Vérifiez votre connexion puis réessayez.");
    }
  };

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
      try {
        svcRes = await serviceService.getService(identifier);
      } catch {
        try {
          svcRes = await serviceService.getServices({ id: identifier });
        } catch {
          svcRes = null;
        }
      }
      const data = svcRes?.data ?? svcRes ?? null;
      const serviceObj = Array.isArray(data) ? data[0] : data;
      const doc = serviceObj?.document || serviceObj?.fichier || serviceObj?.file_url || serviceObj?.document_url;
      const video = serviceObj?.video_url || serviceObj?.video;
      if (doc) {
        setReaderDocumentUrl(doc);
        setReaderLivreId(serviceObj.id || null);
        setShowReaderModal(true);
        return;
      }
      if (video) {
        setVideoModalUrl(video);
        setVideoModalTitle(serviceObj.titre || serviceObj.title || 'Vidéo du service');
        setShowVideoModal(true);
        return;
      }
      setReaderDocumentUrl(null);
      setReaderLivreId(null);
      setShowReaderModal(true);
    } catch {
      setReaderDocumentUrl(null);
      setReaderLivreId(null);
      setShowReaderModal(true);
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

  return (
    <div className="my-library">
      <div className="library-header">
        <div>
          <p className="dashboard-eyebrow">ESPACE CLIENT</p>
          <h1 className="library-title">Bonjour {user?.first_name || user?.username || "et bienvenue"} 👋</h1>
          <p className="dashboard-subtitle">Retrouvez vos lectures, vos achats et leur statut en un seul endroit.</p>
        </div>
        <div className="dashboard-header-actions">
          <p className={`connection-status ${enLigne ? "online" : "offline"}`}>
            {enLigne ? "En ligne" : "Hors-ligne"}
          </p>
          <button type="button" className="dashboard-refresh" onClick={recharger} disabled={actualisation || !enLigne}>
            <span className={actualisation ? "refresh-icon is-spinning" : "refresh-icon"}>↻</span>
            {actualisation ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </div>

      <section className="dashboard-welcome">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-welcome-kicker">VOTRE ESPACE PERSONNEL</span>
          <h2>Tout votre parcours de lecture, simplement.</h2>
          <p>Les livres approuvés sont prêts à être lus. Les demandes en attente apparaîtront ici dès validation.</p>
        </div>
        <div className="dashboard-welcome-icon"><AccountIcon /></div>
      </section>

      <section className="dashboard-stats" aria-label="Résumé de votre compte">
        <button type="button" aria-pressed={filtre === "livres"} className={`dashboard-stat ${filtre === "livres" ? "is-selected" : ""}`} onClick={() => setFiltre(filtre === "livres" ? "tout" : "livres")}>
          <span className="dashboard-stat-icon stat-icon-green">▤</span>
          <span className="dashboard-stat-copy"><strong>{approvedBooks.length}</strong><small>Livres approuvés</small></span>
          <span className="dashboard-stat-arrow">›</span>
        </button>
        <button type="button" aria-pressed={filtre === "attente"} className={`dashboard-stat ${filtre === "attente" ? "is-selected" : ""}`} onClick={() => setFiltre(filtre === "attente" ? "tout" : "attente")}>
          <span className="dashboard-stat-icon stat-icon-amber">◷</span>
          <span className="dashboard-stat-copy"><strong>{pendingBooks.length}</strong><small>En attente d'approbation</small></span>
          <span className="dashboard-stat-arrow">›</span>
        </button>
        <button type="button" aria-pressed={filtre === "services"} className={`dashboard-stat ${filtre === "services" ? "is-selected" : ""}`} onClick={() => setFiltre(filtre === "services" ? "tout" : "services")}>
          <span className="dashboard-stat-icon stat-icon-purple">✦</span>
          <span className="dashboard-stat-copy"><strong>{paidServiceCount}</strong><small>Services approuvés</small></span>
          <span className="dashboard-stat-arrow">›</span>
        </button>
      </section>

      {erreurChargement && (
        <div className="dashboard-error" role="alert">
          <span>{erreurChargement}</span>
          <button type="button" onClick={recharger} disabled={actualisation}>Réessayer</button>
        </div>
      )}
      {chargement && <p className="library-loading">Préparation de votre espace client…</p>}

      {!chargement && !erreurChargement && approvedBooks.length === 0 && pendingBooks.length === 0 && filtre !== "services" && (
        <section className="dashboard-empty">
          <span className="dashboard-empty-icon">▤</span>
          <h2>Votre bibliothèque est prête à commencer</h2>
          <p>Vos livres achetés et vos demandes d'approbation apparaîtront ici.</p>
          <Link to="/catalogue" className="btn-primary">Découvrir le catalogue</Link>
        </section>
      )}

      {!chargement && (
        (filtre === "livres" && approvedBooks.length === 0) ||
        (filtre === "attente" && pendingBooks.length === 0) ||
        (filtre === "services" && servicePurchases.length === 0)
      ) && (
        <p className="dashboard-filter-empty">
          {filtre === "livres"
            ? "Aucun livre approuvé pour le moment."
            : filtre === "attente"
              ? "Aucune demande en attente d'approbation."
              : "Aucun achat de service pour le moment."}
          <button type="button" onClick={() => setFiltre("tout")}>Afficher tout</button>
        </p>
      )}

      {!chargement && (filtre === "tout" || filtre === "livres") && approvedBooks.length > 0 && (
        <section className="library-section dashboard-content-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">PRÊTS À LIRE</p>
              <h2 className="section-title">Mes livres approuvés <span className="section-count">{approvedBooks.length}</span></h2>
            </div>
            <p className="dashboard-section-note">Un seul exemplaire par livre, même sur plusieurs appareils.</p>
          </div>
          <div className="my-library-grid">
            {approvedBooks.map((access) => (
              <article key={access.livre.id} className="book-card">
                <div className="book-card-cover-wrap">
                  {access.livre.couverture ? (
                    <img className="book-card-cover" src={access.livre.couverture} alt={access.livre.titre} />
                  ) : (
                    <div className="book-card-cover-placeholder">EDS</div>
                  )}
                  <span className="book-approval-pill">Approuvé</span>
                </div>
                <div className="book-card-body">
                  <span className="book-card-category">{access.livre.sous_categorie || "Votre bibliothèque"}</span>
                  <h3 className="book-card-title">{access.livre.titre}</h3>
                  {access.doit_revalider ? (
                    <>
                      <p className="revalidate-warning">Revalidation en ligne requise</p>
                      <button type="button" className="btn-outline" onClick={() => revalider(access.livre.id)} disabled={!enLigne}>
                        Revalider maintenant
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary book-read-button" onClick={() => setLivreEnLecture(access.livre.id)}>
                      Lire le livre <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!chargement && (filtre === "tout" || filtre === "attente") && pendingBooks.length > 0 && (
        <section className="library-section dashboard-content-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow dashboard-eyebrow-amber">SUIVI DES DEMANDES</p>
              <h2 className="section-title">En attente d'approbation <span className="section-count pending-count">{pendingBooks.length}</span></h2>
            </div>
          </div>
          <div className="pending-book-list">
            {pendingBooks.map((purchase) => {
              const book = purchase.livre_detail || {};
              return (
                <article key={purchase.id} className="pending-book-card">
                  <div className="pending-book-cover">
                    {book.couverture ? <img src={book.couverture} alt="" /> : <span>EDS</span>}
                  </div>
                  <div className="pending-book-info">
                    <span className="pending-label"><span className="pending-pulse" /> En cours de vérification</span>
                    <h3>{book.titre || purchase.livre_titre || "Livre demandé"}</h3>
                    <p>
                      Demande envoyée{formatDate(purchase.date_achat) ? ` le ${formatDate(purchase.date_achat)}` : ""}
                      {purchase.montant ? ` · ${Number(purchase.montant).toLocaleString("fr-FR")} FCFA` : ""}
                    </p>
                  </div>
                  <div className="pending-book-status">
                    <span className="status-badge status-pending">En attente</span>
                    <small>Accès activé après validation</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!chargement && (filtre === "tout" || filtre === "services") && servicePurchases.length > 0 && (
        <section className="library-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">VOS PRESTATIONS</p>
              <h2 className="section-title">Mes achats de services</h2>
            </div>
          </div>
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
                    <div className="service-purchase-date">{formatDate(p.date_achat)}</div>
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