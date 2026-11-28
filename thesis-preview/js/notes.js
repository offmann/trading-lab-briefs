/** Notes adapters: local (tests and migration source) and remote (Cloudflare API). */

export const LOCAL_NOTICE = "Saved on this browser only — not sent to your advisor.";
export const REMOTE_NOTICE = "Saved to your private notes store. Only you and your advisor can read them.";
export const MAX_BODY = 2000;
export const STORAGE_KEY = "house-view-preview-notes-v1";
export const KEY_STORAGE = "house-view-notes-key";
export const MIGRATED_FLAG = "house-view-notes-migrated-v1";
export const NOTES_ENDPOINT = "/api/notes";
export const REQUEST_MARK = "notes";

const TARGET_ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;

export const NOTE_ERRORS = {
  empty: "Write a note before saving. Nothing was sent.",
  "too-long": "That note is too long for this preview (2,000 characters). Nothing was sent.",
  target: "This note is missing a valid section link. Nothing was sent.",
  title: "This note is missing a section title. Nothing was sent.",
  storage: "This browser refused to store the note. Nothing was sent.",
  corrupt: "Notes already in this browser could not be read. They were not sent anywhere. Saving is paused until you remove them from this browser.",
  "need-key": "Enter the notes key once to unlock your private notes store.",
  unauthorized: "That notes key was not accepted. Check it and try again.",
  offline: "The notes store is unreachable right now. Your draft is still here; try again when you are back online.",
  missing: "That note could not be found.",
};

export function memoryStorage(initial) {
  const data = new Map();
  if (initial) {
    for (const [key, value] of Object.entries(initial)) data.set(key, value);
  }
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function blankRecord() {
  return { version: 1, notes: [] };
}

export function createLocalNotesAdapter(storage) {
  if (!storage) throw new Error("local notes adapter needs storage");

  function read() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, record: blankRecord() };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.notes)) throw new Error("shape");
      return { ok: true, record: { version: 1, notes: parsed.notes.map(normalizeStored) } };
    } catch {
      return { ok: false, record: blankRecord() };
    }
  }

  function write(record) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, notes: record.notes }));
  }

  return {
    mode: "browser-local",
    notice: LOCAL_NOTICE,
    async list() {
      const loaded = read();
      if (!loaded.ok) return { ok: false, error: "corrupt", notes: [] };
      const notes = loaded.record.notes
        .map((note) => ({ ...note }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return { ok: true, notes };
    },
    async add(input = {}) {
      const loaded = read();
      if (!loaded.ok) return { ok: false, error: "corrupt" };
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!body) return { ok: false, error: "empty" };
      if (body.length > MAX_BODY) return { ok: false, error: "too-long" };
      const targetId = input.targetId || "general";
      if (typeof targetId !== "string" || !TARGET_ID.test(targetId)) return { ok: false, error: "target" };
      const targetTitle = typeof input.targetTitle === "string" ? input.targetTitle.trim() : "";
      if (!targetTitle || targetTitle.length > 180) return { ok: false, error: "title" };
      const note = {
        id: crypto.randomUUID(),
        targetId,
        targetTitle,
        body,
        status: "saved",
        createdAt: new Date().toISOString(),
      };
      try {
        write({ version: 1, notes: [...loaded.record.notes, note] });
      } catch {
        return { ok: false, error: "storage" };
      }
      return { ok: true, note: { ...note } };
    },
    async clear() {
      storage.removeItem(STORAGE_KEY);
      return { ok: true };
    },
  };
}

function normalizeStored(raw) {
  return {
    id: String(raw.id || ""),
    targetId: String(raw.targetId || "general"),
    targetTitle: String(raw.targetTitle || "Untitled"),
    body: String(raw.body || ""),
    status: "saved",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  };
}

export function readStoredNotesKey(storage) {
  if (!storage) return "";
  const value = storage.getItem(KEY_STORAGE);
  return typeof value === "string" ? value.trim() : "";
}

export function createRemoteNotesAdapter(storage, options = {}) {
  if (!storage) throw new Error("remote notes adapter needs storage");
  const endpoint = options.endpoint || NOTES_ENDPOINT;
  const fetcher = options.fetch || globalThis.fetch.bind(globalThis);

  function headers(extra = {}) {
    const key = readStoredNotesKey(storage);
    return {
      "X-House-Request": REQUEST_MARK,
      "X-House-Notes-Key": key,
      Accept: "application/json",
      ...extra,
    };
  }

  async function request(method, path, body) {
    const key = readStoredNotesKey(storage);
    if (!key) return { ok: false, error: "need-key", status: 0 };
    let response;
    try {
      const init = {
        method,
        headers: headers(body ? { "Content-Type": "application/json" } : {}),
        cache: "no-store",
      };
      if (body) init.body = JSON.stringify(body);
      response = await fetcher(path, init);
    } catch {
      return { ok: false, error: "offline", status: 0 };
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "unauthorized", status: response.status, payload };
    }
    if (response.status === 404) return { ok: false, error: "missing", status: 404, payload };
    if (!response.ok) {
      const code = payload && payload.error;
      const error = ["empty", "too-long", "target", "title"].includes(code) ? code : "storage";
      return { ok: false, error, status: response.status, payload };
    }
    return { ok: true, status: response.status, payload };
  }

  return {
    mode: "remote",
    notice: REMOTE_NOTICE,
    hasKey() {
      return Boolean(readStoredNotesKey(storage));
    },
    setKey(value) {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (!trimmed) {
        storage.removeItem(KEY_STORAGE);
        return { ok: false, error: "need-key" };
      }
      storage.setItem(KEY_STORAGE, trimmed);
      return { ok: true };
    },
    clearKey() {
      storage.removeItem(KEY_STORAGE);
    },
    async list() {
      if (!readStoredNotesKey(storage)) return { ok: false, error: "need-key", notes: [] };
      const result = await request("GET", endpoint);
      if (!result.ok) return { ok: false, error: result.error, notes: [] };
      const notes = Array.isArray(result.payload?.notes) ? result.payload.notes.map(normalizeStored) : [];
      notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return { ok: true, notes };
    },
    async add(input = {}) {
      if (!readStoredNotesKey(storage)) return { ok: false, error: "need-key" };
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!body) return { ok: false, error: "empty" };
      if (body.length > MAX_BODY) return { ok: false, error: "too-long" };
      const targetId = input.targetId || "general";
      if (typeof targetId !== "string" || !TARGET_ID.test(targetId)) return { ok: false, error: "target" };
      const targetTitle = typeof input.targetTitle === "string" ? input.targetTitle.trim() : "";
      if (!targetTitle || targetTitle.length > 180) return { ok: false, error: "title" };
      const result = await request("POST", endpoint, {
        body,
        targetId,
        targetTitle,
        clientId: input.clientId || undefined,
      });
      if (!result.ok) return { ok: false, error: result.error };
      const note = result.payload?.note ? normalizeStored(result.payload.note) : null;
      if (!note) return { ok: false, error: "storage" };
      return { ok: true, note, deduped: Boolean(result.payload?.deduped) };
    },
    async remove(id) {
      if (!readStoredNotesKey(storage)) return { ok: false, error: "need-key" };
      if (typeof id !== "string" || !id) return { ok: false, error: "missing" };
      return request("DELETE", `${endpoint}/${encodeURIComponent(id)}`);
    },
    async migrateLocal() {
      if (storage.getItem(MIGRATED_FLAG) === "1") return { ok: true, migrated: 0, skipped: true };
      const local = createLocalNotesAdapter(storage);
      const listed = await local.list();
      if (!listed.ok) return { ok: false, error: "corrupt", migrated: 0 };
      if (!listed.notes.length) {
        storage.setItem(MIGRATED_FLAG, "1");
        return { ok: true, migrated: 0 };
      }
      let migrated = 0;
      for (const note of listed.notes) {
        const result = await this.add({
          body: note.body,
          targetId: note.targetId,
          targetTitle: note.targetTitle,
          clientId: note.id,
        });
        if (!result.ok) return { ok: false, error: result.error, migrated };
        migrated += 1;
      }
      storage.setItem(MIGRATED_FLAG, "1");
      return { ok: true, migrated };
    },
    async clear() {
      // Clears only this browser's cached key and leftover local notes. Server notes stay.
      storage.removeItem(STORAGE_KEY);
      return { ok: true };
    },
  };
}

/** @deprecated Placeholder kept so older tests can still import the name. */
export function createProtectedNotesAdapter() {
  return createRemoteNotesAdapter(memoryStorage());
}

export function groupNotes(notes) {
  const map = new Map();
  for (const note of notes) {
    const targetId = note.targetId || "general";
    if (!map.has(targetId)) {
      map.set(targetId, { targetId, targetTitle: note.targetTitle, notes: [] });
    }
    map.get(targetId).notes.push(note);
  }
  const groups = [...map.values()];
  for (const group of groups) {
    group.notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    group.targetTitle = group.notes[0]?.targetTitle || group.targetTitle;
  }
  groups.sort((a, b) => {
    if (a.targetId === "general") return -1;
    if (b.targetId === "general") return 1;
    return b.notes[0].createdAt.localeCompare(a.notes[0].createdAt);
  });
  return groups;
}
