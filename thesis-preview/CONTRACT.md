# House-view contract

The public paper-experiment gallery stays on GitHub Pages from `/docs`. This folder is a separate Cloudflare Workers Static Assets site. Do not migrate the gallery off Pages as part of this work.

Do not deploy the notes API without authentication in front of every `/api/notes` route. Do not put note bodies, titles, or credentials in the static bundle, in Workers logs, or in git. Nothing here publishes the gallery, and nothing in the public pages is a login.

## What is public, and what is not

This folder is safe to serve as static files. It holds a labelled sample of research notes, the layer map, and the house rules. It does not hold a personal message archive, holdings, or comments.

Two stores stay off the static bundle:

1. The complete private message archive, once it exists.
2. Notes the reader jots while reading, now stored in a private Cloudflare database and served only at `/api/notes*`.

Both need an access boundary in front of them. Hiding a panel in the browser is not that boundary.

## Notes the reader can jot

One inbox. One composer. A note can be general, or it can be tied to a stable section id and title (a layer, an idea, a research note, a rule group). There are no threads and no replies.

User-facing status has two honest values:

| Status | Meaning |
| --- | --- |
| Saved | The note was stored for the owner. |
| Reviewed | Someone recorded an actual review. |

Saving does not mean reviewed. A network receipt does not mean reviewed. An acknowledgement from a scheduled run does not mean reviewed. Create stores `saved` only.

A note is a comment. It does not authorize a trade, a transfer, a send, a deploy, or a skipped confirmation. Sensitive actions still need approval in Grok Bot chat. Scheduled brief, scout, and evening runs keep their existing schedules. This site does not add or change a routine.

Offline or rejected drafts stay in the composer and are not sent to your advisor until a later successful save.

### API

Static files stay on Workers Static Assets (`assets.directory` pointing at `public/`). The notes API is the Worker route, with `run_worker_first` limited to `/api/*`, so a note is never uploaded as a static asset.

Preferred login is Cloudflare Access (the owner's identity, including a work Mac). Access is not enabled on this account, and the deploy token cannot create Access applications or a D1 database (`Account - D1:Edit` is missing from the Edit Cloudflare Workers token). This deploy therefore uses a Workers KV namespace and a Worker secret as the read/write key. The key is entered once in the browser and kept in `localStorage`. Do not commit it.

Owner routes:

- `GET /api/notes` — this owner's notes.
- `POST /api/notes` — create one note. Body: `clientId`, `targetId`, `targetTitle`, `body`. Status is always `saved`. A repeated `clientId` is idempotent and does not duplicate the note.
- `DELETE /api/notes/:id` — remove one note.

CSRF: owner mutations require the notes key plus a non-simple header (`X-House-Request: notes`), so a cross-site form cannot post.

Size: body at most 2,000 characters, title at most 180, request body capped (8 KB is enough). Over the cap, reject. Render note text as text. Do not log bodies, titles, archive text, or credentials.

Existing browser-only notes are migrated up on first successful unlock.

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

The static sample stays unauthenticated because it has no personal archive and no notes in the bundle. Cloudflare Access remains the preferred login for `/api/notes*` when the account has Access enabled and the deploy token can configure it. Until then, the Worker secret is the access boundary. Do not put the secret, a service token, or a mailbox address in this repository.
