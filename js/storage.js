// Her own photos live in IndexedDB on the device (they're too big for localStorage).

const DB_NAME = 'moms-puzzles';
const STORE = 'photos';

let dbPromise = null;

function openDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const photos = {
  all: () => run('readonly', (s) => s.getAll()),
  get: (id) => run('readonly', (s) => s.get(id)),
  put: (record) => run('readwrite', (s) => s.put(record)),
  remove: (id) => run('readwrite', (s) => s.delete(id)),
};
