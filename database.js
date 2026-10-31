/*
 * Local database for Field Log.
 *
 * Entries are stored in IndexedDB, which keeps them on the phone and makes
 * them available when the app is offline.
 */
(function () {
    "use strict";

    var databaseName = "field-log-db";
    var storeName = "entries";
    var databasePromise;

    // Open the database, creating the entries store on the first run.
    function openDatabase() {
        if (databasePromise) {
            return databasePromise;
        }

        databasePromise = new Promise(function (resolve, reject) {
            var request = indexedDB.open(databaseName, 1);

            request.onupgradeneeded = function () {
                var database = request.result;

                if (!database.objectStoreNames.contains(storeName)) {
                    var store = database.createObjectStore(storeName, {
                        keyPath: "id",
                        autoIncrement: true
                    });

                    store.createIndex("timestamp", "timestamp");
                }
            };

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });

        return databasePromise;
    }

    // Run one of the database's write operations.
    function write(action, value) {
        return openDatabase().then(function (database) {
            return new Promise(function (resolve, reject) {
                var transaction = database.transaction(storeName, "readwrite");
                var store = transaction.objectStore(storeName);
                var request;

                if (action === "add") {
                    request = store.add(value);
                } else if (action === "update") {
                    request = store.put(value);
                } else if (action === "delete") {
                    request = store.delete(value);
                } else {
                    request = store.clear();
                }

                transaction.oncomplete = function () {
                    resolve(request.result);
                };

                transaction.onerror = function () {
                    reject(transaction.error);
                };
            });
        });
    }

    // Public interface used by app.js.
    window.FieldLogDB = {
        add: function (entry) {
            return write("add", entry);
        },

        update: function (entry) {
            return write("update", entry);
        },

        remove: function (id) {
            return write("delete", id);
        },

        clear: function () {
            return write("clear");
        },

        all: function () {
            return openDatabase().then(function (database) {
                return new Promise(function (resolve, reject) {
                    var transaction = database.transaction(storeName);
                    var store = transaction.objectStore(storeName);
                    var request = store.getAll();

                    request.onsuccess = function () {
                        var entries = request.result || [];

                        // Newest entries appear first in the app.
                        entries.sort(function (a, b) {
                            return b.id - a.id;
                        });

                        resolve(entries);
                    };

                    request.onerror = function () {
                        reject(request.error);
                    };
                });
            });
        }
    };
})();
