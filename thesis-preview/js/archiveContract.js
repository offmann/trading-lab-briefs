/**
 * Contract checks for the house-view archive.
 * Importing a private message must not publish it. This module has no publish
 * function and no network calls.
 * It also validates the sanitized public v2 bundle in content/archive.json.
 */

const SENT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const PRIVATE_TYPES = new Set(["brief", "scout", "alert"]);
const PUBLIC_TYPES = new Set(["brief", "scout", "alert", "evening", "thinkers", "thesis-change"]);
const PUBLIC_VERDICTS = new Set(["strengthens", "weakens", "watch", "neutral"]);
const PUBLIC_HEATS = new Set(["tightening", "splitting", "watch", "weakening", "empty"]);
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
  if (!PRIVATE_TYPES.has(message.type)) errors.push("type");
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

export function validatePublicMessage(message) {
  const errors = [];
  if (!message || typeof message !== "object") return { ok: false, errors: ["message"] };
  if (typeof message.id !== "string" || !message.id.trim()) errors.push("id");
  if (typeof message.date !== "string" || !DATE_ONLY.test(message.date)) errors.push("date");
  if (message.sentAt === null) {
    // Unknown clock time remains null.
  } else if (typeof message.sentAt !== "string" || DATE_ONLY.test(message.sentAt) || !SENT_AT.test(message.sentAt)) {
    errors.push("sentAt");
  }
  if (!PUBLIC_TYPES.has(message.type)) errors.push("type");
  if (typeof message.title !== "string" || !message.title.trim()) errors.push("title");
  if (!Array.isArray(message.layers) || !message.layers.length) errors.push("layers");
  if (typeof message.primaryLayer !== "string" || !message.primaryLayer.trim()) errors.push("primaryLayer");
  if (!PUBLIC_VERDICTS.has(message.verdict)) errors.push("verdict");
  if (!Array.isArray(message.bullets) || message.bullets.length < 1 || message.bullets.some((b) => typeof b !== "string" || !b.trim())) {
    errors.push("bullets");
  }
  if (typeof message.counterView !== "string" || !message.counterView.trim()) errors.push("counterView");
  if (!Array.isArray(message.sources)) errors.push("sources");
  else {
    for (const source of message.sources) {
      if (!source || typeof source.name !== "string" || !source.name.trim() || typeof source.url !== "string" || !source.url.trim()) {
        errors.push("sources");
      }
    }
  }
  if (typeof message.provenance !== "string" || !message.provenance.trim()) errors.push("provenance");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function validatePublicArchive(archive) {
  const errors = [];
  if (!archive || typeof archive !== "object") return { ok: false, errors: ["archive"] };
  if (archive.schemaVersion !== 1) errors.push("schemaVersion");
  if (!archive.meta || typeof archive.meta.title !== "string") errors.push("meta");
  if (!archive.houseThesis || !Array.isArray(archive.houseThesis.paragraphs) || !archive.houseThesis.paragraphs.length) {
    errors.push("houseThesis");
  } else if (!Array.isArray(archive.houseThesis.versions) || archive.houseThesis.versions.some((v) => !validateHouseViewVersion(v).ok)) {
    errors.push("houseThesis.versions");
  }
  if (!archive.counterView || typeof archive.counterView.text !== "string") errors.push("counterView");
  if (!Array.isArray(archive.houseRules) || !archive.houseRules.length) errors.push("houseRules");
  if (!Array.isArray(archive.layers) || archive.layers.length !== 5) errors.push("layers");
  else {
    for (const layer of archive.layers) {
      if (!PUBLIC_HEATS.has(layer.heat)) errors.push(`layer.${layer.id}.heat`);
      for (const sub of layer.subs || []) {
        if (!PUBLIC_HEATS.has(sub.heat)) errors.push(`sub.${sub.id}.heat`);
      }
    }
  }
  if (!archive.theses || !Array.isArray(archive.theses.strengthened) || !Array.isArray(archive.theses.qualifiedOrEased) || !Array.isArray(archive.theses.open)) {
    errors.push("theses");
  }
  if (!Array.isArray(archive.messages) || !archive.messages.length) errors.push("messages");
  else {
    for (const msg of archive.messages) {
      const check = validatePublicMessage(msg);
      if (!check.ok) errors.push(`message.${msg.id || "unknown"}:${check.errors.join(",")}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
