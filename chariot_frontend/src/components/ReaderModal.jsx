import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { libraryService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./ReaderModal.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function ReaderModal({ livreId, documentUrl = null, onClose, open = true }) {
  const navigate = useNavigate();
  const routeParams = useParams();
  const resolvedId = livreId ?? Number(routeParams.id);
  const { user } = useAuth();
  const [src, setSrc] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [nombrePages, setNombrePages] = useState(0);
  const [renduEnCours, setRenduEnCours] = useState(false);
  const conteneurRef = useRef(null);
  const pdfDocRef = useRef(null);
  const createdUrlRef = useRef(false); // whether src is an object URL created by this component (to revoke on close)

  useEffect(() => {
    // If a direct documentUrl is provided (service document), use it directly
    if ((!resolvedId && !documentUrl) || !open) {
      setSrc("");
      setErreur("");
      setStatusMessage("");
      setChargement(false);
      return;
    }

    let isMounted = true;
    setChargement(true);
    setErreur("");
    setStatusMessage("");
    setStatusMessage("Chargement du document et vérification d'accès...");

    if (documentUrl) {
      // Try to fetch the document using the app's auth token first. Some PDF
      // URLs are protected and require Authorization headers; pdf.js will
      // attempt a plain GET without the app token and fail. Fetching the
      // blob ourselves and providing an object URL avoids that problem.
      const tryFetchWithAuth = async () => {
        try {
          const token = localStorage.getItem('eds_access_token');
          const headers = token ? { Authorization: 'Bearer ' + token } : {};
          const res = await fetch(documentUrl, { method: 'GET', headers });
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            // If the response looks like a PDF (or generic binary), use blob
            if (ct.includes('pdf') || ct.includes('octet-stream') || res.headers.get('content-disposition')) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              if (isMounted) {
                setSrc(url);
                createdUrlRef.current = true;
                setStatusMessage("");
                setChargement(false);
              }
              return;
            }
            // Otherwise, maybe the server returned the PDF as a redirect or HTML page.
            // Fall back to using the original URL.
          }
        } catch (e) {
          // ignore and fall back to direct URL
        }

        // Fall back: use the provided URL directly (may fail if protected)
        if (isMounted) {
          setSrc(documentUrl);
          setStatusMessage("");
          createdUrlRef.current = false;
          setChargement(false);
        }
      };

      tryFetchWithAuth();
    } else {
      libraryService
        .readDocument(resolvedId)
        .then((url) => {
          if (isMounted) {
            setSrc(url);
            setStatusMessage("");
            createdUrlRef.current = true;
          }
        })
        .catch((err) => {
          if (isMounted) {
            setErreur(err.message || "Le document est inaccessible pour le moment.");
            setStatusMessage("");
          }
        })
        .finally(() => {
          if (isMounted) setChargement(false);
        });
    }

    return () => {
      isMounted = false;
      if (createdUrlRef.current && src) URL.revokeObjectURL(src);
    };
  }, [resolvedId, open, documentUrl]);

  // Build the watermark text shown across every page: "Nom — Numéro".
  // Falls back gracefully if either piece of info is missing.
  const watermarkText = (() => {
    if (!user) return "";
    const nom = user.username || user.nom || "";
    const numero = user.telephone || user.phone || user.numero || user.numero_whatsapp || "";
    const parts = [nom, numero].filter(Boolean);
    return parts.join(" — ");
  })();

  // Draw a small number of semi-transparent diagonal watermark lines over a
  // rendered page canvas (not a dense tiled grid — just enough to deter
  // redistribution without cluttering the page). Called right after each
  // page is rendered so it becomes part of the bitmap itself.
  const dessinerFiligrane = (canvas) => {
    if (!watermarkText) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#000000";
    ctx.font = `${Math.round(canvas.width / 22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);

    // Only three lines (haut / centre / bas) instead of a full tiled grid.
    const decalages = [-canvas.height / 3.2, 0, canvas.height / 3.2];
    decalages.forEach((decalageY) => {
      ctx.fillText(watermarkText, 0, decalageY);
    });

    ctx.restore();
  };

  // Once we have the blob URL, load it with pdf.js and render every page
  // onto its own <canvas>. Canvas output is a bitmap, not real text, so
  // there is nothing for the browser to let the user select or copy —
  // this is what the native iframe/PDFium viewer could never guarantee.
  useEffect(() => {
    if (!src || !conteneurRef.current) return;

    let annule = false;
    setRenduEnCours(true);
    conteneurRef.current.innerHTML = "";

    pdfjsLib
      .getDocument({ url: src })
      .promise.then(async (pdf) => {
        if (annule) return;
        pdfDocRef.current = pdf;
        setNombrePages(pdf.numPages);

        for (let numeroPage = 1; numeroPage <= pdf.numPages; numeroPage++) {
          if (annule) return;
          const page = await pdf.getPage(numeroPage);

          // Échelle d'affichage voulue (taille visible à l'écran)
          const echelleAffichage = 1.4;
          // Densité de pixels de l'écran (2 ou 3 sur les écrans Retina/haute
          // résolution). On rend le canvas à cette résolution réelle, puis
          // on le réduit visuellement via CSS — le texte reste net au lieu
          // d'être flou.
          const ratioEcran = window.devicePixelRatio || 1;

          const viewportAffichage = page.getViewport({ scale: echelleAffichage });
          const viewportRendu = page.getViewport({ scale: echelleAffichage * ratioEcran });

          const canvas = document.createElement("canvas");
          canvas.className = "reader-pdf-page";
          canvas.width = viewportRendu.width;
          canvas.height = viewportRendu.height;
          // Taille affichée à l'écran (CSS) : plus petite que la résolution
          // réelle du canvas, d'où la netteté supplémentaire.
          canvas.style.width = `${viewportAffichage.width}px`;
          canvas.style.height = `${viewportAffichage.height}px`;

          const contexte = canvas.getContext("2d");

          await page.render({ canvasContext: contexte, viewport: viewportRendu }).promise;
          if (annule) return;
          dessinerFiligrane(canvas);
          conteneurRef.current?.appendChild(canvas);
        }
      })
      .catch((err) => {
        if (!annule) setErreur(err.message || "Impossible d'afficher le document.");
      })
      .finally(() => {
        if (!annule) setRenduEnCours(false);
      });

    return () => {
      annule = true;
    };
  }, [src, watermarkText]);

  // When PDF rendering finishes, scroll it into view so user sees first page
  useEffect(() => {
    if (!renduEnCours && src && conteneurRef.current) {
      try {
        conteneurRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        // ignore
      }
    }
  }, [renduEnCours, src]);

  const fermer = (event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    if (createdUrlRef.current && src) URL.revokeObjectURL(src);
    if (onClose) onClose();
    else navigate("/ma-bibliotheque");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) {
        fermer();
        return;
      }
      if (!open) return;

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
      // PrintScreen can't truly be blocked by any website, but we still
      // intercept it so it doesn't trigger any in-page side effect.
      if (key === "printscreen") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e) => {
      if (open) e.preventDefault();
    };
    const onSelectStart = (e) => {
      if (open) e.preventDefault();
    };
    const onCopy = (e) => {
      if (open) e.preventDefault();
    };
    const onDragStart = (e) => {
      if (open) e.preventDefault();
    };

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
  }, [open]);

  if (!open) return null;

  return (
    <div className="reader-modal-backdrop" onClick={fermer}>
      <div className="reader-modal reader-modal-noselect" onClick={(event) => event.stopPropagation()}>
        <div className="reader-modal-header">
          <h3>Lecture du document</h3>
          <button type="button" className="reader-close" onClick={(e) => { e.stopPropagation(); fermer(e); }}>
            Fermer
          </button>
        </div>

        {statusMessage && <div className="reader-state">{statusMessage}</div>}
        {chargement && !statusMessage && <div className="reader-state">Chargement du document…</div>}
        {erreur && <div className="reader-state reader-error">{erreur}</div>}

        {/* PDF rendering (rendered first so the document is visible immediately) */}
        {!chargement && !erreur && src && (
          <>
            {renduEnCours && <div className="reader-state">Préparation des pages… ({nombrePages > 0 ? `sur ${nombrePages}` : "…"})</div>}
            <div
              ref={conteneurRef}
              className="reader-pdf-container reader-modal-noselect"
              onContextMenu={(e) => e.preventDefault()}
            />
          </>
        )}

        {/* If no PDF document, show friendly message — modal reserved for documents */}
        {!chargement && !erreur && !src && (
          <div style={{padding:20, textAlign:'center'}}>
            <p style={{margin:0}}>Document introuvable ou inaccessible.</p>
            <p style={{marginTop:8, color:'#666'}}>Le modal est réservé à l'affichage du document. La vidéo et la couverture sont accessibles depuis la page du service ou votre bibliothèque.</p>
          </div>
        )}      </div>
    </div>
  );
}