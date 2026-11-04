(function (window) {
  "use strict";

  var DB_NAME = "MathForgeProjects";
  var DB_VERSION = 1;
  var STORE_NAME = "projects";
  var connection = null;
  var connectionUsable = false;
  var opening = null;
  var writeQueue = Promise.resolve();

  function invalidate(db) {
    if (!db || connection === db) {
      connection = null;
      connectionUsable = false;
      opening = null;
    }
  }

  function attach(db) {
    connection = db;
    connectionUsable = true;
    db.onversionchange = function () {
      if (connection === db) {
        connectionUsable = false;
        connection = null;
        opening = null;
      }
      try { db.close(); } catch (error) { /* Already closing; future operations reopen. */ }
    };
    db.onclose = function () { invalidate(db); };
    return db;
  }

  function open() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable in this browser context."));
    if (connection && connectionUsable) return Promise.resolve(connection);
    if (opening) return opening;

    var request;
    var settled = false;
    var promise = new Promise(function (resolve, reject) {
      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error || new Error("Unable to open project storage."));
      }
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        fail(error);
        return;
      }
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = function () {
        var db = request.result;
        if (settled) {
          try { db.close(); } catch (error) { /* Late success after a blocked-open failure. */ }
          return;
        }
        settled = true;
        resolve(attach(db));
      };
      request.onerror = function () { fail(request.error || new Error("Unable to open project storage.")); };
      request.onblocked = function () {
        fail(new Error("Project storage is blocked by another open MathForge window. Close the other window and try again."));
      };
    });
    opening = promise;
    promise.then(function (db) {
      if (opening === promise && connection !== db) opening = null;
    }, function () {
      if (opening === promise) opening = null;
    });
    return promise;
  }

  function isClosedConnectionError(error) {
    return Boolean(error && (error.name === "InvalidStateError" || /database connection is (?:closing|closed)/i.test(error.message || "")));
  }

  function transact(mode, operation, retry) {
    retry = retry || 0;
    return open().then(function (db) {
      if (db !== connection || !connectionUsable) {
        if (retry < 1) return transact(mode, operation, retry + 1);
        throw new Error("Project storage connection closed before the transaction could start.");
      }

      var transaction;
      try {
        transaction = db.transaction(STORE_NAME, mode);
      } catch (error) {
        if (isClosedConnectionError(error)) invalidate(db);
        if (isClosedConnectionError(error) && retry < 1) return transact(mode, operation, retry + 1);
        throw error;
      }

      return new Promise(function (resolve, reject) {
        var result;
        var completed = false;
        function fail(error) {
          if (completed) return;
          completed = true;
          reject(error || new Error("Project storage transaction failed."));
        }
        transaction.oncomplete = function () {
          if (completed) return;
          completed = true;
          resolve(result);
        };
        transaction.onerror = function () {
          fail(transaction.error || new Error("Project storage transaction failed."));
        };
        transaction.onabort = function () {
          fail(transaction.error || new Error("Project storage transaction was aborted."));
        };
        try {
          operation(transaction.objectStore(STORE_NAME), function (value) { result = value; });
        } catch (error) {
          try { transaction.abort(); } catch (abortError) { /* The failed transaction may already be inactive. */ }
          fail(error);
        }
      });
    });
  }

  function enqueueWrite(projects) {
    var batch = Array.isArray(projects) ? projects.slice() : [projects];
    var operation = writeQueue.then(function () {
      return transact("readwrite", function (store) {
        batch.forEach(function (project) { store.put(project); });
      });
    });
    writeQueue = operation.then(function () {}, function () {});
    return operation;
  }

  var api = {
    open: open,
    put: function (project) { return enqueueWrite([project]); },
    putMany: enqueueWrite,
    get: function (id) {
      return transact("readonly", function (store, setResult) {
        var request = store.get(id);
        request.onsuccess = function () { setResult(request.result || null); };
      });
    },
    getAll: function () {
      return transact("readonly", function (store, setResult) {
        var request = store.getAll();
        request.onsuccess = function () { setResult(request.result || []); };
      });
    },
    invalidate: function () { invalidate(null); }
  };

  window.MathForgeProjectStorage = api;
})(window);
