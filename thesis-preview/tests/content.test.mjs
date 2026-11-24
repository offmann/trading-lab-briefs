import assert from "node:assert/strict";
import test from "node:test";
import { findSub, layers, preview, researchNotes } from "../js/data.js";
import { filterResearch, sortResearch } from "../js/filter.js";
import { formatDate } from "../js/format.js";

const suppliedUrls = [
  "https://www.ctee.com.tw/news/20261116700965-430201",
  "https://www.recursion.com/news/rec-4881",
  "https://www.trendforce.com/presscenter/news/20261119-13314.html",
  "https://openrouter.ai/data/october-2026",
  "https://www.nashnova.com/feed/special/cpo-volume-shipments-delayed-to-2028-as-hybrid-bonding-yield-becomes-core-17842",
  "https://lambda.com/blog/worlds-first-large-scale-deployment-of-nvidia-photonics-switches-with-cpo",
  "https://www.sec.gov/Archives/edgar/data/824142/000082414226000088/aaon-20260930.htm",
  "https://www.hankyung.com/article/2026112224611",
];

test("preview is a dated sample of seven scouts and no invented send times", () => {
  assert.equal(researchNotes.length, 7);
  assert.equal(preview.latestObservation, "2026-11-24");
  assert.match(preview.coverage, /Not the full archive/);
  for (const note of researchNotes) {
    assert.equal(note.type, "scout");
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(note.sentAt, undefined);
    assert.ok(note.fact && note.inference && note.counter && note.unknown);
    assert.ok(note.sources.length);
  }
  const urls = researchNotes.flatMap((note) => note.sources.map((source) => source.url));
  assert.deepEqual(urls, suppliedUrls);
  assert.equal(researchNotes.at(-1).sources[0].check, "unconfirmed");
  assert.ok(researchNotes.slice(0, -1).every((note) => note.sources.every((source) => source.check === "responded")));
});

test("dates format without inventing a clock time", () => {
  assert.equal(formatDate("2026-11-24"), "24 Nov 2026");
  assert.equal(formatDate("2026-11-21"), "21 Nov 2026");
});

test("GEV is equipment, and AVGO has one primary category", () => {
  const generation = findSub("1a").sub;
  const grid = findSub("1b").sub;
  const networking = findSub("2c").sub;
  const compute = findSub("2a").sub;
  assert.ok(generation.examples.includes("CEG"));
  assert.equal(generation.examples.includes("GEV"), false);
  assert.ok(grid.examples.includes("GEV"));
  assert.ok(grid.examples.includes("ETN"));
  assert.match(grid.overlap, /not a power producer/);
  assert.ok(compute.examples.includes("AVGO"));
  assert.equal(networking.examples.includes("AVGO"), false);
  assert.equal(networking.crossExamples[0].primary, "2a");
  assert.deepEqual(findSub("2b").sub.nested.map((item) => item.id), ["2b-hbm", "2b-nand"]);
  assert.equal(findSub("3b").sub.examples.length, 0);
  assert.equal(findSub("1d").sub.examples.length, 0);
  assert.equal(layers.find((layer) => layer.id === "4").subs.length, 0);
  assert.equal(layers.find((layer) => layer.id === "5").subs.length, 0);
});

test("filters cover date, type, layer, verdict, and search", () => {
  assert.equal(filterResearch(researchNotes, { type: "brief" }).length, 0);
  assert.equal(filterResearch(researchNotes, { type: "alert" }).length, 0);
  assert.equal(filterResearch(researchNotes, { type: "scout" }).length, 7);
  assert.equal(filterResearch(researchNotes, { from: "2026-11-22", to: "2026-11-22" }).length, 2);
  assert.equal(filterResearch(researchNotes, { verdict: "weakens" }).length, 2);
  assert.equal(filterResearch(researchNotes, { verdict: "strengthens" }).length, 1);
  const memory = filterResearch(researchNotes, { layer: "2b" });
  assert.ok(memory.some((note) => note.id === "scout-2026-11-22-nand"));
  const chips = filterResearch(researchNotes, { layer: "2" });
  assert.ok(chips.length > memory.length);
  const nand = filterResearch(researchNotes, { text: "NAND" });
  assert.equal(nand.length, 1);
  assert.equal(nand[0].id, "scout-2026-11-22-nand");
  assert.equal(sortResearch(researchNotes)[0].date, "2026-11-24");
});
