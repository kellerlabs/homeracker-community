import type { GridPosition } from "../types";

// ---- localStorage: custom part metadata ----

const META_KEY = "homeracker-custom-parts";

export interface CustomPartMeta {
  id: string;
  name: string;
  gridCells: GridPosition[];
  format?: "stl" | "3mf";
}

export function saveCustomPartsMeta(parts: CustomPartMeta[]): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(parts));
  } catch {
    // Ignore quota errors
  }
}

export function loadCustomPartsMeta(): CustomPartMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ---- IndexedDB: STL binary buffers ----

const DB_NAME = "homeracker";
const DB_VERSION = 1;
const STORE_NAME = "stl-buffers";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSTLBuffer(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(buffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllSTLBuffers(): Promise<Map<string, ArrayBuffer>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = new Map<string, ArrayBuffer>();

    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        result.set(cursor.key as string, cursor.value as ArrayBuffer);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSTLBuffer(id: string): Promise<ArrayBuffer | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSTLBuffer(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
