import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { catalogService, purchaseService, serviceService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import "./BookDetail.css"; // Assurez-vous que le nouveau CSS est ici
import "./AdminDashboard.css"; // Réutilisation des styles du modal

export default function BookDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [livre, setLivre] = useState(null);
  const [achatEnCours, setAchatEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [lectureOuverte, setLectureOuverte] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ 
    moyen_paiement: "orange_money", 
    payer_phone: "", 
    reference_transaction: "" 
  });
  const [paymentErrors, setPaymentErrors] = useState(null);

  useEffect(() => {
    setLivre(null);
    setLectureOuverte(false);
    let cancelled = false;

    catalogService
      .getBook(slug)
      .then(({ data }) => {
        if (cancelled) return;
        setLivre(data);
      })
      .catch(() => {
        if (cancelled) return;
        serviceService
          .getService(slug)
          .then(() => {
            if (cancelled) return;
            navigate(`/service/${slug}`);
          })
          .catch(() => {
            if (cancelled) return;
            setLivre(false);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  const acheter = () => {
    if (!user) {
      navigate("/connexion");
      return;
    }
    setPaymentErrors(null);
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setAchatEnCours(true);
    setPaymentErrors(null);

    try {
      const payload = {
        livre: livre.id,
        moyen_paiement: paymentForm.moyen_paiement,
        reference_transaction: paymentForm.reference_transaction || "",
      };

      await purchaseService.create(payload);
      navigate("/ma-bibliotheque");
    } catch (err) {
      const data = err?.response?.data || err?.response?.data;
      if (data && typeof data === "object") {
        setPaymentErrors(data);
        const flat = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setErreur(flat);
      } else {
        setErreur("Impossible d'initier l'achat. Réessayez.");
      }
    } finally {
      setAchatEnCours(false);
      setShowPaymentModal(false);
    }
  };

  if (livre === null) return <p className="book-detail-loading">Chargement en cours…</p>;
  if (livre === false) return <p className="book-detail-loading">Livre ou service introuvable.</p>;

  return (
    <div className="book-detail">
      
      {/* ==========================================
          COLONNE GAUCHE : EXPÉRIENCE VISUELLE
          ========================================== */}
      <div className="detail-visuals">
        <div className="main-and-badge">
          <img 
            src={livre.couverture} 
            alt={livre.titre} 
            className="gallery-main-img" 
          />
          {/* Badge optionnel : à adapter si vous avez un tableau d'images dans votre API */}
          <span className="image-count">1 / 1</span>
        </div>
        
        {/* Section Miniatures (À adapter si livre.images existe) */}
        <div className="thumbnails">
          <button className="thumb-btn thumb-active">
            <img src={livre.couverture} alt="Couverture principale" className="thumb-img" />
          </button>
          {/* Exemple si vous avez d'autres images : 
              {livre.images?.map((img, index) => (
                <button key={index} className="thumb-btn">
                  <img src={img.url} alt={`Vue ${index + 1}`} className="thumb-img" />
                </button>
              ))} 
          */}
        </div>
      </div>

      {/* ==========================================
          COLONNE DROITE : INFOS & ACHAT (STICKY)
          ========================================== */}
      <div className="detail-info">
        <div className="purchase-card">
          <span className="detail-category">{livre.sous_categorie || "Livre"}</span>
          
          <h1 className="detail-title">{livre.titre}</h1>
          
          <div className="detail-price">
            {Number(livre.prix).toLocaleString("fr-FR")} FCFA
          </div>

          {erreur && <p className="book-detail-error">{erreur}</p>}

          <p className="detail-description">
            {livre.description || "Aucune description disponible pour ce livre."}
          </p>

          {/* Boutons d'action avec icônes Font Awesome */}
          {livre.deja_achete ? (
            <button className="btn-primary" onClick={() => setLectureOuverte(true)}>
              <i className="fas fa-book-open"></i> Lire ce livre
            </button>
          ) : (
            <button className="btn-primary" onClick={acheter} disabled={achatEnCours}>
              <i className="fas fa-mobile-alt"></i> 
              {achatEnCours ? "Paiement en cours…" : "Acheter via Mobile Money"}
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          MODALS (Lecture & Paiement)
          ========================================== */}
      {livre.deja_achete && (
        <ReaderModal 
          livreId={livre.id} 
          open={lectureOuverte} 
          onClose={() => setLectureOuverte(false)} 
        />
      )}

      {showPaymentModal && (
        <div 
          className="admin-modal-overlay" 
          onMouseDown={(e) => { 
            if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { 
              setShowPaymentModal(false); 
              setPaymentErrors(null); 
            } 
          }}
        >
          <div className="admin-modal" role="dialog" aria-modal="true">
            <h3>Paiement — {livre.titre}</h3>
            {erreur && <div className="admin-alert admin-alert-error">{erreur}</div>}
            
            <form onSubmit={submitPayment}>
              <label>
                Moyen de paiement
                <select 
                  value={paymentForm.moyen_paiement} 
                  onChange={(e) => setPaymentForm({ ...paymentForm, moyen_paiement: e.target.value })}
                >
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                </select>
                {paymentErrors?.moyen_paiement && (
                  <div className="field-error">
                    {Array.isArray(paymentErrors.moyen_paiement) ? paymentErrors.moyen_paiement.join(', ') : paymentErrors.moyen_paiement}
                  </div>
                )}
              </label>

              <label>
                Numéro de téléphone (utilisé pour le paiement)
                <input 
                  value={paymentForm.payer_phone} 
                  onChange={(e) => setPaymentForm({ ...paymentForm, payer_phone: e.target.value })} 
                  placeholder="Ex: 221770000000" 
                />
              </label>

              <label>
                Référence transaction (optionnelle)
                <input 
                  value={paymentForm.reference_transaction} 
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_transaction: e.target.value })} 
                  placeholder="Référence fournie par l'opérateur" 
                />
                {paymentErrors?.reference_transaction && (
                  <div className="field-error">
                    {Array.isArray(paymentErrors.reference_transaction) ? paymentErrors.reference_transaction.join(', ') : paymentErrors.reference_transaction}
                  </div>
                )}
              </label>

              {/* Bloc d'instructions USSD */}
              <div style={{marginTop: 12, marginBottom: 6}}>
                <strong>Instructions de paiement</strong>
                <p style={{margin: '6px 0 8px', color: '#444'}}>
                  Copiez le code ci-dessous et composez-le depuis votre téléphone pour effectuer le paiement manuellement.
                </p>
                {(() => {
                  const merchantCode = '000000';
                  const merchantNumber = '656877046';
                  const price = livre ? Number(livre.prix || 0) : 0;
                  const ussd = paymentForm.moyen_paiement === 'orange_money'
                    ? `#150*14*${merchantCode}*${merchantNumber}*${price}#`
                    : `*126*14*${merchantCode}*${merchantNumber}*${price}#`;
                  
                  return (
                    <div>
                      <input 
                        readOnly 
                        value={ussd} 
                        style={{width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--line)', fontWeight: 700}} 
                      />
                      <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(ussd);
                              setErreur('Code copié dans le presse-papier.');
                              setTimeout(() => setErreur(''), 3000);
                            } catch (e) {
                              setErreur('Impossible de copier — veuillez copier manuellement.');
                            }
                          }}
                        >
                          <i className="fas fa-copy"></i> Copier le code
                        </button>
                        <button 
                          type="button" 
                          className="btn-outline" 
                          onClick={() => {
                            const tel = `tel:${encodeURIComponent(ussd)}`;
                            window.location.href = tel;
                          }}
                        >
                          <i className="fas fa-phone"></i> Composer
                        </button>
                      </div>
                      <small style={{display: 'block', marginTop: 8, color: '#555'}}>
                        Si votre téléphone ne prend pas en charge la composition automatique, copiez-collez le code dans l'application d'appel et validez.
                      </small>
                    </div>
                  );
                })()}
              </div>

              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={achatEnCours}>
                  {achatEnCours ? "Envoi en cours..." : "Initier le paiement"}
                </button>
                <button 
                  type="button" 
                  className="btn-outline" 
                  onClick={() => { setShowPaymentModal(false); setPaymentErrors(null); }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}