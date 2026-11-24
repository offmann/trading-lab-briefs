/**
 * Contract checks for a future private importer.
 * Importing a message must not publish it. This module has no publish function
 * and no network calls. The preview does not run an importer.
 */

const SENT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(["brief", "scout", "alert"]);
const SOURCE_CHECKS = new Set(["responded", "unconfirmed", "unavailable"]);

export function validateIncomingMessage(message) {
  const errors = [];
  if (!message || typeof message !== "object") {
    return { ok: false, errors: ["message"] };
  }
  if (typeof message.id !== "string" || !message.id.trim()) errors.push("id");
  if (typeof message.originalText !== "string" || !message.originalText.trim()) {
    errors.push("originalText");
  }
  if (message.sentAt == null) {
    // Unknown send time stays unknown. Do not invent one.
  } else if (typeof message.sentAt !== "string" || DATE_ONLY.test(message.sentAt) || !SENT_AT.test(message.sentAt)) {
    errors.push("sentAt");
  }
  if (!TYPES.has(message.type)) errors.push("type");
  if (!Array.isArray(message.tags) || message.tags.some((tag) => typeof tag !== "string")) {
    errors.push("tags");
  }
  if (!Array.isArray(message.sources)) errors.push("sources");
  else {
    for (const source of message.sources) {
      if (!source || typeof source.url !== "string" || !source.url.trim()) errors.push("sources");
      else if (source.check != null && !SOURCE_CHECKS.has(source.check)) errors.push("sources");
    }
  }
  if (message.corrections != null && !Array.isArray(message.corrections)) errors.push("corrections");
  if (message.provenance != null && typeof message.provenance !== "string") errors.push("provenance");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/** History is append-only. The original text is kept verbatim. */
export function appendCorrection(message, correction) {
  if (!correction || typeof correction.note !== "string" || !correction.note.trim()) {
    throw new Error("correction note required");
  }
  if (typeof correction.at !== "string" || !SENT_AT.test(correction.at)) {
    throw new Error("correction at must include a timezone");
  }
  return {
    ...message,
    originalText: message.originalText,
    corrections: [...(message.corrections || []), { ...correction }],
  };
}

export function validateHouseViewVersion(version) {
  const errors = [];
  if (!version || typeof version !== "object") return { ok: false, errors: ["version"] };
  if (!Number.isInteger(version.version) || version.version < 1) errors.push("version");
  if (typeof version.effectiveOn !== "string" || !DATE_ONLY.test(version.effectiveOn)) {
    errors.push("effectiveOn");
  }
  if (typeof version.summary !== "string" || !version.summary.trim()) errors.push("summary");
  if (version.supersedes != null && (!Number.isInteger(version.supersedes) || version.supersedes < 1)) {
    errors.push("supersedes");
  }
  return { ok: errors.length === 0, errors };
}
