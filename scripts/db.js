// Simple IndexedDB wrapper for operations
const DB = (function() {
  const DB_NAME = 'caisse-db';
  const STORE = 'operations';
  const VERSION = 1;
  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB non disponible'));
        return;
      }

      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function addOperation(op) {
    return new Promise((resolve, reject) => {
      if (!_db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const tx = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function getAll() {
    return new Promise((resolve, reject) => {
      if (!_db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const tx = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function update(op) {
    return addOperation(op); // put will update existing
  }

  function remove(id) {
    return new Promise((resolve, reject) => {
      if (!_db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const tx = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function removeMany(ids) {
    return Promise.all(ids.map(id => remove(id)));
  }

  return { init, addOperation, getAll, update, remove, removeMany };
})();
