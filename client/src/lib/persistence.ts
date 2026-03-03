const DB_NAME = "lace-persistence";
const DB_VERSION = 1;
const FILES_STORE = "files";
const ENVS_STORE = "environments";

export interface PersistedFile {
  envId: string;
  path: string;
  content: string;
}

export interface EnvironmentMeta {
  id: string;
  name: string;
  color: string;
  persistent: boolean;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, { autoIncrement: true });
        filesStore.createIndex("envId_path", ["envId", "path"], { unique: true });
        filesStore.createIndex("envId", "envId", { unique: false });
      }
      if (!db.objectStoreNames.contains(ENVS_STORE)) {
        db.createObjectStore(ENVS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function saveFileToDB(envId: string, path: string, content: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const store = tx.objectStore(FILES_STORE);
    const index = store.index("envId_path");
    const getReq = index.getKey([envId, path]);
    getReq.onsuccess = () => {
      const key = getReq.result;
      const record: PersistedFile = { envId, path, content };
      const putReq = key !== undefined ? store.put(record, key) : store.add(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteFileFromDB(envId: string, path: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const store = tx.objectStore(FILES_STORE);
    const index = store.index("envId_path");
    const getReq = index.getKey([envId, path]);
    getReq.onsuccess = () => {
      const key = getReq.result;
      if (key !== undefined) {
        const delReq = store.delete(key);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function renameFileInDB(envId: string, oldPath: string, newPath: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const store = tx.objectStore(FILES_STORE);
    const index = store.index("envId_path");
    const getReq = index.getKey([envId, oldPath]);
    getReq.onsuccess = () => {
      const key = getReq.result;
      if (key !== undefined) {
        const getDataReq = store.get(key);
        getDataReq.onsuccess = () => {
          const record = getDataReq.result as PersistedFile;
          store.delete(key);
          const newRecord: PersistedFile = { envId, path: newPath, content: record.content };
          const addReq = store.add(newRecord);
          addReq.onsuccess = () => resolve();
          addReq.onerror = () => reject(addReq.error);
        };
        getDataReq.onerror = () => reject(getDataReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function loadAllFilesFromDB(envId: string): Promise<{ path: string; content: string }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const store = tx.objectStore(FILES_STORE);
    const index = store.index("envId");
    const getReq = index.getAll(envId);
    getReq.onsuccess = () => {
      const records = (getReq.result as PersistedFile[]) || [];
      resolve(records.map(r => ({ path: r.path, content: r.content })));
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearEnvironmentFiles(envId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const store = tx.objectStore(FILES_STORE);
    const index = store.index("envId");
    const getReq = index.getAllKeys(envId);
    getReq.onsuccess = () => {
      const keys = getReq.result || [];
      let remaining = keys.length;
      if (remaining === 0) { resolve(); return; }
      for (const key of keys) {
        const delReq = store.delete(key);
        delReq.onsuccess = () => { if (--remaining === 0) resolve(); };
        delReq.onerror = () => reject(delReq.error);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function saveEnvironmentMeta(meta: EnvironmentMeta): Promise<void> {
  await withStore(ENVS_STORE, "readwrite", store => store.put(meta));
}

export async function loadAllEnvironmentMetas(): Promise<EnvironmentMeta[]> {
  const result = await withStore(ENVS_STORE, "readonly", store => store.getAll());
  return (result as EnvironmentMeta[]) || [];
}

export async function deleteEnvironmentMeta(envId: string): Promise<void> {
  await withStore(ENVS_STORE, "readwrite", store => store.delete(envId));
}

export async function saveAllFilesToDB(envId: string, files: { path: string; content: string }[]): Promise<void> {
  await clearEnvironmentFiles(envId);
  for (const file of files) {
    await saveFileToDB(envId, file.path, file.content);
  }
}
