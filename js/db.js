// Books live in IndexedDB: database "coffee-table", one store "books", each
// record keyed by its `id`.
//
// Never rename the database or the store once real books exist: the app
// would open a new, empty one and the shelf would come up blank. The name is
// specific because every GitHub Pages app on jamien-liston.github.io shares
// the same browser storage.

const DB = (() => {
  const NAME = 'coffee-table';
  const VERSION = 1;
  const STORE = 'books';
  let opening = null;

  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(NAME, VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => {
          const db = request.result;
          // Let a newer version of the app take over, and notice when Safari
          // drops the connection, so the next call opens a fresh one.
          db.onversionchange = () => {
            db.close();
            opening = null;
          };
          db.onclose = () => {
            opening = null;
          };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
      }).catch((err) => {
        opening = null;
        throw err;
      });
    }
    return opening;
  }

  // Runs `work(store)` in one transaction and resolves with its request's
  // result once the transaction has finished, so a resolved write is on disk.
  async function attempt(mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE, mode);
      } catch (err) {
        reject(err);
        return;
      }
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('The save was cancelled.'));
    });
  }

  // After a long spell in the background, Safari sometimes drops the
  // database connection. Reconnect and try once more before giving up.
  async function run(mode, work) {
    try {
      return await attempt(mode, work);
    } catch (err) {
      if (!err || (err.name !== 'InvalidStateError' && err.name !== 'UnknownError')) throw err;
      opening = null;
      return attempt(mode, work);
    }
  }

  return {
    all: () => run('readonly', (store) => store.getAll()),
    put: (book) => run('readwrite', (store) => store.put(book)),
    remove: (id) => run('readwrite', (store) => store.delete(id)),
  };
})();
