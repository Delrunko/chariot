import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getStoragePublicUrl } from "../lib/storageAssets";
import { createQuote } from "../services/quoteService";
import { buildWhatsAppLink } from "../utils/whatsappLink";
import BookCard from "../components/BookCard";
import RevealOnScroll from "../components/RevealOnScroll";
import ServiceCard from "../components/ServiceCard";
import "./Home.css";
import "./CategoryPage.css";

const categoryItemRelations = `
  subcategories!inner (
    id,
    name,
    slug,
    active,
    categories!inner (
      id,
      name,
      slug,
      category_type,
      active
    )
  )
`;

const relationRecord = (value) => (Array.isArray(value) ? value[0] : value);

function mapCategoryItem(item, type) {
  const subcategory = relationRecord(item.subcategories);
  const category = relationRecord(subcategory?.categories);

  return {
    id: item.id,
    titre: item.title,
    slug: item.slug,
    description: item.description,
    prix: item.price,
    couverture: getStoragePublicUrl("covers", item.cover_path),
    date_ajout: item.added_at,
    categorie: category?.name ?? "",
    sous_categorie: subcategory?.name ?? "",
    type_categorie: type,
    ...(type === "service"
      ? {
          document: item.document_path,
          video: item.video_path,
          video_url: item.video_url,
          whatsapp_phone: item.whatsapp_phone,
        }
      : {}),
  };
}

function formatCategoryName(slug) {
  return (slug || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("fr-FR") + word.slice(1))
    .join(" ");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CategoryPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [category, setCategory] = useState(null);
  const [servicesAchetesIds, setServicesAchetesIds] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);

    const loadCategory = async () => {
      const [categoryResult, booksResult, servicesResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug")
          .eq("slug", slug)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("books")
          .select(`
            id,
            title,
            slug,
            description,
            price,
            cover_path,
            added_at,
            ${categoryItemRelations}
          `)
          .eq("available", true)
          .eq("subcategories.categories.slug", slug)
          .eq("subcategories.active", true)
          .eq("subcategories.categories.active", true)
          .order("added_at", { ascending: false }),
        supabase
          .from("services")
          .select(`
            id,
            title,
            slug,
            description,
            price,
            cover_path,
            document_path,
            video_path,
            video_url,
            whatsapp_phone,
            added_at,
            ${categoryItemRelations}
          `)
          .eq("available", true)
          .eq("subcategories.categories.slug", slug)
          .eq("subcategories.active", true)
          .eq("subcategories.categories.active", true)
          .order("added_at", { ascending: false }),
      ]);

      const failedResult = [categoryResult, booksResult, servicesResult].find(
        (result) => result.error,
      );
      if (failedResult?.error) {
        throw new Error(failedResult.error.message);
      }

      const books = (booksResult.data ?? []).map((book) =>
        mapCategoryItem(book, "livre"),
      );
      const services = (servicesResult.data ?? []).map((service) =>
        mapCategoryItem(service, "service"),
      );
      const term = (searchParams.get("q") || "").trim().toLocaleLowerCase("fr-FR");
      const merged = [...books, ...services]
        .filter((item) => {
          if (!term) return true;
          return [item.titre, item.description, item.sous_categorie]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("fr-FR")
            .includes(term);
        })
        .sort((a, b) => new Date(b.date_ajout || 0) - new Date(a.date_ajout || 0));

      if (mounted) {
        const foundCategory = categoryResult.data;
        setCategory(
          foundCategory
            ? { ...foundCategory, nom: foundCategory.name }
            : { slug, nom: formatCategoryName(slug) },
        );
        setItems(merged);
      }
    };

    loadCategory()
      .catch((error) => {
        if (mounted) {
          setItems([]);
          setLoadError(
            error instanceof TypeError
              ? "Connexion à Supabase impossible. Vérifiez l'URL du projet et votre connexion."
              : error instanceof Error
                ? error.message
                : "Impossible de charger cette catégorie depuis Supabase.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug, searchParams]);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;

    const loadPaidServiceOrders = async (userId) => {
      const currentRequestId = ++requestId;
      if (!userId) {
        if (mounted) setServicesAchetesIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("service_id")
        .eq("user_id", userId)
        .eq("status", "paye")
        .not("service_id", "is", null);

      if (error) {
        console.error("Impossible de charger les achats de services depuis Supabase.", error);
        if (mounted && currentRequestId === requestId) {
          setServicesAchetesIds(new Set());
        }
        return;
      }

      if (mounted && currentRequestId === requestId) {
        setServicesAchetesIds(
          new Set((data ?? []).map((order) => String(order.service_id))),
        );
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Impossible de vérifier la session Supabase.", error);
        return loadPaidServiceOrders(null);
      }
      return loadPaidServiceOrders(data.session?.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void loadPaidServiceOrders(session?.user.id ?? null);
      }, 0);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const [selectedItems, setSelectedItems] = useState({});
  const [quoteForm, setQuoteForm] = useState({ client_name: "", client_email: "", client_phone: "", message: "", event_date: "", address: "", prix_estime: "" });
  const [submitting, setSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);
  const displayed = useMemo(() => items, [items]);
  const [minimumQuoteDate] = useState(() => formatLocalDate(new Date()));

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
    e.preventDefault();
    const formElement = e.currentTarget;
    if (quoteForm.event_date && quoteForm.event_date < formatLocalDate(new Date())) {
      setQuoteResult({
        success: false,
        error: "La date souhaitée doit être aujourd'hui ou une date future.",
      });
      return;
    }

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

      const selectedFiles = Array.from(
        formElement.querySelector('input[name="quote_images"]')?.files ?? [],
      );
      const paths = [];
      for (const f of selectedFiles) {
        const p = `${Date.now()}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("quote-images").upload(p, f);
        if (upErr) {
          console.error("UPLOAD KO", upErr);
          throw upErr;
        }
        paths.push(p);
      }

      const data = await createQuote({
        client_name: quoteForm.client_name.trim() || "Anonyme",
        client_email: quoteForm.client_email.trim(),
        client_phone: quoteForm.client_phone.trim(),
        message: quoteForm.message.trim(),
        category_id: category?.id || null,
        items: selected,
        event_date: quoteForm.event_date || null,
        address: quoteForm.address.trim(),
        estimated_price: quoteForm.prix_estime ? Number(quoteForm.prix_estime) : null,
        photos_paths: paths,
      });

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
      formElement.querySelector('input[name="quote_images"]').value = "";

    } catch (err) {
      console.error("Impossible d'enregistrer la demande de devis dans Supabase.", err);
      const message = [
        err?.message,
        err?.code ? `Code ${err.code}` : "",
        err?.details,
        err?.hint,
      ].filter(Boolean).join(" — ") || "Erreur lors de l'envoi du devis.";
      setQuoteResult({ success: false, error: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="catalog-page category-page">
      <header className="catalog-header">
        <div className="catalog-header-copy">
          <span className="eyebrow">Nos services et ressources</span>
          <h1>{category?.nom || formatCategoryName(slug) || "Catégorie"}</h1>
          <p>
            Découvrez les prestations et ressources disponibles dans la catégorie{" "}
            {category?.nom || formatCategoryName(slug)}.
          </p>
          {!loading && !loadError && (
            <span className="category-header-count">
              {displayed.length} élément{displayed.length === 1 ? "" : "s"} disponible
              {displayed.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </header>

      {loading && (
        <div className="catalog-grid category-skeleton-grid" role="status" aria-label="Chargement des éléments">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="category-card-skeleton" key={index} aria-hidden="true">
              <div className="category-card-skeleton-image" />
              <div className="category-card-skeleton-content">
                <span className="category-card-skeleton-line category-card-skeleton-title" />
                <span className="category-card-skeleton-line category-card-skeleton-description" />
                <span className="category-card-skeleton-line category-card-skeleton-description-short" />
                <span className="category-card-skeleton-button" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && loadError && (
        <div className="catalog-state catalog-empty" role="alert">
          La catégorie est temporairement indisponible : {loadError}
        </div>
      )}
      {!loading && !loadError && displayed.length === 0 && (
        <div className="catalog-state catalog-empty">Aucun élément dans cette catégorie.</div>
      )}

      {!loading && !loadError && displayed.length > 0 && (
        <div className="catalog-grid">
          {displayed.map((it, idx) => (
            <RevealOnScroll
              key={`${it.type_categorie === "service" ? "service" : "book"}-${it.id}`}
              delai={(idx % 8) * 60}
              className="category-grid-reveal"
            >
              <div className="catalog-grid-item-with-checkbox">
                <label className="item-select-checkbox">
                  <input type="checkbox" checked={selectedItems.hasOwnProperty(it.id)} onChange={() => toggleSelect(it.id, it)} />
                </label>
                {it.type_categorie === "service" ? (
                  <ServiceCard
                    livre={it}
                    achete={servicesAchetesIds.has(String(it.id))}
                    categoryView
                  />
                ) : (
                  <BookCard livre={it} categoryView />
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
                  <input type="date" min={minimumQuoteDate} value={quoteForm.event_date} onChange={(e) => handleChange('event_date', e.target.value)} />
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