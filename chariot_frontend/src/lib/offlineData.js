import { getOfflineSnapshot, saveOfflineSnapshot } from "./offlineStorage";

function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(
      error instanceof Error ? error.message : String(error),
    )
  );
}

export async function loadWithOfflineSnapshot(key, load) {
  try {
    const data = await load();
    try {
      await saveOfflineSnapshot(key, data);
    } catch (error) {
      console.warn(`Impossible d'enregistrer les données hors ligne (${key}).`, error);
    }
    return data;
  } catch (error) {
    if (typeof navigator !== "undefined" && navigator.onLine && !isNetworkError(error)) {
      throw error;
    }

    const snapshot = await getOfflineSnapshot(key);
    if (snapshot === null) throw error;
    return snapshot;
  }
}
