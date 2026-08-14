/**
 * WRAPPER INDEXEDDB (Gestion du stockage local hors-ligne)
 */
const DB = (function() {
  const DB_NAME = 'caisse-db';
  const STORE = 'operations';
  const VERSION = 1;
  let _db = null;
  let _initPromise = null;

  // Initialisation sécurisée de la base de données
  function init() {
    if (_initPromise) return _initPromise;

    _initPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB non disponible sur ce navigateur.'));
        return;
      }

      const req = indexedDB.open(DB_NAME, VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = (e) => {
        console.error('Erreur Ouverture IndexedDB :', e.target.error);
        reject(e.target.error);
      };
    });

    return _initPromise;
  }

  // Vérificateur automatique d'initialisation
  async function ensureDB() {
    if (!_db) {
      await init();
    }
  }

  // Ajout ou mise à jour d'une opération
  async function addOperation(op) {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);

      // Génération d'un ID si absent
      const record = {
        id: op.id || ('local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
        ...op
      };

      const req = store.put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Récupération de toutes les opérations locales
  async function getAll() {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Mise à jour
  async function update(op) {
    return addOperation(op);
  }

  // Suppression d'une opération
  async function remove(id) {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // Suppression multiple
  async function removeMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    for (const id of ids) {
      await remove(id);
    }
  }

  // Auto-initialisation au chargement
  init().catch(err => console.warn('[DB] Auto-init IndexedDB :', err.message));

  return {
    init,
    addOperation,
    getAll,
    update,
    remove,
    removeMany,

    // ALIAS DE COMPATIBILITÉ POUR AUTH.JS ET SUPABASE.JS
    getOperations: getAll,
    saveOperation: addOperation,
    updateOperation: update,
    deleteOperation: remove,
    deleteOperations: removeMany
  };
})();

window.DB = DB;