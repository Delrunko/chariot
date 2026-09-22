import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { catalogService, serviceService, purchaseService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import "./BookDetail.css";

export default function ServiceDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [livre, setLivre] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);

  // Payment state
  const [achatEnCours, setAchatEnCours] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ moyen_paiement: "orange_money", payer_phone: "", reference_transaction: "" });
  const [paymentErrors, setPaymentErrors] = useState(null);
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasPaid, setHasPaid] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showReaderModal, setShowReaderModal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLivre(null);
    setSelectedImage(0);

    serviceService
      .getService(slug)
      .then(({ data }) => {
        if (!cancelled) setLivre(data);
      })
      .catch(() => {
        if (cancelled) return;
        catalogService
          .getBook(slug)
          .then(({ data }) => {
            if (!cancelled) setLivre(data);
          })
          .catch(() => {
            if (!cancelled) setLivre(false);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!user) return undefined;
    let mounted = true;
    let intervalId = null;

    const checkPurchases = async () => {
      try {
        const res = await purchaseService.myServicePurchases();
        const payload = res?.data ?? res;
        const purchases = Array.isArray(payload) ? payload : [];
        const found = purchases.find((p) => {
          const sid = p.service?.id ?? p.service;
          return sid === (livre?.id ?? null) || sid === livre;
        });

        if (found) {
          const statut = (found.statut || "").toString().toUpperCase();
          const paid = statut === "PAYE" || statut === "PAID";
          if (mounted) {
            setHasPaid(paid);
            setPurchaseInfo(found);
          }

          if (paid) {
            if (livre && (!livre.document && !livre.video && !livre.video_url)) {
              const { data } = await serviceService.getService(slug);
              if (mounted) setLivre(data);
            }
            if (mounted) setShowContent(true);
          }
        } else {
          if (mounted) {
            setHasPaid(false);
            setPurchaseInfo(null);
          }
        }
      } catch (e) {
        // silent
      }
    };

    checkPurchases();
    intervalId = setInterval(checkPurchases, 10000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, livre?.id, slug]);

  const galleryImages = useMemo(() => {
    if (!livre) return [];
    const extra = Array.isArray(livre.images) ? livre.images.map((img) => img?.image || img?.url || img?.src).filter(Boolean) : [];
    const cover = livre.couverture ? [livre.couverture] : [];
    const merged = [...cover, ...extra];
    return [...new Map(merged.map((url) => [url, url])).values()];
  }, [livre]);

  useEffect(() => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev >= galleryImages.length ? 0 : prev));
  }, [galleryImages]);

  if (livre === null) return <p className="book-detail-loading">Chargement…</p>;
  if (livre === false) return <p className="book-detail-loading">Service introuvable.</p>;

  const acheter = () => {
    if (!user) {
      navigate('/connexion');
      return;
    }
    setPaymentErrors(null);
    setErreur("");
    setConfirmation("");
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setAchatEnCours(true);
    setPaymentErrors(null);
    setErreur("");
    setConfirmation("");

    try {
      await purchaseService.buyService(
        livre.id,
        paymentForm.moyen_paiement,
        paymentForm.reference_transaction || ""
      );

      setConfirmation('Demande de paiement enregistrée. L\'admin doit confirmer avant de débloquer le PDF et la vidéo.');
      setTimeout(() => {
        navigate('/ma-bibliotheque');
      }, 1800);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setPaymentErrors(data);
        const flat = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setErreur(flat || "Impossible d'initier l'achat. Réessayez.");
      } else if (typeof data === 'string') {
        setErreur(data || "Impossible d'initier l'achat. Réessayez.");
      } else {
        setErreur("Impossible d'initier l'achat. Réessayez.");
      }
    } finally {
      setAchatEnCours(false);
    }
  };

  const hasGatedContent = Boolean(livre.document || livre.video_url || livre.video);

  return (
    <div className="service-detail">
      {/* ==========================================
          COLONNE GAUCHE : GALERIE
          ========================================== */}
      <div className="detail-visuals">
        {galleryImages.length > 0 && (
          <>
            <div className="main-and-badge">
              <img
                src={galleryImages[selectedImage] || livre.couverture}
                alt={livre.titre}
                className="gallery-main-img"
              />
              <span className="image-count">{selectedImage + 1} / {galleryImages.length}</span>
            </div>

            <div className="thumbnails">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={`thumb-btn ${selectedImage === index ? "thumb-active" : ""}`}
                  onClick={() => setSelectedImage(index)}
                  aria-label={`Voir l'image ${index + 1}`}
                >
                  <img src={image} alt={`${livre.titre} ${index + 1}`} className="thumb-img" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ==========================================
          COLONNE DROITE : INFOS, BOUTON, PUIS VIDÉO
          ========================================== */}
      <div className="detail-info">
        <span className="detail-category">{livre.sous_categorie}</span>
        <h1 className="detail-title">{livre.titre}</h1>

        <div className="detail-price">
          {Number(livre.prix).toLocaleString("fr-FR")} FCFA
        </div>

        <p className="detail-description">{livre.description}</p>

        {purchaseInfo && (
          <div className="client-info-card">
            <div className="client-info-row">
              <div>
                <div className="client-info-name">
                  {purchaseInfo.utilisateur_username || (purchaseInfo.utilisateur && purchaseInfo.utilisateur.username) || 'Vous'}
                </div>
                {purchaseInfo.reference_transaction && (
                  <div className="client-info-ref">Réf: {purchaseInfo.reference_transaction}</div>
                )}
              </div>
              <div className="client-info-status">
                <div className="client-info-date">
                  {purchaseInfo.date_achat ? new Date(purchaseInfo.date_achat).toLocaleString() : ''}
                </div>
                <div className="client-info-badge">
                  {((purchaseInfo.statut || '').toString().toLowerCase().includes('paye')) ? 'Payé' : (purchaseInfo.statut || '')}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasPaid ? (
          <button
            className="btn-primary"
            onClick={() => setShowReaderModal(true)}
          >
            Lire
          </button>
        ) : (
          <button className="btn-primary" onClick={acheter}>
            Acheter via Orange Money
          </button>
        )}

        {/* ==========================================
            VIDÉO PROTÉGÉE (LECTURE ET SON AUTORISÉS)
            ========================================== */}
        {showContent && hasGatedContent && (
          <div className="detail-video-protected">
            {livre.video_url && (
              <div className="video-wrapper">
                <iframe
                  title="video"
                  // controls=1 permet la lecture, modestbranding et rel=0 limitent les options externes
                  src={`${livre.video_url}?controls=1&modestbranding=1&rel=0`}
                  className="detail-video-frame"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen={false}
                />
              </div>
            )}
            
            {livre.video && (
              <div className="video-wrapper">
                <video
                  src={livre.video}
                  className="detail-video-native"
                  controls // Affiche lecture, pause, barre de progression et volume
                  controlsList="nodownload" // Supprime le bouton de téléchargement (Chrome/Edge/Opera)
                  disablePictureInPicture // Supprime le bouton "Image dans l'image"
                  onContextMenu={(e) => e.preventDefault()} // Bloque le menu du clic droit
                  onDragStart={(e) => e.preventDefault()} // Empêche de glisser la vidéo pour l'enregistrer
                  playsInline
                />
              </div>
            )}

            {livre.document && (
              <button 
                className="btn-outline detail-doc-btn" 
                onClick={() => setShowReaderModal(true)}
                style={{ marginTop: '1rem' }}
              >
                Ouvrir le document (PDF)
              </button>
            )}
          </div>
        )}

        {showContent && !hasGatedContent && (
          <p className="detail-content-pending">
            Le contenu sera disponible une fois que votre achat aura été confirmé par l'administrateur.
          </p>
        )}
      </div>

      {showReaderModal && (
        <ReaderModal open={true} livreId={livre.id || null} documentUrl={livre.document || null} onClose={() => setShowReaderModal(false)} />
      )}

      {showPaymentModal && (
        <div className="admin-modal-overlay" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowPaymentModal(false); setPaymentErrors(null); } }}>
          <div className="admin-modal" role="dialog" aria-modal="true">
            <h3>PAIEMENT — {livre.titre}</h3>
            {confirmation && <div className="admin-alert admin-alert-success">{confirmation}</div>}
            {erreur && <div className="admin-alert admin-alert-error">{erreur}</div>}
            <form onSubmit={submitPayment}>
              <label>
                Moyen de paiement
                <select value={paymentForm.moyen_paiement} onChange={(e) => setPaymentForm({ ...paymentForm, moyen_paiement: e.target.value })}>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                </select>
                {paymentErrors?.moyen_paiement && <div className="field-error">{Array.isArray(paymentErrors.moyen_paiement) ? paymentErrors.moyen_paiement.join(', ') : paymentErrors.moyen_paiement}</div>}
              </label>

              <label>
                Numéro de téléphone (utilisé pour le paiement)
                <input value={paymentForm.payer_phone} onChange={(e) => setPaymentForm({ ...paymentForm, payer_phone: e.target.value })} placeholder="Ex: 221770000000" />
              </label>

              <label>
                Référence transaction (optionnelle)
                <input value={paymentForm.reference_transaction} onChange={(e) => setPaymentForm({ ...paymentForm, reference_transaction: e.target.value })} placeholder="Référence fournie par l'opérateur" />
                {paymentErrors?.reference_transaction && <div className="field-error">{Array.isArray(paymentErrors.reference_transaction) ? paymentErrors.reference_transaction.join(', ') : paymentErrors.reference_transaction}</div>}
              </label>

              <div style={{marginTop:12, marginBottom:6}}>
                <strong>Instructions de paiement</strong>
                <p style={{margin:'6px 0 8px', color:'#444'}}>Copiez le code ci-dessous et composez-le depuis votre téléphone pour effectuer le paiement manuellement.</p>
                {(() => {
                  const merchantCode = '000000';
                  const merchantNumber = '656877046';
                  const price = livre ? Number(livre.prix || 0) : 0;
                  const ussd = paymentForm.moyen_paiement === 'orange_money'
                    ? `#150*14*${merchantCode}*${merchantNumber}*${price}#`
                    : `*126*14*${merchantCode}*${merchantNumber}*${price}#`;
                  return (
                    <div>
                      <input readOnly value={ussd} style={{width:'100%', padding:'0.7rem', borderRadius:8, border:'1px solid var(--line)', fontWeight:700}} />
                      <div style={{display:'flex', gap:8, marginTop:8}}>
                        <button type="button" className="btn-primary" onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(ussd);
                            setErreur('Code copié dans le presse-papier.');
                            setTimeout(() => setErreur(''), 3000);
                          } catch (e) {
                            setErreur('Impossible de copier — veuillez copier manuellement.');
                          }
                        }}>Copier le code</button>
                        <button type="button" className="btn-outline" onClick={() => {
                          const tel = `tel:${encodeURIComponent(ussd)}`;
                          window.location.href = tel;
                        }}>
                          Composer
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button type="submit" className="btn-primary" disabled={achatEnCours}>{achatEnCours ? 'Paiement en cours…' : 'Initier le paiement'}</button>
                <button type="button" className="btn-outline" onClick={() => { setShowPaymentModal(false); setPaymentErrors(null); setConfirmation(""); setErreur(""); }}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}