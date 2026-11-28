import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  appendCorrection,
  validateHouseViewVersion,
  validateIncomingMessage,
  validatePublicArchive,
  validatePublicMessage,
} from "../js/archiveContract.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const valid = {
  id: "msg-1",
  originalText: "Reported observation.",
  sentAt: null,
  type: "scout",
  tags: ["2b"],
  sources: [{ url: "https://example.com/source", check: "unconfirmed" }],
  corrections: [],
  provenance: "supplied message id",
};

test("a message may omit sentAt and may not invent a date-only timestamp", () => {
  assert.equal(validateIncomingMessage(valid).ok, true);
  assert.equal(validateIncomingMessage({ ...valid, sentAt: "2026-11-21" }).ok, false);
  assert.equal(validateIncomingMessage({ ...valid, sentAt: "2026-11-21T10:00:00" }).ok, false);
  assert.equal(validateIncomingMessage({ ...valid, sentAt: "2026-11-21T10:00:00+01:00" }).ok, true);
  assert.equal(validateIncomingMessage({ ...valid, id: "  " }).errors.includes("id"), true);
});

test("corrections append and the original text stays put", () => {
  const corrected = appendCorrection(valid, {
    at: "2026-11-24T18:00:00Z",
    note: "Later note. Original left as sent.",
  });
  assert.equal(corrected.originalText, valid.originalText);
  assert.equal(valid.corrections.length, 0);
  assert.equal(corrected.corrections.length, 1);
  assert.throws(() => appendCorrection(valid, { at: "2026-11-24", note: "No zone" }));
});

test("house view versions are separate from message history", () => {
  assert.equal(validateHouseViewVersion({
    version: 1,
    effectiveOn: "2026-11-24",
    summary: "Bottlenecks move.",
    supersedes: null,
  }).ok, true);
  assert.equal(validateHouseViewVersion({
    version: 2,
    effectiveOn: "24 Nov 2026",
    summary: "Nope",
  }).ok, false);
});

test("sanitized public archive.json passes full public schema validation", () => {
  const archive = JSON.parse(fs.readFileSync(path.join(root, "content", "archive.json"), "utf8"));
  const result = validatePublicArchive(archive);
  assert.equal(result.ok, true, result.errors.join(", "));
  const badSentAt = validatePublicMessage({
    ...archive.messages[0],
    sentAt: "2026-11-17T09:00:00",
  });
  assert.equal(badSentAt.ok, false);
  assert.ok(badSentAt.errors.includes("sentAt"));
});

test("the contract module does not publish", async () => {
  const module = await import("../js/archiveContract.js");
  assert.equal(module.publish, undefined);
  assert.equal(module.importAndPublish, undefined);
});
