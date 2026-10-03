import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getSecurePdfUrl } from "../services/pdfService";

export function useBookAccess(bookId, enabled = true, reloadKey = 0) {
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(bookId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;
    let requestId = 0;
    let authChangeTimer;

    const loadUrl = async () => {
      const currentRequestId = ++requestId;
      setUrl(null);
      setError(null);

      if (!bookId || !enabled) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const secureUrl = await getSecurePdfUrl(bookId);
        if (isActive && currentRequestId === requestId) {
          setUrl(secureUrl);
        }
      } catch (requestError) {
        if (isActive && currentRequestId === requestId) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Impossible de vérifier l'accès à ce livre.",
          );
        }
      } finally {
        if (isActive && currentRequestId === requestId) {
          setIsLoading(false);
        }
      }
    };

    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => {
      window.clearTimeout(authChangeTimer);
      authChangeTimer = window.setTimeout(() => {
        void loadUrl();
      }, 0);
    });

    void loadUrl();

    return () => {
      isActive = false;
      window.clearTimeout(authChangeTimer);
      authSubscription.subscription.unsubscribe();
    };
  }, [bookId, enabled, reloadKey]);

  return { url, isLoading, error };
}
