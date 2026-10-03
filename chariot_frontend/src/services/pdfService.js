import { supabase } from "../lib/supabaseClient";

const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

async function getAuthenticatedUser() {
  let result;
  try {
    result = await supabase.auth.getUser();
  } catch (error) {
    throw new Error("Erreur réseau lors de la vérification de la session.", { cause: error });
  }
  if (result.error) {
    throw new Error(`Vérification de la session impossible : ${result.error.message}`);
  }
  if (!result.data.user) {
    throw new Error("Accès refusé : connectez-vous pour lire ce document.");
  }
  return result.data.user;
}

async function createSignedPdfUrl(path) {
  let result;
  try {
    result = await supabase.storage
      .from("pdfs")
      .createSignedUrl(path, SIGNED_URL_LIFETIME_SECONDS);
  } catch (error) {
    throw new Error("Erreur réseau lors de la création du lien PDF.", { cause: error });
  }
  if (result.error) {
    throw new Error(`Création du lien PDF impossible : ${result.error.message}`);
  }
  if (!result.data?.signedUrl) {
    throw new Error("Supabase n'a pas retourné de lien PDF temporaire.");
  }
  return result.data.signedUrl;
}

/**
 * Returns a short-lived URL for a book PDF after confirming the signed-in
 * user has a paid order. The `pdfs` bucket must stay private: Storage RLS
 * controls access to the object, while a signed URL grants temporary access
 * without making the PDF publicly addressable.
 *
 * @param {string} bookId UUID of the book.
 * @returns {Promise<string>} Temporary signed URL, valid for one hour.
 * @throws {Error} If authentication, purchase verification, lookup, or signing fails.
 */
export async function getSecurePdfUrl(bookId) {
  if (typeof bookId !== "string" || bookId.trim() === "") {
    throw new Error("Identifiant du livre manquant.");
  }

  const user = await getAuthenticatedUser();

  let orderResult;
  try {
    orderResult = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("status", "paye")
      .maybeSingle();
  } catch (error) {
    throw new Error("Erreur réseau lors de la vérification de l'achat.", { cause: error });
  }
  if (orderResult.error) {
    throw new Error(`Vérification de l'achat impossible : ${orderResult.error.message}`);
  }

  if (!orderResult.data) {
    throw new Error("Accès refusé : aucun achat payé ne donne accès à ce livre.");
  }

  let bookResult;
  try {
    bookResult = await supabase
      .from("books")
      .select("pdf_path")
      .eq("id", bookId)
      .maybeSingle();
  } catch (error) {
    throw new Error("Erreur réseau lors de la récupération du livre.", { cause: error });
  }
  if (bookResult.error) {
    throw new Error(`Récupération du livre impossible : ${bookResult.error.message}`);
  }

  const book = bookResult.data;
  if (!book) {
    throw new Error("Livre non trouvé.");
  }
  if (typeof book.pdf_path !== "string" || book.pdf_path.trim() === "") {
    throw new Error("Aucun fichier PDF n'est associé à ce livre.");
  }

  return createSignedPdfUrl(book.pdf_path);
}

/**
 * Creates a temporary URL for a service document only after verifying that
 * the authenticated user has paid for that service.
 *
 * @param {string} serviceId UUID of the purchased service.
 * @returns {Promise<string>} Temporary signed URL, valid for one hour.
 */
export async function getSecureServicePdfUrl(serviceId) {
  if (typeof serviceId !== "string" || serviceId.trim() === "") {
    throw new Error("Identifiant du service manquant.");
  }

  const user = await getAuthenticatedUser();
  let orderResult;
  try {
    orderResult = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("service_id", serviceId)
      .eq("status", "paye")
      .maybeSingle();
  } catch (error) {
    throw new Error("Erreur réseau lors de la vérification de l'achat du service.", {
      cause: error,
    });
  }
  if (orderResult.error) {
    throw new Error(`Vérification de l'achat du service impossible : ${orderResult.error.message}`);
  }
  if (!orderResult.data) {
    throw new Error("Accès refusé : aucun achat payé ne donne accès à ce service.");
  }

  let serviceResult;
  try {
    serviceResult = await supabase
      .from("services")
      .select("document_path")
      .eq("id", serviceId)
      .maybeSingle();
  } catch (error) {
    throw new Error("Erreur réseau lors de la récupération du service.", { cause: error });
  }
  if (serviceResult.error) {
    throw new Error(`Récupération du service impossible : ${serviceResult.error.message}`);
  }
  const documentPath = serviceResult.data?.document_path;
  if (!documentPath) {
    throw new Error("Aucun document PDF n'est associé à ce service.");
  }

  return createSignedPdfUrl(documentPath);
}
