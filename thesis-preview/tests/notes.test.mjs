import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalNotesAdapter,
  createProtectedNotesAdapter,
  groupNotes,
  memoryStorage,
  NOTE_ERRORS,
} from "../js/notes.js";

test("local save stays saved and never becomes reviewed", async () => {
  const storage = memoryStorage();
  const adapter = createLocalNotesAdapter(storage);
  const saved = await adapter.add({
    body: "  Look at memory again.  ",
    targetId: "layer.2b",
    targetTitle: "2b Memory",
    status: "reviewed",
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.note.status, "saved");
  assert.equal(saved.note.body, "Look at memory again.");
  assert.equal(saved.note.reviewedAt, undefined);
  const listed = await adapter.list();
  assert.equal(listed.notes.length, 1);
  assert.equal(listed.notes[0].status, "saved");
  assert.equal(typeof adapter.acknowledge, "undefined");
  assert.equal(typeof adapter.markReviewed, "undefined");
});

test("a stored reviewed flag is not honoured by the local adapter", async () => {
  const storage = memoryStorage({
    "house-view-preview-notes-v1": JSON.stringify({
      version: 1,
      notes: [{
        id: "n1",
        targetId: "general",
        targetTitle: "General note",
        body: "Already here",
        status: "reviewed",
        reviewedAt: "2026-11-24T00:00:00Z",
        createdAt: "2026-11-24T00:00:00Z",
      }],
    }),
  });
  const adapter = createLocalNotesAdapter(storage);
  const listed = await adapter.list();
  assert.equal(listed.notes[0].status, "saved");
  assert.equal(listed.notes[0].reviewedAt, undefined);
});

test("notes survive a new adapter on the same storage and group by section", async () => {
  const storage = memoryStorage();
  const first = createLocalNotesAdapter(storage);
  await first.add({ body: "General thought", targetId: "general", targetTitle: "General note" });
  await first.add({ body: "On the layer", targetId: "layer.1b", targetTitle: "1b Grid and electrical equipment" });
  const second = createLocalNotesAdapter(storage);
  const listed = await second.list();
  assert.equal(listed.notes.length, 2);
  const groups = groupNotes(listed.notes);
  assert.equal(groups[0].targetId, "general");
  assert.ok(groups.some((group) => group.targetId === "layer.1b"));
  await second.clear();
  assert.deepEqual(await second.list(), { ok: true, notes: [] });
});

test("empty, oversized, and corrupt notes are refused without sending", async () => {
  const storage = memoryStorage();
  const adapter = createLocalNotesAdapter(storage);
  assert.equal((await adapter.add({ body: "   ", targetId: "general", targetTitle: "General note" })).error, "empty");
  assert.equal((await adapter.add({
    body: "x".repeat(2001),
    targetId: "general",
    targetTitle: "General note",
  })).error, "too-long");
  assert.match(NOTE_ERRORS.empty, /Nothing was sent/);
  storage.setItem("house-view-preview-notes-v1", "{not json");
  const broken = createLocalNotesAdapter(storage);
  assert.equal((await broken.list()).ok, false);
  assert.equal((await broken.add({ body: "nope", targetId: "general", targetTitle: "General note" })).error, "corrupt");
});

test("the protected adapter is not a stand-in for login", async () => {
  const adapter = createProtectedNotesAdapter();
  await assert.rejects(() => adapter.list(), /not configured/);
  await assert.rejects(() => adapter.add({ body: "x" }), /browser only/);
});

test("note text is stored as text, including markup", async () => {
  const adapter = createLocalNotesAdapter(memoryStorage());
  const saved = await adapter.add({
    body: "<script>alert(1)</script>",
    targetId: "general",
    targetTitle: "General note",
  });
  assert.equal(saved.note.body, "<script>alert(1)</script>");
});
