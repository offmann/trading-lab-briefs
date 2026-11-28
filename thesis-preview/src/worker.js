/**
 * House-view Worker: private notes API in front of static assets.
 * /api/notes is authenticated. Static files are served by Workers Static Assets.
 * Do not log note bodies, titles, or credentials.
 */

const MAX_BODY = 2000;
const MAX_TITLE = 180;
const MAX_REQUEST_BYTES = 8 * 1024;
const TARGET_ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const NOTE_ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const REQUEST_MARK = "notes";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/notes" || url.pathname.startsWith("/api/notes/")) {
      return handleNotesRequest(request, env);
    }
    return new Response("Not found", { status: 404, headers: jsonHeaders() });
  },
};

export async function handleNotesRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders() });
  }

  const auth = await authorize(request, env);
  if (!auth.ok) return auth.response;

  try {
    if (request.method === "GET" && url.pathname === "/api/notes") {
      return json(200, { notes: await listNotes(env) });
    }
    if (request.method === "POST" && url.pathname === "/api/notes") {
      return createNote(request, env);
    }
    const del = /^\/api\/notes\/([^/]+)$/.exec(url.pathname);
    if (request.method === "DELETE" && del) {
      return deleteNote(decodeURIComponent(del[1]), env);
    }
    return json(404, { error: "not found" });
  } catch {
    return json(500, { error: "notes store failed" });
  }
}

async function authorize(request, env) {
  const expected = typeof env.NOTES_KEY === "string" ? env.NOTES_KEY.trim() : "";
  if (!expected) {
    return { ok: false, response: json(503, { error: "notes store is not configured" }) };
  }
  if (request.headers.get("X-House-Request") !== REQUEST_MARK) {
    return { ok: false, response: json(401, { error: "unauthorized" }) };
  }
  const provided = extractKey(request);
  if (!provided || !(await secretsEqual(provided, expected))) {
    return { ok: false, response: json(401, { error: "unauthorized" }) };
  }
  return { ok: true };
}

function extractKey(request) {
  const header = request.headers.get("X-House-Notes-Key") || "";
  if (header.trim()) return header.trim();
  const auth = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : "";
}

async function secretsEqual(a, b) {
  const enc = new TextEncoder();
  const left = await crypto.subtle.digest("SHA-256", enc.encode(a));
  const right = await crypto.subtle.digest("SHA-256", enc.encode(b));
  const aa = new Uint8Array(left);
  const bb = new Uint8Array(right);
  if (aa.byteLength !== bb.byteLength) return false;
  let out = 0;
  for (let i = 0; i < aa.byteLength; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

async function listNotes(env) {
  if (!env.NOTES) throw new Error("missing NOTES binding");
  const notes = [];
  let cursor;
  do {
    const page = await env.NOTES.list({ prefix: "note:", cursor, limit: 1000 });
    for (const key of page.keys || []) {
      const row = await env.NOTES.get(key.name, "json");
      if (row && row.id) notes.push(publicNote(row));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return notes;
}

async function createNote(request, env) {
  const lengthHeader = Number(request.headers.get("content-length") || 0);
  if (lengthHeader > MAX_REQUEST_BYTES) return json(413, { error: "too-large" });
  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return json(413, { error: "too-large" });
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { error: "invalid-json" });
  }
  if (!payload || typeof payload !== "object") return json(400, { error: "invalid-json" });

  const body = typeof payload.body === "string"
    ? payload.body.trim()
    : (typeof payload.text === "string" ? payload.text.trim() : "");
  if (!body) return json(400, { error: "empty" });
  if (body.length > MAX_BODY) return json(400, { error: "too-long" });

  const targetId = payload.targetId || payload.itemId || "general";
  if (typeof targetId !== "string" || !TARGET_ID.test(targetId)) return json(400, { error: "target" });
  const targetTitle = typeof payload.targetTitle === "string" ? payload.targetTitle.trim() : "";
  if (!targetTitle || targetTitle.length > MAX_TITLE) return json(400, { error: "title" });

  const clientId = typeof payload.clientId === "string" && payload.clientId.trim()
    ? payload.clientId.trim()
    : null;
  if (clientId && !NOTE_ID.test(clientId)) return json(400, { error: "client" });

  if (clientId) {
    const existingId = await env.NOTES.get(`client:${clientId}`);
    if (existingId) {
      const existing = await env.NOTES.get(`note:${existingId}`, "json");
      if (existing) return json(200, { ok: true, note: publicNote(existing), deduped: true });
    }
  }

  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID(),
    targetId,
    targetTitle,
    body,
    status: "saved",
    createdAt: now,
    clientId,
  };
  await env.NOTES.put(`note:${note.id}`, JSON.stringify(note));
  if (clientId) await env.NOTES.put(`client:${clientId}`, note.id);
  return json(201, { ok: true, note: publicNote(note) });
}

async function deleteNote(id, env) {
  if (!id || !NOTE_ID.test(id)) return json(400, { error: "id" });
  const existing = await env.NOTES.get(`note:${id}`, "json");
  if (!existing) return json(404, { error: "not found" });
  await env.NOTES.delete(`note:${id}`);
  if (existing.clientId) await env.NOTES.delete(`client:${existing.clientId}`);
  return json(200, { ok: true, id });
}

function publicNote(row) {
  return {
    id: String(row.id),
    targetId: String(row.targetId || "general"),
    targetTitle: String(row.targetTitle || ""),
    body: String(row.body || ""),
    text: String(row.body || ""),
    createdAt: String(row.createdAt || ""),
    created_at: String(row.createdAt || ""),
    itemId: String(row.targetId || "general"),
    status: "saved",
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders() });
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
