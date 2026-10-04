const DATABASE_NAME = "eds-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "entries";

function openOfflineDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Le stockage hors ligne n'est pas disponible dans ce navigateur."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Impossible d'ouvrir le stockage hors ligne."));
    request.onblocked = () => reject(new Error("Le stockage hors ligne est bloqué par un autre onglet."));
  });
}

async function readEntry(key) {
  const database = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error || new Error("Impossible de lire le stockage hors ligne."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error("Lecture hors ligne interrompue."));
  });
}

async function writeEntry(key, value) {
  const database = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ key, value, savedAt: Date.now() });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error("Écriture hors ligne impossible."));
    transaction.onabort = () => reject(transaction.error || new Error("Écriture hors ligne interrompue."));
  });
}

export function saveOfflineLibrary(userId, orders) {
  return writeEntry(`library:${userId}`, orders);
}

export function getOfflineLibrary(userId) {
  return readEntry(`library:${userId}`);
}

export function saveOfflineSnapshot(key, value) {
  return writeEntry(`snapshot:${key}`, value);
}

export function getOfflineSnapshot(key) {
  return readEntry(`snapshot:${key}`);
}

export function saveOfflineDocument(userId, type, resourceId, blob) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    return Promise.reject(new Error("Le document à enregistrer hors ligne est vide."));
  }
  return writeEntry(`document:${userId}:${type}:${resourceId}`, blob);
}

export function getOfflineDocument(userId, type, resourceId) {
  return readEntry(`document:${userId}:${type}:${resourceId}`);
}
