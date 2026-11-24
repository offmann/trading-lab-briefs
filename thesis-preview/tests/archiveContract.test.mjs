import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCorrection,
  validateHouseViewVersion,
  validateIncomingMessage,
} from "../js/archiveContract.js";

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

test("the contract module does not publish", async () => {
  const module = await import("../js/archiveContract.js");
  assert.equal(module.publish, undefined);
  assert.equal(module.importAndPublish, undefined);
});
