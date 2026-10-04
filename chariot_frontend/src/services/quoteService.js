import { supabase } from "../lib/supabaseClient";

export async function createQuote(quote) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("quotes").insert({
    id,
    client_name: quote.client_name,
    client_email: quote.client_email,
    client_phone: quote.client_phone,
    message: quote.message,
    category_id: quote.category_id,
    items: quote.items,
    event_date: quote.event_date,
    address: quote.address,
    estimated_price: quote.estimated_price,
  });

  if (error) throw error;
  return { id };
}
