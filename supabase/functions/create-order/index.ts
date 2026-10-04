import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, isRecord, jsonResponse } from "../_shared/http.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  if (request.method !== "POST") return jsonResponse({ error: "Méthode non autorisée." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentification requise." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Configuration Supabase manquante dans create-order.");
    return jsonResponse({ error: "Service de commande indisponible." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Session invalide ou expirée." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
  }
  if (!isRecord(body)) return jsonResponse({ error: "Corps de requête invalide." }, 400);

  const bookId = typeof body.bookId === "string" ? body.bookId : null;
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : null;
  const paymentMethod = body.paymentMethod;
  if (Boolean(bookId) === Boolean(serviceId)) {
    return jsonResponse({ error: "Fournissez exactement un bookId ou un serviceId." }, 400);
  }
  if ((bookId && !uuidPattern.test(bookId)) || (serviceId && !uuidPattern.test(serviceId))) {
    return jsonResponse({ error: "Identifiant de produit invalide." }, 400);
  }
  if (paymentMethod !== "orange_money" && paymentMethod !== "mtn_momo") {
    return jsonResponse({ error: "Moyen de paiement invalide." }, 400);
  }

  const itemTable = bookId ? "books" : "services";
  const itemId = bookId ?? serviceId!;
  const itemForeignKey = bookId ? "book_id" : "service_id";
  const { data: item, error: itemError } = await supabase
    .from(itemTable)
    .select("id, price")
    .eq("id", itemId)
    .eq("available", true)
    .maybeSingle();

  if (itemError) {
    console.error("Erreur lors de la vérification du produit:", itemError.message);
    return jsonResponse({ error: "Impossible de vérifier la disponibilité du produit." }, 500);
  }
  if (!item) return jsonResponse({ error: "Produit introuvable ou indisponible." }, 404);

  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("user_id", authData.user.id)
    .eq(itemForeignKey, itemId)
    .maybeSingle();

  if (existingError) {
    console.error("Erreur lors de la vérification des commandes:", existingError.message);
    return jsonResponse({ error: "Impossible de vérifier votre commande existante." }, 500);
  }
  if (existingOrder) {
    if (existingOrder.status === "en_attente") {
      return jsonResponse({ orderId: existingOrder.id, status: existingOrder.status });
    }
    return jsonResponse(
      { error: existingOrder.status === "paye"
        ? "Ce produit a déjà été acheté."
        : "Une commande existe déjà pour ce produit. Contactez le support pour la débloquer." },
      409,
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: authData.user.id,
      book_id: bookId,
      service_id: serviceId,
      payment_method: paymentMethod,
      amount: item.price,
    })
    .select("id, status")
    .single();

  if (orderError) {
    console.error("Erreur lors de la création de la commande:", orderError.message);
    return jsonResponse({ error: "La commande n'a pas pu être créée." }, 500);
  }

  return jsonResponse({ orderId: order.id, status: order.status }, 201);
});
