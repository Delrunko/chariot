import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import { loadWithOfflineSnapshot } from "../lib/offlineData";
import { createOrder } from "../services/orderService";
import { useAuth } from "../context/AuthContext";
import ReaderModal from "../components/ReaderModal";
import PaymentInstructions from "../components/PaymentInstructions";
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
  const paymentForm = { moyen_paiement: "orange_money" };
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasPaid, setHasPaid] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [videoAccessUrl, setVideoAccessUrl] = useState("");
  const [showReaderModal, setShowReaderModal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadService = async () => {
      setLivre(null);
      setSelectedImage(0);
      try {
        const service = await loadWithOfflineSnapshot(`service-detail:${slug}`, async () => {
          const { data, error } = await supabase
            .from("services")
            .select(`
              id, title, slug, description, price, cover_path, document_path,
              video_path, video_url, whatsapp_phone, available, subcategories(name, categories(name)),
              service_images(image_path, sort_order)
            `)
            .eq("slug", slug)
            .maybeSingle();
          if (error) throw error;
          return data;
        });
        if (!service) {
          const { data: book, error: bookError } = await supabase
            .from("books")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (bookError) throw bookError;
          if (book) {
            if (!cancelled) navigate(`/livre/${slug}`, { replace: true });
            return;
          }
          if (!cancelled) setLivre(false);
          return;
        }

        const subcategory = Array.isArray(service.subcategories)
          ? service.subcategories[0]
          : service.subcategories;
        const categoryValue = subcategory?.categories;
        const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
        if (!cancelled) {
          setLivre({
            id: service.id,
            titre: service.title,
            slug: service.slug,
            description: service.description,
            prix: service.price,
            couverture: getStoragePublicUrl("covers", service.cover_path),
            sous_categorie: subcategory?.name || category?.name || "Service",
            document: service.document_path,
            video: service.video_path,
            video_url: service.video_url,
            whatsapp_phone: service.whatsapp_phone,
            images: (service.service_images || [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((image) => getStoragePublicUrl("covers", image.image_path))
              .filter(Boolean),
          });
        }
      } catch (error) {
        console.error("Impossible de charger le service depuis Supabase.", error);
        if (!cancelled) setLivre(false);
      }
    };

    void loadService();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  useEffect(() => {
    if (!user?.id || !livre?.id) {
      setHasPaid(false);
      setPurchaseInfo(null);
      setShowContent(false);
      return undefined;
    }
    let mounted = true;
    let intervalId = null;

    const checkPurchases = async () => {
      try {
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, status, transaction_reference, purchased_at")
          .eq("user_id", user.id)
          .eq("service_id", livre.id)
          .maybeSingle();
        if (error) throw error;

        if (order) {
          const paid = order.status === "paye";
          if (mounted) {
            setHasPaid(paid);
            setPurchaseInfo({
              ...order,
              statut: order.status,
              date_achat: order.purchased_at,
              reference_transaction: order.transaction_reference,
            });
            setShowContent(paid);
          }
        } else {
          if (mounted) {
            setHasPaid(false);
            setPurchaseInfo(null);
            setShowContent(false);
          }
        }
      } catch (error) {
        console.error("Impossible de vérifier la commande du service.", error);
      }
    };

    checkPurchases();
    intervalId = setInterval(checkPurchases, 10000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, livre?.id]);

  useEffect(() => {
    let active = true;
    setVideoAccessUrl("");
    if (!hasPaid || !livre?.video) return () => { active = false; };
    if (/^https?:/i.test(livre.video)) {
      setVideoAccessUrl(livre.video);
      return () => { active = false; };
    }

    supabase.storage
      .from("media")
      .createSignedUrl(livre.video, 3600)
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setVideoAccessUrl(data.signedUrl);
      })
      .catch((error) => {
        console.error("Impossible de créer le lien temporaire de la vidéo.", error);
        if (active) setErreur("La vidéo ne peut pas être chargée pour le moment.");
      });

    return () => { active = false; };
  }, [hasPaid, livre?.video]);

  const galleryImages = useMemo(() => {
    if (!livre) return [];
    const extra = Array.isArray(livre.images)
      ? livre.images.map((image) => typeof image === "string" ? image : image?.image || image?.url || image?.src).filter(Boolean)
      : [];
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
    setErreur("");
    setConfirmation("");
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setAchatEnCours(true);
    setErreur("");
    setConfirmation("");

    try {
      const order = await createOrder({
        serviceId: livre.id,
        paymentMethod: paymentForm.moyen_paiement,
      });
      setConfirmation(
        `Paiement initié (commande ${order.orderId}). Effectuez le dépôt au numéro indiqué; votre accès sera activé après vérification.`,
      );
    } catch (err) {
      console.error("Impossible d'enregistrer la commande du service.", err);
      setErreur(err instanceof Error ? err.message : "Impossible d'initier l'achat. Réessayez.");
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
            Acheter 
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
            
            {livre.video && videoAccessUrl && (
              <div className="video-wrapper">
                <video
                  src={videoAccessUrl}
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
        <ReaderModal open={true} serviceId={livre.id || null} onClose={() => setShowReaderModal(false)} />
      )}

      {showPaymentModal && (
        <div className="admin-modal-overlay animate__animated animate__fadeIn" onMouseDown={(e) => { if (e.target.classList && e.target.classList.contains('admin-modal-overlay')) { setShowPaymentModal(false); setConfirmation(""); setErreur(""); } }}>
          <div className="admin-modal animate__animated animate__fadeInUp" role="dialog" aria-modal="true" aria-labelledby="service-payment-title">
            <h3 id="service-payment-title">Paiement — {livre.titre}</h3>
            {confirmation && <div className="admin-alert admin-alert-success">{confirmation}</div>}
            {erreur && <div className="admin-alert admin-alert-error">{erreur}</div>}
            <form onSubmit={submitPayment}>
              <div className="admin-alert admin-alert-warning" style={{ marginBottom: 12 }}>
                NB: évitez de valider la transaction si ce n'est pas le nom ci-dessous qui s'affiche <strong>DOMBOU TAMU Fernando Jordan</strong>
              </div>

              <PaymentInstructions
                amount={livre.prix}
              />

              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button type="submit" className="btn-primary" disabled={achatEnCours || Boolean(confirmation)}>{achatEnCours ? 'Initialisation…' : confirmation ? 'Paiement initié' : "Initier le paiement"}</button>
                <button type="button" className="btn-outline" onClick={() => { setShowPaymentModal(false); setConfirmation(""); setErreur(""); }}>Fermer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}