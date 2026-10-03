import { supabase } from "./supabaseClient";

export function getStoragePublicUrl(bucket, path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
