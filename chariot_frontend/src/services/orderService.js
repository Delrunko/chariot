import { supabase } from "../lib/supabaseClient";

const DEMO_PAYMENT_ENABLED = import.meta.env.VITE_DEMO_PAYMENT_ENABLED === "true";

async function ensureProfileExists(user) {
  if (!user?.id) return;

  const { data: existingProfile, error: profileFetchError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileFetchError && profileFetchError.code !== "PGRST116") {
    throw profileFetchError;
  }
  if (existingProfile) return;

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name || "";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = metadata.first_name || nameParts[0] || "";
  const lastName = metadata.last_name || nameParts.slice(1).join(" ") || "";

  const { error: profileInsertError } = await supabase.from("profiles").insert({
    id: user.id,
    username: metadata.username || metadata.preferred_username || null,
    first_name: firstName,
    last_name: lastName,
    telephone: metadata.phone_number || metadata.telephone || null,
    role: "client",
  });

  if (profileInsertError && profileInsertError.code !== "23505") {
    throw profileInsertError;
  }
}

export async function createOrder({ bookId, serviceId, paymentMethod }) {
  if (Boolean(bookId) === Boolean(serviceId)) {
    throw new Error("La commande doit concerner un seul produit.");
  }
  if (paymentMethod !== "orange_money" && paymentMethod !== "mtn_momo") {
    throw new Error("Moyen de paiement invalide.");
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throwOrderError(authError);
  if (!authData.user) throw new Error("Connectez-vous pour enregistrer votre demande de paiement.");

  await ensureProfileExists(authData.user);

  const table = bookId ? "books" : "services";
  const foreignKey = bookId ? "book_id" : "service_id";
  const productId = bookId || serviceId;
  const { data: product, error: productError } = await supabase
    .from(table)
    .select("id, price, available")
    .eq("id", productId)
    .eq("available", true)
    .maybeSingle();
  if (productError) throwOrderError(productError);
  if (!product) throw new Error("Ce produit est introuvable ou indisponible.");

  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("user_id", authData.user.id)
    .eq(foreignKey, productId)
    .in("status", ["en_attente", "paye"])
    .maybeSingle();
  if (existingOrderError) throwOrderError(existingOrderError);
  if (existingOrder) {
    if (existingOrder.status === "paye") {
      throw new Error("Ce produit a déjà été acheté.");
    }
    return { orderId: existingOrder.id, status: existingOrder.status };
  }

  const orderPayload = {
    user_id: authData.user.id,
    book_id: bookId || null,
    service_id: serviceId || null,
    payment_method: paymentMethod,
    amount: product.price,
  };
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id, status")
    .single();

  if (orderError?.code === "23505") {
    const { data: racedOrder, error: racedOrderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("user_id", authData.user.id)
      .eq(foreignKey, productId)
      .in("status", ["en_attente", "paye"])
      .maybeSingle();
    if (racedOrderError) throwOrderError(racedOrderError);
    if (racedOrder?.status === "paye") {
      throw new Error("Ce produit a déjà été acheté.");
    }
    if (racedOrder) return { orderId: racedOrder.id, status: racedOrder.status };
  }
  if (orderError) throwOrderError(orderError);
  if (!order?.id) throw new Error("La commande n'a pas retourné d'identifiant.");

  return { orderId: order.id, status: order.status };
}

function throwOrderError(error) {
  if (error?.code === "42501") {
    throw new Error("Supabase refuse la création de la commande. Vérifiez les droits INSERT de l'utilisateur sur la table orders.");
  }
  if (error?.code === "23503" && error?.message?.includes("orders_user_id_fkey")) {
    throw new Error(
      "Votre compte n'a pas de profil de paiement dans la base. L'administrateur doit exécuter fix_missing_profiles.sql dans Supabase Studio, puis réessayez.",
    );
  }
  if (error?.code === "23505") {
    throw new Error("Une demande de paiement existe déjà pour ce produit.");
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    throw new Error("Connexion à Supabase impossible. Vérifiez votre connexion et réessayez.");
  }
  const message = typeof error?.message === "string" ? error.message : "";
  throw error instanceof Error
    ? error
    : new Error(message || "Impossible d'enregistrer la demande de paiement.");
}

export async function confirmDemoPayment(orderId) {
  if (!DEMO_PAYMENT_ENABLED) return false;

  const { data, error } = await supabase.functions.invoke("confirm-payment", {
    body: { orderId },
  });
  if (error) throw error;
  if (data?.success !== true) {
    throw new Error("La fonction n'a pas confirmé le paiement simulé.");
  }
  return true;
}
