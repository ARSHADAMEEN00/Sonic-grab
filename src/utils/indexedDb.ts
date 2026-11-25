export interface StoredAudioRecord {
  trackId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  savedAt: string;
}

const DB_NAME = 'sonic-grab-db';
const DB_VERSION = 1;
const BLOB_STORE = 'audio_blobs';
const STATE_STORE = 'library_state';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'trackId' });
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioBlob(record: StoredAudioRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioBlob(trackId: string): Promise<StoredAudioRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(trackId);
    req.onsuccess = () => resolve(req.result as StoredAudioRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllAudioBlobs(): Promise<StoredAudioRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredAudioRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioBlob(trackId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllAudioBlobs(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLibraryState<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATE_STORE, 'readwrite');
    tx.objectStore(STATE_STORE).put({ key, value, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLibraryState<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATE_STORE, 'readonly');
    const req = tx.objectStore(STATE_STORE).get(key);
    req.onsuccess = () => {
      const row = req.result as { key: string; value: T } | undefined;
      resolve(row?.value);
    };
    req.onerror = () => reject(req.error);
  });
}
