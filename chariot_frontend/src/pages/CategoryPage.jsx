import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { catalogService, serviceService, quotesService, purchaseService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { buildWhatsAppLink } from "../utils/Whatsapplink";
import BookCard from "../components/BookCard";
import RevealOnScroll from "../components/RevealOnScroll";
import ServiceCard from "../components/ServiceCard";
import "./Home.css";

export default function CategoryPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [servicesAchetesIds, setServicesAchetesIds] = useState(new Set());
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    catalogService
      .getCategories()
      .then((res) => {
        if (!mounted) return;
        const cats = res?.data || [];
        const found = cats.find((c) => c.slug === slug);
        setCategory(found || { slug, nom: slug });
      })
      .catch(() => setCategory({ slug, nom: slug }));

    const params = {
      categorie: slug,
      search: searchParams.get("q") || undefined,
    };

    Promise.all([catalogService.getBooks(params), serviceService.getServices(params)])
      .then(([booksRes, servicesRes]) => {
        if (!mounted) return;
        const books = booksRes?.data || [];
        const services = servicesRes?.data || [];
        const merged = [...books, ...services].sort((a, b) => {
          const da = new Date(a.date_ajout || a.created_at || 0).getTime();
          const db = new Date(b.date_ajout || b.created_at || 0).getTime();
          return db - da;
        });
        setItems(merged);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [slug, searchParams]);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setServicesAchetesIds(new Set());
      return () => { mounted = false; };
    }
    purchaseService
      .myServicePurchases()
      .then((res) => {
        if (!mounted) return;
        const payload = res?.data ?? res ?? [];
        const list = Array.isArray(payload) ? payload : [];
        const ids = list
          .filter((p) => {
            const s = (p.statut || "").toString().toLowerCase();
            return s.includes("paye") || s === "payé" || s === "paid";
          })
          .map((p) => {
            if (p.service && typeof p.service === "object") return String(p.service.id);
            return String(p.service);
          });
        setServicesAchetesIds(new Set(ids));
      })
      .catch(() => setServicesAchetesIds(new Set()));
    return () => { mounted = false; };
  }, [user]);

  const [selectedItems, setSelectedItems] = useState({});
  const [quoteForm, setQuoteForm] = useState({ client_name: "", client_email: "", client_phone: "", message: "", event_date: "", address: "", prix_estime: "" });
  const [submitting, setSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);
  const displayed = useMemo(() => items, [items]);

  const toggleSelect = (id, item) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { quantite: 1, titre: item?.titre || item?.nom || item?.name || '' };
      return next;
    });
  };

  const handleChange = (field, value) => {
    setQuoteForm((s) => ({ ...s, [field]: value }));
  };

  const handleQtyChange = (id, qty) => {
    setSelectedItems((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), quantite: Math.max(0, Number(qty) || 0) } }));
  };

  const WHATSAPP_NUMBER = '+237656877046';

  const makeWhatsAppUrl = (number, text) => buildWhatsAppLink(number, text);

  const handleSubmitQuote = async (e) => {
    e && e.preventDefault();
    setSubmitting(true);
    setQuoteResult(null);

    try {
      const selected = displayed
        .filter((it) => selectedItems.hasOwnProperty(it.id))
        .map((it) => ({
          id: it.id,
          titre: it.titre || it.nom || it.name || it.slug,
          type: it.type_categorie || (it.est_service ? 'service' : 'livre'),
          quantite: selectedItems[it.id]?.quantite || 1,
          prix: it.prix ? Number(it.prix) : (it.price ? Number(it.price) : 0),
        }));

      const itemsText = selected.length > 0
        ? selected.map(s => `- ${s.titre} (${s.type}) x${s.quantite} — ${s.prix.toLocaleString('fr-FR')} F`).join('\n')
        : 'Aucun élément sélectionné.';

      const totalPrix = selected.reduce((sum, s) => sum + ((s.prix || 0) * (s.quantite || 1)), 0);

      const formData = new FormData();
      formData.append('client_name', quoteForm.client_name || 'Anonyme');
      formData.append('client_email', quoteForm.client_email || '');
      formData.append('client_phone', quoteForm.client_phone || '');
      formData.append('message', quoteForm.message || '');
      formData.append('categorie', category && category.id ? String(category.id) : '');
      formData.append('items', JSON.stringify(selected));
      if (quoteForm.event_date) formData.append('event_date', quoteForm.event_date);
      if (quoteForm.address) formData.append('address', quoteForm.address);
      if (quoteForm.prix_estime) formData.append('prix_estime', String(quoteForm.prix_estime));

      const fileInput = document.querySelector('input[name="quote_images"]');
      if (fileInput && fileInput.files && fileInput.files.length) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('images', fileInput.files[i]);
        }
      }

      const { data } = await quotesService.createQuote(formData);

      const pdfUrl = data && data.pdf_file ? data.pdf_file : null;
      const ref = data && data.id ? `DEVIS-${data.id}` : 'DEVIS-N/A';

      let combinedMessage = `Bonjour,\n\nVeuillez trouver ci-joint une demande de devis (Réf: ${ref}) de la part de *${quoteForm.client_name}*.\n\nCatégorie: ${category ? (category.nom || category.slug) : '-'}\n\nÉléments:\n${itemsText}\n\nTotal estimé: ${totalPrix.toLocaleString('fr-FR')} F`;

      if (quoteForm.prix_estime) {
        combinedMessage += `\nPrix estimé saisi: ${Number(quoteForm.prix_estime).toLocaleString('fr-FR')} F`;
      }

      combinedMessage += `\n\nDétails:\n${quoteForm.message || '-'}\n\nCordialement,\n${quoteForm.client_name || ''}`;

      if (pdfUrl) {
        combinedMessage += `\n\nLe PDF détaillé de ce devis est disponible en pièce jointe ci-dessus, sur la page.`;
      }

      const wa = makeWhatsAppUrl(WHATSAPP_NUMBER, combinedMessage);
      setQuoteResult({ success: true, data, waUrl: wa });

      setQuoteForm({ client_name: "", client_email: "", client_phone: "", message: "", event_date: "", address: "", prix_estime: "" });
      setSelectedItems({});

    } catch (err) {
      const resp = err?.response;
      const message = resp ? (resp.data ? JSON.stringify(resp.data) : `Erreur ${resp.status}`) : (err.message || 'Erreur lors de l\'envoi du devis');
      setQuoteResult({ success: false, error: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <div className="catalog-header-copy">
          <span className="eyebrow">Catalogue</span>
          <h1>{category ? `${category.nom}` : "Catégorie"}</h1>
          <p>Tous les éléments disponibles pour {category ? category.nom : slug}.</p>
        </div>
      </header>

      {loading && <div className="catalog-state">Chargement…</div>}
      {!loading && displayed.length === 0 && (
        <div className="catalog-state catalog-empty">Aucun élément trouvé dans cette catégorie.</div>
      )}

      {!loading && displayed.length > 0 && (
        <div className="catalog-grid">
          {displayed.map((it, idx) => (
            <RevealOnScroll key={it.id} delai={(idx % 8) * 60}>
              <div className="catalog-grid-item-with-checkbox">
                <label className="item-select-checkbox">
                  <input type="checkbox" checked={selectedItems.hasOwnProperty(it.id)} onChange={() => toggleSelect(it.id, it)} />
                </label>
                {it.type_categorie === "service" ? (
                  <ServiceCard livre={it} achete={servicesAchetesIds.has(String(it.id))} />
                ) : (
                  <BookCard livre={it} />
                )}
              </div>
            </RevealOnScroll>
          ))}
        </div>
      )}

      {category && (() => {
        const name = (category.nom || '').toString();
        const normalized = name.normalize ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : name.toLowerCase();
        const isHotellerie = category.slug === 'hotellerie' || category.slug === '1er-cycle' || normalized.includes('hotellerie') || normalized.includes('hotel');
        return isHotellerie ? (
          <section className="catalog-quote-panel">
            <h2>Demande de devis</h2>
            <p>Remplissez ce formulaire pour envoyer votre demande à l'administrateur. Vous pouvez sélectionner un ou plusieurs éléments ci-dessous et ajouter des détails.</p>
            <div>
              <form onSubmit={handleSubmitQuote} className="quote-form">
                <label>
                  Nom
                  <input type="text" value={quoteForm.client_name} onChange={(e) => handleChange('client_name', e.target.value)} placeholder="Votre nom" />
                </label>
                <label>
                  Email
                  <input type="email" value={quoteForm.client_email} onChange={(e) => handleChange('client_email', e.target.value)} placeholder="Votre email" />
                </label>
                <label>
                  Téléphone
                  <input type="tel" value={quoteForm.client_phone} onChange={(e) => handleChange('client_phone', e.target.value)} placeholder="Votre téléphone" />
                </label>
                <label>
                  Détails / message
                  <textarea value={quoteForm.message} onChange={(e) => handleChange('message', e.target.value)} rows="5" placeholder="Décrivez votre besoin..." />
                </label>
                <label>
                  Prix estimé (optionnel, FCFA)
                  <input type="number" min="0" value={quoteForm.prix_estime} onChange={(e) => handleChange('prix_estime', e.target.value)} placeholder="Ex: 250000" />
                </label>
                <label>
                  Date souhaitée
                  <input type="date" value={quoteForm.event_date} onChange={(e) => handleChange('event_date', e.target.value)} />
                </label>
                <label>
                  Adresse / lieu
                  <input type="text" value={quoteForm.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Adresse ou lieu de livraison" />
                </label>
                <label>
                  Photos de référence (optionnel)
                  <input type="file" name="quote_images" accept="image/*" multiple />
                </label>
                <div className="quote-actions">
                  <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Envoi…' : 'Envoyer la demande'}</button>
                  <button type="button" className="btn-outline" onClick={() => { setQuoteForm({ client_name: '', client_email: '', client_phone: '', message: '', event_date: '', address: '', prix_estime: '' }); setSelectedItems({}); }}>Réinitialiser</button>
                </div>
              </form>

              {quoteResult && quoteResult.success && (
                <div className="admin-alert admin-alert-success">
                  Demande envoyée avec succès.
                  {quoteResult.data && quoteResult.data.pdf_file && (
                    <span> <a href={quoteResult.data.pdf_file} target="_blank" rel="noreferrer">Télécharger le PDF</a></span>
                  )}
                  {quoteResult.waUrl && (
                    <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
                      <a href={quoteResult.waUrl} target="_blank" rel="noreferrer" className="btn-primary">Ouvrir WhatsApp</a>
                      <input readOnly value={quoteResult.waUrl} style={{flex:1, padding:'0.5rem', borderRadius:8, border:'1px solid var(--line)'}} />
                      <button type="button" className="btn-outline" onClick={async () => { try { await navigator.clipboard.writeText(quoteResult.waUrl); alert('Lien WhatsApp copié'); } catch (e) { alert('Impossible de copier'); } }}>Copier le lien</button>
                    </div>
                  )}
                </div>
              )}
              {quoteResult && !quoteResult.success && (
                <div className="admin-alert admin-alert-error">Erreur : {String(quoteResult.error)}</div>
              )}
            </div>

            <aside className="selected-summary">
              <h3>Sélection</h3>
              {Object.keys(selectedItems).length === 0 ? (
                <div className="empty">Aucun élément sélectionné.</div>
              ) : (
                <ul>
                  {displayed.filter((it) => selectedItems.hasOwnProperty(it.id)).map((it) => (
                    <li key={it.id} style={{display:'flex', alignItems:'center', gap:8}}>
                      <div className="thumb" style={{width:64, height:64}}>
                        {it.couverture ? <img src={it.couverture} alt={it.titre} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',background:'#eee'}} />}
                      </div>
                      <div className="title">{it.titre}</div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <label style={{display:'flex', alignItems:'center', gap:6}}>
                          Qté
                          <input type="number" value={selectedItems[it.id]?.quantite || 1} min={0} style={{width:64}} onChange={(e) => handleQtyChange(it.id, e.target.value)} />
                        </label>
                        <button type="button" className="btn-outline" onClick={() => toggleSelect(it.id, it)} style={{marginLeft:8}}>Retirer</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </section>
        ) : null;
      })()}
    </div>
  );
}