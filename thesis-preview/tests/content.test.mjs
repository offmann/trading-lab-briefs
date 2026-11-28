import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createArchiveModel } from "../js/data.js";
import {
  buildTimelineDays,
  filterMessages,
  groupMessagesByDay,
  sortMessages,
} from "../js/filter.js";
import {
  extractDomain,
  formatCoverageRange,
  formatDate,
  formatNoteTime,
  formatDayHeading,
  formatSentTime,
  parseBulletText,
} from "../js/format.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawArchive = JSON.parse(fs.readFileSync(path.join(root, "content", "archive.json"), "utf8"));
const model = createArchiveModel(rawArchive);

test("archive coverage and type counts stay consistent with messages, with honest timestamps", () => {
  const dates = model.messages.map((m) => m.date).sort();
  assert.ok(model.messages.length >= 26);
  assert.equal(model.meta.coverage.from, dates[0]);
  assert.equal(model.meta.coverage.to, dates.at(-1));
  assert.equal(model.meta.messageCount, model.messages.length);
  assert.match(model.meta.coverage.label, /Europe\/Paris/);

  const scouts = model.messages.filter((m) => m.type === "scout");
  const briefs = model.messages.filter((m) => m.type === "brief");
  const evenings = model.messages.filter((m) => m.type === "evening");
  const thinkers = model.messages.filter((m) => m.type === "thinkers");
  const shifts = model.messages.filter((m) => m.type === "thesis-change");

  assert.equal(scouts.length, model.meta.counts.scout);
  assert.equal(briefs.length, model.meta.counts.brief);
  assert.equal(evenings.length, model.meta.counts.evening);
  assert.equal(thinkers.length, model.meta.counts.thinkers);
  assert.equal(shifts.length, model.meta.counts["thesis-change"]);
  assert.ok(briefs.length >= 3);
  assert.ok(evenings.length >= 4);
  assert.ok(thinkers.length >= 1);
  assert.ok(shifts.length >= 3);

  for (const scout of scouts) {
    assert.equal(scout.sentAt, null);
    assert.equal(formatSentTime(scout.sentAt), "");
  }
  for (const timed of [...briefs, ...evenings, ...thinkers, ...shifts]) {
    assert.match(timed.sentAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+01:00$/);
    assert.match(formatSentTime(timed.sentAt), /^\d{2}:\d{2} CET$/);
  }
  for (const msg of model.messages) {
    assert.ok(msg.bullets.length >= 3 && msg.bullets.length <= 5, `${msg.id} bullet count`);
    assert.ok(msg.counterView.length > 10);
  }
});

test("dates, evidence markers, and domains format cleanly without inventing clock times", () => {
  assert.equal(formatCoverageRange("2026-11-17", "2026-11-24"), "17–24 Nov 2026");
  assert.equal(formatCoverageRange("2026-11-17", "2026-11-26", { short: true }), "17–26 Nov");
  assert.equal(formatCoverageRange("2026-11-17", "2026-12-03"), "17 Nov–3 Dec 2026");
  assert.equal(formatDate("2026-11-24"), "24 Nov 2026");
  const noteTime = formatNoteTime("2026-11-26T08:41:50.000Z");
  assert.match(noteTime, /26 Nov 2026/);
  assert.match(noteTime, /09:41/);
  assert.match(noteTime, /CET|GMT\+1/);
  assert.equal(formatDayHeading("2026-11-24"), "Tuesday, 24 Nov 2026");
  assert.equal(formatSentTime(null), "");
  assert.equal(formatSentTime("2026-11-23T21:20:00+01:00"), "21:20 CET");

  const parsed = parseBulletText("The SOX fell 17.1 percent on the week. [C][S]");
  assert.equal(parsed.text, "The SOX fell 17.1 percent on the week.");
  assert.deepEqual(parsed.tags.map((t) => t.code), ["C", "S"]);

  assert.equal(extractDomain("https://www.hankyung.com/article/2026112224611"), "hankyung.com");
});

test("five-layer cake maps 13 tiles, respects GEV and AVGO rules, and links messages", () => {
  assert.deepEqual(model.cakeTiers.map((t) => t.id), ["5", "4", "3", "2", "1"]);
  assert.equal(model.tiles.length, 13);

  const gen = model.findTile("1a");
  const grid = model.findTile("1b");
  const permits = model.findTile("1d");
  const compute = model.findTile("2a");
  const memory = model.findTile("2b");
  const net = model.findTile("2c");
  const neo = model.findTile("3b");
  const apps = model.findTile("5");

  assert.ok(gen.examples.includes("CEG"));
  assert.equal(gen.examples.includes("GEV"), false);
  assert.ok(grid.examples.includes("GEV"));
  assert.ok(grid.isBottleneck);
  assert.equal(permits.examples.length, 0);
  assert.ok(permits.isBottleneck);
  assert.ok(compute.examples.includes("AVGO"));
  assert.equal(net.examples.includes("AVGO"), false);
  assert.equal(net.crossExamples[0].name, "AVGO");
  assert.equal(net.crossExamples[0].primary, "2a");
  assert.equal(memory.heat, "splitting");
  assert.equal(neo.examples.length, 0);
  assert.equal(apps.examples.length, 0);

  for (const tile of model.tiles) {
    assert.ok(tile.linkedMessages.length >= 1, `tile ${tile.id} has linked messages`);
  }
});

test("overview weekly changes and scoreboard match archive versions and theses", () => {
  assert.equal(model.weeklyChanges.length, 4);
  assert.deepEqual(model.weeklyChanges.map((c) => c.version), [1, 2, 3, 4]);
  assert.ok(model.weeklyChanges.every((c) => c.linkedMessages.length >= 1));

  const counts = model.scoreboard.map((lane) => lane.items.length);
  assert.deepEqual(counts, [4, 3, 7]);
});

test("feed filters by type, layer, sublayer, stance, and text and groups by day", () => {
  const uniqueDates = [...new Set(model.messages.map((m) => m.date))].sort();
  assert.ok(filterMessages(model.messages, { type: "brief" }).length >= 3);
  assert.ok(filterMessages(model.messages, { type: "evening" }).length >= 4);
  assert.ok(filterMessages(model.messages, { verdict: "strengthens" }).length >= 4);
  assert.ok(filterMessages(model.messages, { verdict: "weakens" }).length >= 2);

  const l1b = filterMessages(model.messages, { layer: "1b" });
  const l1 = filterMessages(model.messages, { layer: "1" });
  assert.ok(l1b.length >= 2);
  assert.ok(l1.length > l1b.length);

  const search = filterMessages(model.messages, { text: "ERCOT" });
  assert.equal(search.length, 1);
  assert.equal(search[0].id, "scout-2026-11-17-ercot");

  const sorted = sortMessages(model.messages);
  assert.equal(sorted[0].date, uniqueDates.at(-1));
  assert.equal(sorted.at(-1).date, uniqueDates[0]);

  const dayGroups = groupMessagesByDay(model.messages);
  assert.equal(dayGroups.length, uniqueDates.length);
  assert.equal(dayGroups[0].date, uniqueDates.at(-1));

  const timeline = buildTimelineDays(model.meta.coverage.from, model.meta.coverage.to, model.messages);
  assert.ok(timeline.length >= uniqueDates.length);
  assert.equal(timeline.reduce((acc, d) => acc + d.messages.length, 0), model.messages.length);
});
