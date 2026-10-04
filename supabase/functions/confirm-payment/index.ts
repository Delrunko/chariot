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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("Configuration Supabase manquante dans confirm-payment.");
    return jsonResponse({ error: "Service de confirmation indisponible." }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Session invalide ou expirée." }, 401);
  }
  if (Deno.env.get("DEMO_PAYMENT_ENABLED") !== "true") {
    return jsonResponse({ error: "La simulation de paiement est désactivée." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
  }
  if (!isRecord(body)) return jsonResponse({ error: "Corps de requête invalide." }, 400);

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!uuidPattern.test(orderId)) {
    return jsonResponse({ error: "Identifiant de commande invalide." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Bypass RLS only after verifying the JWT and scoping the update to its owner.
  const { data: order, error: updateError } = await adminClient
    .from("orders")
    .update({ status: "paye", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", authData.user.id)
    .eq("status", "en_attente")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Erreur lors de la confirmation simulée:", updateError.message);
    return jsonResponse({ error: "La commande n'a pas pu être confirmée." }, 500);
  }
  if (!order) {
    return jsonResponse({ error: "Commande introuvable, déjà traitée ou non autorisée." }, 404);
  }

  return jsonResponse({ success: true, orderId: order.id });
});
