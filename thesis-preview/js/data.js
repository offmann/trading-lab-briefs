/**
 * Domain model and loader for the sanitized public archive (content/archive.json).
 * Reported macro observations and house framework only; never holdings or orders.
 */

import { validatePublicArchive } from "./archiveContract.js";
import { buildTimelineDays, sortMessages } from "./filter.js";

export const VERDICTS = {
  strengthens: "Strengthens",
  weakens: "Weakens",
  watch: "Watch",
  neutral: "Neutral",
};

export const TYPES = {
  brief: "Brief",
  scout: "Scout",
  evening: "Evening check",
  thinkers: "Thinkers scan",
  "thesis-change": "Thesis shift",
  alert: "Alert",
};

export const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "brief", label: "Briefs" },
  { id: "scout", label: "Scouts" },
  { id: "evening", label: "Evening" },
  { id: "thinkers", label: "Thinkers" },
  { id: "thesis-change", label: "Thesis shifts" },
];

export const HEAT_META = {
  tightening: {
    id: "tightening",
    label: "Tightening",
    shortLabel: "Tightening",
    family: "tightening",
    description: "Scarce capacity or permission",
  },
  splitting: {
    id: "splitting",
    label: "Splitting",
    shortLabel: "Splitting",
    family: "splitting",
    description: "HBM/DRAM tight while NAND softens",
  },
  watch: {
    id: "watch",
    label: "Unchanged · Watch",
    shortLabel: "Unchanged",
    family: "unchanged",
    description: "Direction unchanged; key variable under watch",
  },
  weakening: {
    id: "weakening",
    label: "Weakening",
    shortLabel: "Weakening",
    family: "weakening",
    description: "Pricing power or scarcity thinning",
  },
  empty: {
    id: "empty",
    label: "Unchanged · Early",
    shortLabel: "Unchanged",
    family: "unchanged",
    description: "Early signals only; box kept empty",
  },
};

const TILE_PRESENTATION = {
  "1a": {
    shortName: "Power generation",
    bottleneckTag: "Deliverable power scarce",
    isBottleneck: true,
  },
  "1b": {
    shortName: "Grid & electrical gear",
    bottleneckTag: "HV transformers tight",
    isBottleneck: true,
  },
  "1c": {
    shortName: "DC plant & cooling",
    bottleneckTag: "Cooling catching up?",
    isBottleneck: false,
  },
  "1d": {
    shortName: "Land & permits",
    bottleneckTag: "Binding permit queue",
    isBottleneck: true,
  },
  "2a": {
    shortName: "Compute",
    bottleneckTag: "Financing & mix watch",
    isBottleneck: false,
  },
  "2b": {
    shortName: "Memory",
    bottleneckTag: "HBM booked · NAND soft",
    isBottleneck: true,
  },
  "2c": {
    shortName: "Networking",
    bottleneckTag: "CPO yield survey",
    isBottleneck: false,
    crossExamples: [{ name: "AVGO", primary: "2a" }],
  },
  "2d": {
    shortName: "Foundry & equipment",
    bottleneckTag: "Paid first · cash terms",
    isBottleneck: true,
  },
  "3a": {
    shortName: "US hyperscalers",
    bottleneckTag: "Capex & FCF strain",
    isBottleneck: false,
  },
  "3b": {
    shortName: "Neoclouds",
    bottleneckTag: "Credit & prepayments",
    isBottleneck: false,
  },
  "3c": {
    shortName: "China cloud",
    bottleneckTag: "Compute caps vs FCF",
    isBottleneck: false,
  },
  "4": {
    shortName: "Models",
    bottleneckTag: "Thin pricing power",
    isBottleneck: false,
  },
  "5": {
    shortName: "Apps",
    bottleneckTag: "Early signals only",
    isBottleneck: false,
  },
};

const VERSION_LINKS = {
  1: {
    headline: "Demand cleared; debate shifted to financing",
    stance: "watch",
    messageIds: ["thesis-2026-11-18", "brief-2026-11-18"],
  },
  2: {
    headline: "Stress is financing, politics & real rates",
    stance: "watch",
    messageIds: ["thesis-2026-11-20", "brief-2026-11-20"],
  },
  3: {
    headline: "Sublayer map adopted; HBM split from flash",
    stance: "strengthens",
    messageIds: ["thesis-2026-11-22", "brief-2026-11-22"],
  },
  4: {
    headline: "Physical toll meets regulators; Huang restored",
    stance: "watch",
    messageIds: ["thinkers-2026-11-23", "evening-2026-11-23-huang"],
  },
};

export const THESIS_SUMMARY_LINES = [
  "AI infrastructure is a five-layer stack where software moats look thin, so durable value accrues lower in the stack — shifting from chips toward already-connected power, high-voltage grid gear, and permitted sites.",
  "Apply the toll-versus-shortage test before chasing scarcity: operator demand stayed firm through mid-November while financing quality, regulators, politics, and real rates became the live stress.",
];

export function createArchiveModel(raw) {
  const check = validatePublicArchive(raw);
  if (!check.ok) {
    throw new Error(`Invalid archive bundle: ${check.errors.join("; ")}`);
  }

  const pulseByLayer = new Map();
  for (const item of raw.pulse || []) {
    pulseByLayer.set(item.layer, item);
  }

  const sortedMessages = sortMessages(raw.messages);
  const messageById = new Map(raw.messages.map((msg) => [msg.id, msg]));

  const tileById = new Map();
  const normalizedLayers = raw.layers.map((layer) => {
    const subs = (layer.subs || []).map((sub) => {
      const pres = TILE_PRESENTATION[sub.id] || {};
      const linkedMessages = sortedMessages.filter((msg) => (msg.layers || []).includes(sub.id));
      const tile = {
        id: sub.id,
        layerId: layer.id,
        layerName: layer.name,
        name: sub.name,
        shortName: pres.shortName || sub.name,
        heat: sub.heat,
        heatMeta: HEAT_META[sub.heat] || HEAT_META.watch,
        bottleneck: sub.bottleneck,
        bottleneckTag: pres.bottleneckTag || "",
        isBottleneck: Boolean(pres.isBottleneck),
        examples: [...(sub.examples || [])],
        crossExamples: pres.crossExamples ? [...pres.crossExamples] : [],
        notes: sub.notes || "",
        pulse: pulseByLayer.get(sub.id) || null,
        linkedMessages,
      };
      tileById.set(tile.id, tile);
      return tile;
    });

    let selfTile = null;
    if (!subs.length) {
      const pres = TILE_PRESENTATION[layer.id] || {};
      const linkedMessages = sortedMessages.filter((msg) => (msg.layers || []).includes(layer.id));
      selfTile = {
        id: layer.id,
        layerId: layer.id,
        layerName: layer.name,
        name: layer.name,
        shortName: pres.shortName || layer.name,
        line: layer.line,
        heat: layer.heat,
        heatMeta: HEAT_META[layer.heat] || HEAT_META.watch,
        bottleneck: layer.bottleneck,
        bottleneckTag: pres.bottleneckTag || "",
        isBottleneck: Boolean(pres.isBottleneck),
        examples: [...(layer.examples || [])],
        crossExamples: [],
        notes: layer.notes || "",
        pulse: pulseByLayer.get(layer.id) || null,
        linkedMessages,
      };
      tileById.set(selfTile.id, selfTile);
    }

    return {
      id: layer.id,
      name: layer.name,
      line: layer.line,
      heat: layer.heat,
      heatMeta: HEAT_META[layer.heat] || HEAT_META.watch,
      subs,
      tiles: subs.length ? subs : [selfTile],
    };
  });

  // Stack top-down (Layer 5 Apps -> Layer 1 Physical foundation) for the visual layer cake.
  const cakeTiers = [...normalizedLayers].reverse();

  const weeklyChanges = (raw.houseThesis.versions || []).map((ver) => {
    const extra = VERSION_LINKS[ver.version] || {};
    const linked = (extra.messageIds || [])
      .map((id) => messageById.get(id))
      .filter(Boolean);
    return {
      id: `version.${ver.version}`,
      version: ver.version,
      effectiveOn: ver.effectiveOn,
      supersedes: ver.supersedes,
      headline: extra.headline || `House view v${ver.version}`,
      stance: extra.stance || "watch",
      summary: ver.summary,
      linkedMessages: linked,
    };
  });

  const scoreboard = [
    {
      id: "strengthened",
      label: "Strengthened",
      verdict: "strengthens",
      items: raw.theses.strengthened.map((item) => ({ ...item, verdict: "strengthens" })),
    },
    {
      id: "qualifiedOrEased",
      label: "Qualified / Eased",
      verdict: "weakens",
      items: raw.theses.qualifiedOrEased.map((item) => ({ ...item, verdict: "weakens" })),
    },
    {
      id: "open",
      label: "Open / Watch",
      verdict: "watch",
      items: raw.theses.open.map((item) => ({ ...item, verdict: "watch" })),
    },
  ];

  const timelineDays = buildTimelineDays(
    raw.meta.coverage?.from,
    raw.meta.coverage?.to,
    raw.messages,
  );

  const layerById = new Map(normalizedLayers.map((l) => [l.id, l]));

  function findLayer(id) {
    return layerById.get(id) || null;
  }

  function findTile(id) {
    return tileById.get(id) || null;
  }

  function findMessage(id) {
    return messageById.get(id) || null;
  }

  function layerLabel(id) {
    if (!id) return "";
    const tile = tileById.get(id);
    if (tile) {
      return /^[1-5]$/.test(tile.id) ? `L${tile.id} ${tile.shortName}` : `${tile.id} ${tile.shortName}`;
    }
    const top = layerById.get(id);
    if (top) return `L${top.id} ${top.name}`;
    return id;
  }

  function layerCodeLabel(id) {
    if (!id) return "";
    return /^[1-5]$/.test(id) ? `L${id}` : id;
  }

  return {
    meta: raw.meta,
    thesisSummaryLines: THESIS_SUMMARY_LINES,
    houseThesis: raw.houseThesis,
    counterView: raw.counterView,
    houseRules: raw.houseRules,
    layers: normalizedLayers,
    cakeTiers,
    tiles: [...tileById.values()],
    weeklyChanges,
    scoreboard,
    pulse: raw.pulse || [],
    messages: raw.messages,
    sortedMessages,
    timelineDays,
    findLayer,
    findTile,
    findMessage,
    layerLabel,
    layerCodeLabel,
  };
}

export async function loadArchive(fetchImpl = globalThis.fetch) {
  const archiveUrl = new URL("../content/archive.json", import.meta.url);
  const response = await fetchImpl(archiveUrl);
  if (!response.ok) {
    throw new Error(`Could not load archive.json (HTTP ${response.status})`);
  }
  const raw = await response.json();
  return createArchiveModel(raw);
}
