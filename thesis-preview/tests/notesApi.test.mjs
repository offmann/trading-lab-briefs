import assert from "node:assert/strict";
import test from "node:test";
import { handleNotesRequest } from "../src/worker.js";
import {
  KEY_STORAGE,
  MIGRATED_FLAG,
  STORAGE_KEY,
  createRemoteNotesAdapter,
  memoryStorage,
} from "../js/notes.js";

function memoryKv(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async get(key, type) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = "" } = {}) {
      const keys = [...data.keys()].filter((name) => name.startsWith(prefix)).sort();
      return { keys: keys.map((name) => ({ name })), list_complete: true };
    },
  };
}

const SECRET = "test-notes-key-not-for-production";

function env(overrides = {}) {
  return { NOTES: memoryKv(), NOTES_KEY: SECRET, ...overrides };
}

function api(envObj, method, path, { key = SECRET, mark = "notes", body } = {}) {
  const headers = { "X-House-Request": mark };
  if (key) headers["X-House-Notes-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const request = new Request(`https://house-view.example${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleNotesRequest(request, envObj);
}

test("unauthenticated GET /api/notes is denied", async () => {
  const state = env();
  const noHeaders = await handleNotesRequest(new Request("https://house-view.example/api/notes"), state);
  assert.equal(noHeaders.status, 401);
  const noMark = await api(state, "GET", "/api/notes", { mark: "" });
  assert.equal(noMark.status, 401);
  const wrong = await api(state, "GET", "/api/notes", { key: "wrong-key" });
  assert.equal(wrong.status, 401);
  const denied = await wrong.json();
  assert.equal(denied.error, "unauthorized");
  assert.doesNotMatch(JSON.stringify(denied), /test-notes-key|NOTES_KEY|Bearer/);
});

test("owner can create, list, and delete a note", async () => {
  const state = env();
  const created = await api(state, "POST", "/api/notes", {
    body: { body: "Look at memory again.", targetId: "msg.scout-2026-11-26-dram", targetTitle: "DRAM scout" },
  });
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.note.status, "saved");
  assert.equal(saved.note.body, "Look at memory again.");
  assert.equal(saved.note.targetId, "msg.scout-2026-11-26-dram");
  assert.match(saved.note.createdAt, /^\d{4}-\d{2}-\d{2}T/);

  const listed = await api(state, "GET", "/api/notes");
  assert.equal(listed.status, 200);
  const payload = await listed.json();
  assert.equal(payload.notes.length, 1);
  assert.equal(payload.notes[0].id, saved.note.id);

  const deleted = await api(state, "DELETE", `/api/notes/${saved.note.id}`);
  assert.equal(deleted.status, 200);
  const empty = await (await api(state, "GET", "/api/notes")).json();
  assert.equal(empty.notes.length, 0);
});

test("create stores saved only, rejects oversized bodies, and is idempotent on clientId", async () => {
  const state = env();
  const first = await api(state, "POST", "/api/notes", {
    body: { body: "First save", targetId: "general", targetTitle: "General note", clientId: "local-1" },
  });
  const second = await api(state, "POST", "/api/notes", {
    body: { body: "First save", targetId: "general", targetTitle: "General note", clientId: "local-1" },
  });
  assert.equal((await first.json()).note.id, (await second.json()).note.id);
  const listed = await (await api(state, "GET", "/api/notes")).json();
  assert.equal(listed.notes.length, 1);

  const huge = await api(state, "POST", "/api/notes", {
    body: { body: "x".repeat(2001), targetId: "general", targetTitle: "General note" },
  });
  assert.equal(huge.status, 400);
  assert.equal((await huge.json()).error, "too-long");
});

test("remote adapter migrates localStorage notes once the key is set", async () => {
  const state = env();
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      notes: [{
        id: "local-note-1",
        targetId: "general",
        targetTitle: "General note",
        body: "Brought over from this browser",
        status: "saved",
        createdAt: "2026-11-24T20:00:00.000Z",
      }],
    }),
  });
  const calls = [];
  const fakeFetch = async (path, init) => {
    calls.push({ path, method: init.method });
    return handleNotesRequest(new Request(`https://house-view.example${path}`, init), state);
  };
  const adapter = createRemoteNotesAdapter(storage, { fetch: fakeFetch });
  const before = await adapter.list();
  assert.equal(before.error, "need-key");
  assert.equal(calls.length, 0);

  adapter.setKey(SECRET);
  const migrated = await adapter.migrateLocal();
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, 1);
  assert.equal(storage.getItem(MIGRATED_FLAG), "1");

  const listed = await adapter.list();
  assert.equal(listed.ok, true);
  assert.equal(listed.notes[0].body, "Brought over from this browser");
  const again = await adapter.migrateLocal();
  assert.equal(again.skipped, true);
});

test("remote adapter reports offline and unauthorized without leaking the key", async () => {
  const storage = memoryStorage({ [KEY_STORAGE]: SECRET });
  const offline = createRemoteNotesAdapter(storage, {
    fetch: async () => { throw new TypeError("network"); },
  });
  assert.equal((await offline.list()).error, "offline");

  const denied = createRemoteNotesAdapter(storage, {
    fetch: async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
  });
  const result = await denied.list();
  assert.equal(result.error, "unauthorized");
  assert.equal(storage.getItem(KEY_STORAGE), SECRET);
});
