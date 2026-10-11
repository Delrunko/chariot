import { supabase } from "./supabaseClient";

const FALLBACK_IMAGE = "/logo.png";

export function getStoragePublicUrl(bucket, path) {
  if (!path) return FALLBACK_IMAGE;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}