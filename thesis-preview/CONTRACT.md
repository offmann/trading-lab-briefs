# Future contract — not active

Do not deploy this preview. Do not create Cloudflare resources, Wrangler config, Access applications, or D1 databases from this document. Nothing here is a login, and nothing here publishes the gallery or the notes.

The public paper-experiment gallery stays on GitHub Pages from `/docs`. This preview is a separate static site. If it is ever hosted, use a new Cloudflare Workers Static Assets site. Do not migrate the gallery off Pages as part of that work.

## What is public, and what is not

This folder is safe to serve as static files. It holds a labelled sample of research notes, the layer map, and the house rules. It does not hold a personal message archive, holdings, or comments.

Two stores stay off the static bundle:

1. The complete message archive, once it exists.
2. Notes the reader jots while reading.

Both need an access boundary in front of them. Hiding a panel in the browser is not that boundary.

## Notes the reader can jot

One inbox. One composer. A note can be general, or it can be tied to a stable section id and title (a layer, an idea, a research note, a rule group). There are no threads and no replies.

User-facing status has two honest values:

| Status | Meaning |
| --- | --- |
| Saved | The note was stored for the owner. |
| Reviewed | Someone recorded an actual review. |

Saving does not mean reviewed. A network receipt does not mean reviewed. An acknowledgement from a scheduled run does not mean reviewed. The design preview only stores `saved`, in the browser, and says so: “Saved on this browser only — not sent to your advisor.”

A note is a comment. It does not authorize a trade, a transfer, a send, a deploy, or a skipped confirmation. Sensitive actions still need approval in Grok Bot chat. Scheduled brief, scout, and evening runs keep their existing schedules. This preview does not add or change a routine.

### Adapter

`js/notes.js` exposes:

- `createLocalNotesAdapter(storage)` — used now. No network.
- `createProtectedNotesAdapter()` — refuses every call. It is the seam for a later Worker. It must not be wired up until the API below exists and its tests pass.

The local adapter ignores any attempt to pass `status: "reviewed"` and, if storage was edited by hand, still reports `saved`.

### Later API, owner and service split

Suggested shape only. Do not implement it in this branch.

Static files stay on Workers Static Assets (`assets.directory` pointing at this preview, no Worker required for the HTML). The notes API is a separate Worker route, with `run_worker_first` limited to `/api/notes*`, so a note is never uploaded as a static asset.

Owner routes, browser session via Cloudflare Access (the owner’s identity, including a work Mac). Access is the login. Do not add a fake sign-in gate in the page.

- `GET /api/notes` — this owner’s notes.
- `POST /api/notes` — create one note. Body: `clientId`, `targetId`, `targetTitle`, `body`. Status is always `saved`.

Service routes, for the existing runs that already check in on their own schedule. A service credential only. The owner’s browser cookie must not be enough, and the service credential must not be accepted as the owner.

- `GET /api/notes/unread` — notes not yet acknowledged. Minimal fields.
- `POST /api/notes/ack` — idempotent acknowledgement. Require an `Idempotency-Key`. Record the delivery cursor. Do not change status to `reviewed`.

A review is a separate explicit write, not a side effect of create, fetch, or ack.

CSRF: owner mutations require Access plus a non-simple header such as `X-House-Request: notes`, so a cross-site form cannot post. Service routes reject cookies.

Size: body at most 2,000 characters, title at most 180, request body capped (8 KB is enough). Over the cap, reject. Render note text as text. Do not log bodies, titles, archive text, or credentials. When a Worker is eventually approved, enable Workers logs and traces, with those fields redacted.

Isolation: every owner query is bound to the Access identity. The service credential is bound to the single configured owner and cannot pass a different owner id. `clientId` is unique per owner so a retry does not duplicate the note.

Minimal D1 shape, not created:

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('saved', 'reviewed')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE (owner_id, client_id)
);

CREATE TABLE note_acks (
  note_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  acked_at TEXT NOT NULL,
  PRIMARY KEY (note_id, idempotency_key)
);
```

`note_acks` is a delivery cursor. It is not the reviewed status.

Tests required before this API is turned on (not claimed as done):

- Owner A cannot read or write owner B.
- A browser session cannot call unread or ack.
- A service credential cannot create notes or set reviewed.
- Ack with the same idempotency key is a no-op the second time.
- Ack does not flip status to reviewed.
- Create stores saved only.
- Oversized bodies are rejected.
- Responses and logs contain no credential material.
- Note bodies render as text.

## Message archive, later and private

The preview is a hand-cut sample. It is not the archive. A future importer accepts messages into a protected store and does not publish them.

Required fields: message id, original text, `sentAt` with a timezone when it is known, type (`brief`, `scout`, or `alert`), tags, sources, corrections, provenance. If the send time is unknown, store null. Never invent a clock time or a timezone. `js/archiveContract.js` checks that shape. It has no publish function.

History is immutable: a correction is appended, and the original text stays. The house view is a separate versioned record (`version`, `effectiveOn`, `summary`, `supersedes`), not a rewrite of old messages.

Publishing to the public preview is a deliberate later step, not a side effect of import, and not a GitHub Action on this branch. The gallery rebuild workflow is unrelated and must not be pointed at this folder.

Before an importer is allowed to run, tests must show that:

- a missing id is rejected
- a date-only `sentAt` is rejected
- a null `sentAt` is kept
- import does not write public files
- corrections do not change `originalText`
- secrets and note bodies cannot land in the static output

## Access from a work Mac

When the owner wants the private archive and the notes API off this laptop, put Cloudflare Access in front of those routes only. The static sample can stay unauthenticated because it has no personal archive and no notes in the bundle. Do not configure Access, a service token, or a hostname in this repository.
