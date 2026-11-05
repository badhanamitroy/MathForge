"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/core/indexeddb-project-store.js"), "utf8");

function fakeIndexedDb(options = {}) {
  const records = new Map();
  const connections = [];
  let opens = 0;
  let storeInitialized = false;
  let activeWrites = 0;
  let maxActiveWrites = 0;
  let transactionId = 0;
  const transactionEvents = [];

  function makeDatabase(hasStore) {
    const db = {
      closed: false,
      objectStoreNames: { contains(name) { return name === "projects" && hasStore; } },
      createObjectStore(name) { if (name === "projects") hasStore = true; return {}; },
      close() {
        if (db.closed) return;
        db.closed = true;
        if (db.onclose) db.onclose({ type: "close" });
      },
      transaction(storeName, mode) {
        if (db.closed || options.alwaysFailTransactionCreate || options.failTransactionCreateCount > 0) {
          if (options.failTransactionCreateCount > 0) options.failTransactionCreateCount -= 1;
          const error = new Error("The database connection is closing.");
          error.name = "InvalidStateError";
          throw error;
        }
        if (!hasStore || storeName !== "projects") throw new Error("Object store missing");
        const id = ++transactionId;
        let pendingRequests = 0;
        let setupComplete = false;
        let completionScheduled = false;
        let completed = false;
        const pendingWrites = new Map();
        function maybeComplete() {
          if (!setupComplete || pendingRequests || completionScheduled || completed) return;
          completionScheduled = true;
          setTimeout(() => {
            completionScheduled = false;
            if (pendingRequests || completed) return;
            completed = true;
            if (mode === "readwrite") {
              pendingWrites.forEach((value, key) => records.set(key, value));
              activeWrites -= 1;
            }
            transactionEvents.push(`transaction-complete:${id}:${mode}`);
            if (tx.oncomplete) tx.oncomplete();
          }, options.transactionDelay == null ? 2 : options.transactionDelay);
        }
        function queueRequest(kind, detail, populateRequest) {
          const request = {};
          pendingRequests += 1;
          setTimeout(() => {
            populateRequest(request);
            transactionEvents.push(`request-success:${id}:${kind}:${detail}`);
            if (request.onsuccess) request.onsuccess();
            pendingRequests -= 1;
            maybeComplete();
          }, 0);
          return request;
        }
        const tx = { error: null, objectStore(requestedStore) {
          if (requestedStore !== "projects") throw new Error("Wrong store");
          return {
            put(value) {
              pendingWrites.set(value.id, JSON.parse(JSON.stringify(value)));
              return queueRequest("put", value.id, () => {});
            },
            get(id) {
              return queueRequest("get", id, (request) => {
                const value = pendingWrites.has(id) ? pendingWrites.get(id) : records.get(id);
                request.result = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
              });
            },
            getAll() {
              return queueRequest("getAll", "", (request) => {
                const all = new Map(records);
                pendingWrites.forEach((value, key) => all.set(key, value));
                request.result = Array.from(all.values()).map((value) => JSON.parse(JSON.stringify(value)));
              });
            }
          };
        }, abort() {
          tx.error = new Error("aborted");
          setTimeout(() => {
            if (completed) return;
            completed = true;
            if (mode === "readwrite") activeWrites -= 1;
            if (tx.onabort) tx.onabort();
          }, 0);
        } };
        if (mode === "readwrite") { activeWrites += 1; maxActiveWrites = Math.max(activeWrites, maxActiveWrites); }
        queueMicrotask(() => {
          setupComplete = true;
          maybeComplete();
        });
        return tx;
      }
    };
    connections.push(db);
    return db;
  }

  return {
    api: {
      open(name, version) {
        opens += 1;
        const request = {};
        setTimeout(() => {
          if (options.blocked) {
            if (request.onblocked) request.onblocked();
            return;
          }
          const hasStore = storeInitialized;
          const db = makeDatabase(hasStore);
          request.result = db;
          if (!hasStore) {
            if (request.onupgradeneeded) request.onupgradeneeded();
            storeInitialized = true;
          }
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }
    },
    get opens() { return opens; },
    get connections() { return connections; },
    get records() { return records; },
    get maxActiveWrites() { return maxActiveWrites; },
    get transactionEvents() { return transactionEvents; }
  };
}

function makeStore(options) {
  const indexedDB = fakeIndexedDb(options);
  const window = { indexedDB: indexedDB.api };
  vm.runInNewContext(source, { window }, { filename: "indexeddb-project-store.js" });
  return { store: window.MathForgeProjectStorage, fake: indexedDB };
}

test("first use upgrades the projects store once and reuses its live connection", async () => {
  const { store, fake } = makeStore();
  const first = await store.open();
  const second = await store.open();
  assert.equal(fake.opens, 1);
  assert.equal(first, second);
  assert.equal(first.objectStoreNames.contains("projects"), true);
});

test("project and autosave recovery copy are committed together and can be reopened", async () => {
  const { store, fake } = makeStore();
  const project = {
    format: "mathforge-project", version: 1, id: "project-1", name: "Scale test",
    updatedAt: "2026-11-05T00:00:00.000Z", activeTool: "coordinates-graph",
    toolStates: { "coordinates-graph": { pointSets: [{ points: [{ x: -2.5, y: 3.25 }] }] } },
    graphDesignSettings: { axisScale: { x: { k: 5, n: 1 }, y: { k: 2, n: 5 } } }
  };
  const recovery = { ...project, id: "mathforge-autosave", sourceId: project.id };
  const eventStart = fake.transactionEvents.length;
  await store.putMany([project, recovery]);
  const writeEvents = fake.transactionEvents.slice(eventStart);
  assert.deepEqual(writeEvents, [
    "request-success:1:put:project-1",
    "request-success:1:put:mathforge-autosave",
    "transaction-complete:1:readwrite"
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(await store.get(project.id))), project);
  assert.deepEqual(JSON.parse(JSON.stringify(await store.get("mathforge-autosave"))), recovery);
  assert.equal((await store.getAll()).length, 2);
  assert.equal(fake.opens, 1);
});

test("rapid consecutive saves are serialized and the latest snapshot is retained", async () => {
  const { store, fake } = makeStore({ transactionDelay: 5 });
  const saves = [1, 2, 3, 4, 5].map((revision) => store.put({ id: "project", revision }));
  await Promise.all(saves);
  assert.equal((await store.get("project")).revision, 5);
  assert.equal(fake.maxActiveWrites, 1);
});

test("versionchange and close invalidate the connection and the next operation reopens", async () => {
  const { store, fake } = makeStore();
  await store.put({ id: "kept", value: "intact" });
  const first = fake.connections[0];
  first.onversionchange({ type: "versionchange" });
  assert.equal(first.closed, true);
  assert.equal((await store.get("kept")).value, "intact");
  assert.equal(fake.opens, 2);
  fake.connections[1].close();
  assert.equal((await store.get("kept")).value, "intact");
  assert.equal(fake.opens, 3);
});

test("a transaction creation race reopens once; persistent failures do not retry forever", async () => {
  const recoverable = makeStore({ failTransactionCreateCount: 1 });
  await recoverable.store.put({ id: "recovered", ok: true });
  assert.equal(recoverable.fake.opens, 2);
  assert.equal((await recoverable.store.get("recovered")).ok, true);

  const unavailable = makeStore({ alwaysFailTransactionCreate: true });
  await assert.rejects(unavailable.store.put({ id: "never", value: 1 }), /connection is closing/i);
  assert.equal(unavailable.fake.opens, 2);
});

test("a blocked database open reports failure rather than hanging or leaking a connection", async () => {
  const { store, fake } = makeStore({ blocked: true });
  await assert.rejects(store.open(), /blocked by another open MathForge window/i);
  assert.equal(fake.opens, 1);
  assert.equal(fake.connections.length, 0);
});
