# House-view archive (public, sanitized)

This folder is the content file for the v2 house-view site. It is a public, privacy-safe copy of messages that were actually sent. The coverage window lives in `meta.coverage` and is derived from the messages in the file (Europe/Paris). It is not the complete historical archive.

Silent off-day briefs and silent evening checks are omitted. Personal allocations, amounts, fills, and trigger prices were stripped or rewritten as qualitative watch lines. Tickers are macro examples of a mechanism. They are not holdings, allocations, or recommendations.

The file is shaped so it can live inside `thesis-preview/` without failing the existing public-site privacy tests: no dollar-sign amounts, no GW/MW abbreviations after a number, and no mailbox addresses.

## File

- `archive.json` — the bundle the renderer should read.

## Top-level shape

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Currently `1`. |
| `meta` | Title, timezone, generation time, date range, privacy note, and counts by type. |
| `houseThesis` | Current paragraphs plus dated `versions` (`version`, `effectiveOn`, `summary`, `supersedes`). |
| `counterView` | The strongest counter-view as of the latest scan. |
| `houseRules` | Rule groups with short items. |
| `layers` | Five layers and sublayers, each with qualitative `heat` and a bottleneck note. Examples are mechanism names only. |
| `theses` | `strengthened`, `qualifiedOrEased`, and `open` thesis cards. |
| `pulse` | Short sublayer-pulse lines for the overview. |
| `messages` | Timeline items, oldest first. |

## Message fields

| Field | Meaning |
| --- | --- |
| `id` | Stable public id, such as `brief-2026-11-22` or `scout-2026-11-24-transformers`. |
| `sourceId` | Optional internal log id (for scouts, the `A-YYYYMMDD-NN` key). |
| `date` | `YYYY-MM-DD` in Europe/Paris. |
| `sentAt` | ISO-8601 with a timezone offset when the send or preparation time is known. `null` when only the date is known. Do not invent a clock time. |
| `timezone` | Always `Europe/Paris`. |
| `type` | `brief` · `scout` · `alert` · `evening` · `thinkers` · `thesis-change`. |
| `title` | One-line, content-first headline. |
| `layers` | Sublayer or layer ids (`1a`…`5`). |
| `primaryLayer` | The lead tag. |
| `verdict` | `strengthens` · `weakens` · `watch` · `neutral`. |
| `bullets` | Three to five short factual bullets. |
| `counterView` | One counter-view line, required. |
| `sources` | `{ name, url }` objects. Link-check status is not restated here. |
| `provenance` | Where the public wording was drawn from. |

`evening` is used for sent evening checks (the older private importer contract only listed `brief`, `scout`, and `alert`). A renderer can treat `evening` as an alert-like card.

## What was dropped

- Silent off-day briefs on 17, 19, 21, and 23 Nov.
- Silent evening checks on 17, 18, and 22 Nov.
- A 17 Nov Nvidia earnings flash that was logged internally and covered in the 18 Nov brief, not confirmed as a separate sent message.
- The 16 Nov brief (just outside this window) and any 24 Nov scheduled brief (not yet written when this file was compiled).
- Actual trade details, allocation splits, book figures, and personal trigger prices.

Scout clock times were not stored in the alpha log, so those `sentAt` values are null.
