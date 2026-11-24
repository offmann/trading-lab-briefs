/** Local design-preview notes. This adapter never talks to a network. */

export const LOCAL_NOTICE = "Saved on this browser only — not sent to your advisor.";
export const MAX_BODY = 2000;
export const STORAGE_KEY = "house-view-preview-notes-v1";

const TARGET_ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;

export const NOTE_ERRORS = {
  empty: "Write a note before saving. Nothing was sent.",
  "too-long": "That note is too long for this preview (2,000 characters). Nothing was sent.",
  target: "This note is missing a valid section link. Nothing was sent.",
  title: "This note is missing a section title. Nothing was sent.",
  storage: "This browser refused to store the note. Nothing was sent.",
  corrupt: "Notes already in this browser could not be read. They were not sent anywhere. Saving is paused until you remove them from this browser.",
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
    // This browser cannot record a review. A stored "reviewed" flag is coerced back.
    status: "saved",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  };
}

/** Placeholder for a later Worker + D1 adapter. It does not authenticate and it does not store. */
export function createProtectedNotesAdapter() {
  const refuse = async () => {
    throw new Error("Protected notes API is not configured. This design preview stores notes in the browser only.");
  };
  return {
    mode: "protected-unconfigured",
    notice: LOCAL_NOTICE,
    list: refuse,
    add: refuse,
    clear: refuse,
  };
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
