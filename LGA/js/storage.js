// ============================================================
// LGA - STOCKAGE (IndexedDB)
// Remplace localStorage par IndexedDB :
//  - Persistant (survit à la fermeture du navigateur)
//  - Pas de limite de 5 Mo
//  - API synchrone côté lecture (cache mémoire)
//  - Écriture asynchrone en arrière-plan
// ============================================================

const LGAStorage = {
    _cache: {},
    _db:    null,
    DB_NAME:    'lga_apicole',
    STORE_NAME: 'kv',

    // ----------------------------------------------------------
    // init() : à appeler UNE FOIS au démarrage, avant tout le reste
    // Retourne une Promise résolue quand tout est chargé en mémoire
    // ----------------------------------------------------------
    init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);

            // Première ouverture : créer l'object store
            req.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(this.STORE_NAME);
            };

            req.onerror = () => {
                console.error('LGAStorage: impossible d\'ouvrir IndexedDB', req.error);
                reject(req.error);
            };

            req.onsuccess = (e) => {
                this._db = e.target.result;

                // Charger TOUTES les clés en mémoire pour des lectures synchrones
                const tx    = this._db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);
                const reqKeys = store.getAllKeys();

                reqKeys.onsuccess = () => {
                    const keys = reqKeys.result;
                    if (keys.length === 0) {
                        console.log('LGAStorage: base vide, prêt.');
                        resolve();
                        return;
                    }

                    let restant = keys.length;
                    keys.forEach(key => {
                        const reqVal = store.get(key);
                        reqVal.onsuccess = () => {
                            this._cache[key] = reqVal.result;
                            restant--;
                            if (restant === 0) {
                                console.log(`LGAStorage: ${keys.length} clés chargées.`);
                                resolve();
                            }
                        };
                        reqVal.onerror = () => {
                            restant--;
                            if (restant === 0) resolve();
                        };
                    });
                };

                reqKeys.onerror = () => {
                    console.warn('LGAStorage: erreur lecture clés, démarrage à vide.');
                    resolve();
                };
            };
        });
    },

    // ----------------------------------------------------------
    // Lecture synchrone depuis le cache mémoire
    // ----------------------------------------------------------
    getItem(key) {
        return Object.prototype.hasOwnProperty.call(this._cache, key)
            ? this._cache[key]
            : null;
    },

    // ----------------------------------------------------------
    // Écriture : cache immédiat + IDB en arrière-plan
    // ----------------------------------------------------------
    setItem(key, value) {
        this._cache[key] = value;
        if (!this._db) return;

        try {
            const tx    = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.put(value, key);
            tx.onerror = () => console.error('LGAStorage: erreur écriture', key);
        } catch (err) {
            console.error('LGAStorage: setItem échoué', err);
        }
    },

    // ----------------------------------------------------------
    // Suppression
    // ----------------------------------------------------------
    removeItem(key) {
        delete this._cache[key];
        if (!this._db) return;

        try {
            const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).delete(key);
        } catch (err) {
            console.error('LGAStorage: removeItem échoué', err);
        }
    },

    // ----------------------------------------------------------
    // Export JSON (sauvegarde manuelle)
    // ----------------------------------------------------------
    exporterJSON() {
        const data = { ...this._cache, _export_date: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `lga_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('LGAStorage: export effectué.');
    },

    // ----------------------------------------------------------
    // Import JSON (restauration depuis un fichier)
    // ----------------------------------------------------------
    importerJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    delete data._export_date;
                    for (const [key, value] of Object.entries(data)) {
                        this.setItem(key, value);
                    }
                    console.log('LGAStorage: import effectué, rechargement...');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
};
