import { supabase } from "../lib/supabaseClient";

const PROFILE_FIELDS = "id, username, first_name, last_name, telephone, role";

function getNameParts(user) {
  const metadata = user.user_metadata ?? {};
  const fullName = (metadata.full_name || "").trim();
  const [firstName = "", ...lastNameParts] = fullName.split(/\s+/);

  return {
    first_name: metadata.first_name || firstName,
    last_name: metadata.last_name || lastNameParts.join(" "),
    telephone:
      metadata.phone ||
      metadata.phone_number ||
      metadata.telephone ||
      null,
  };
}

async function findProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureProfileExists(user) {
  if (!user?.id) {
    throw new Error("Utilisateur non authentifié : impossible de charger le profil.");
  }

  const existingProfile = await findProfile(user.id);
  if (existingProfile) return existingProfile;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      ...getNameParts(user),
    })
    .select(PROFILE_FIELDS)
    .single();

  if (!error) return data;
  if (error.code !== "23505") throw error;

  const profileCreatedByConcurrentRequest = await findProfile(user.id);
  if (profileCreatedByConcurrentRequest) return profileCreatedByConcurrentRequest;
  throw error;
}
