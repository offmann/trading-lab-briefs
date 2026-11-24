import {
  SOURCE_CHECK,
  TYPES,
  VERDICTS,
  layerLabel,
  layers,
  preview,
  researchNotes,
  ruleGroups,
} from "./data.js";
import { filterResearch, sortResearch } from "./filter.js";
import { formatDate, formatSavedAt } from "./format.js";
import {
  LOCAL_NOTICE,
  NOTE_ERRORS,
  createLocalNotesAdapter,
  groupNotes,
} from "./notes.js";

const VIEWS = [
  ["overview", "Overview"],
  ["layers", "Layers"],
  ["timeline", "Timeline"],
  ["rules", "Rules"],
];

const notesAdapter = createLocalNotesAdapter(window.localStorage);

const defaultFilters = { text: "", type: "all", layer: "all", verdict: "all", from: "", to: "" };

let drawerOpen = false;
let composeTarget = null;
let lastOpener = null;
let draft = "";
let formError = "";
let statusMessage = "";
let notesState = { ok: true, notes: [] };
let openLayers = new Set();
let openSubs = new Set();
let openResearch = new Set();
let filters = { ...defaultFilters };
let focusAfterRender = null;
let scrollTopNext = false;

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "for") node.htmlFor = String(value);
    else if ((key === "value") && (tag === "textarea" || tag === "input")) {
      node.value = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  if (tag === "select" && attrs.value != null) node.value = String(attrs.value);
  return node;
}

function readRoute() {
  const parts = (location.hash || "#overview").replace(/^#/, "").split("/").filter(Boolean);
  const view = VIEWS.some(([id]) => id === parts[0]) ? parts[0] : "overview";
  return { view, a: parts[1] || null, b: parts[2] || null };
}

function viewTitle(view) {
  return VIEWS.find(([id]) => id === view)?.[1] || "Overview";
}

function currentState() {
  return {
    drawer: drawerOpen,
    openLayers: [...openLayers],
    openSubs: [...openSubs],
    openResearch: [...openResearch],
    filters,
    composeTarget,
  };
}

function restore(state) {
  drawerOpen = Boolean(state.drawer);
  openLayers = new Set(state.openLayers || []);
  openSubs = new Set(state.openSubs || []);
  openResearch = new Set(state.openResearch || []);
  filters = { ...defaultFilters, ...(state.filters || {}) };
  composeTarget = state.composeTarget || null;
}

function resetFromRoute() {
  const route = readRoute();
  drawerOpen = false;
  openLayers = new Set(route.view === "layers" && route.a ? [route.a] : []);
  openSubs = new Set(route.view === "layers" && route.b ? [route.b] : []);
  openResearch = new Set(route.view === "timeline" && route.a ? [route.a] : []);
  composeTarget = null;
}

function render() {
  const y = window.scrollY;
  const active = document.activeElement;
  const previous = active && active.id
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
    : null;
  const route = readRoute();
  document.getElementById("app").replaceChildren(buildPage(route));
  document.body.classList.toggle("drawer-open", drawerOpen);
  const header = document.querySelector(".site-header");
  if (header) document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
  document.title = `${viewTitle(route.view)} · House view`;
  if (scrollTopNext) {
    window.scrollTo(0, 0);
    scrollTopNext = false;
  } else {
    window.scrollTo(0, y);
  }
  const intended = focusAfterRender;
  focusAfterRender = null;
  if (intended) {
    document.getElementById(intended)?.focus();
    return;
  }
  if (!previous) return;
  const el = document.getElementById(previous.id);
  if (!el) return;
  el.focus();
  if (typeof previous.start === "number" && el.setSelectionRange) {
    try {
      el.setSelectionRange(previous.start, previous.end);
    } catch {
      /* some inputs reject a selection range */
    }
  }
}

function showView(view) {
  scrollTopNext = true;
  drawerOpen = false;
  focusAfterRender = `tab-${view}`;
  history.pushState(currentState(), "", `#${view}`);
  render();
}

function openDrawer(target, openerId) {
  composeTarget = target;
  lastOpener = openerId || null;
  formError = "";
  const already = drawerOpen;
  drawerOpen = true;
  focusAfterRender = "note-body";
  const hash = location.hash || "#overview";
  if (already) history.replaceState(currentState(), "", hash);
  else history.pushState(currentState(), "", hash);
  render();
}

function addNoteButton(target, openerId) {
  return h("button", {
    type: "button",
    class: "text-btn",
    id: openerId,
    text: "Add a note",
    onClick: () => openDrawer(target, openerId),
  });
}

function researchById(id) {
  return researchNotes.find((note) => note.id === id) || null;
}

function goToResearch(id) {
  openResearch = new Set([id]);
  drawerOpen = false;
  scrollTopNext = true;
  history.pushState(currentState(), "", `#timeline/${id}`);
  render();
}

function buildPage(route) {
  const page = h("div", {}, [
    buildHeader(route),
    buildBanner(),
    buildMain(route),
    buildFooter(),
  ]);
  if (drawerOpen) page.append(buildScrim(), buildDrawer());
  return page;
}

function buildHeader(route) {
  const count = notesState.ok ? notesState.notes.length : 0;
  return h("header", { class: "site-header" }, [
    h("a", { class: "skip", href: "#content", text: "Skip to content" }),
    h("div", { class: "wrap" }, [
      h("p", { class: "kicker", text: "Design preview" }),
      h("h1", { text: preview.title }),
      h("p", {
        class: "dek",
        text: "Macro research on a long AI build-out. Returns depend on who keeps the profit.",
      }),
      h("div", { class: "toolbar" }, [
        h("div", { class: "tabs", role: "tablist", "aria-label": "Sections", onKeydown: onTabKey },
          VIEWS.map(([id, label]) => h("button", {
            type: "button",
            class: "tab",
            id: `tab-${id}`,
            role: "tab",
            "aria-selected": route.view === id ? "true" : "false",
            "aria-controls": "content",
            tabindex: route.view === id ? "0" : "-1",
            text: label,
            onClick: () => showView(id),
          }))),
        h("div", { class: "actions" }, [
          h("button", {
            type: "button",
            class: "text-btn",
            id: "add-general",
            text: "Add a note",
            onClick: () => openDrawer({ id: "general", title: "General note" }, "add-general"),
          }),
          h("button", {
            type: "button",
            class: "ghost-btn",
            id: "open-notes",
            text: count ? `Notes (${count})` : "Notes",
            "aria-label": count
              ? `Notes, ${count} saved on this browser`
              : "Notes, saved on this browser only",
            onClick: () => openDrawer({ id: "general", title: "General note" }, "open-notes"),
          }),
        ]),
      ]),
    ]),
  ]);
}

function onTabKey(event) {
  const names = VIEWS.map(([id]) => id);
  const current = readRoute().view;
  const index = Math.max(0, names.indexOf(current));
  let next = null;
  if (event.key === "ArrowRight") next = names[(index + 1) % names.length];
  else if (event.key === "ArrowLeft") next = names[(index - 1 + names.length) % names.length];
  else if (event.key === "Home") next = names[0];
  else if (event.key === "End") next = names[names.length - 1];
  if (!next) return;
  event.preventDefault();
  showView(next);
}

function buildBanner() {
  return h("div", { class: "banner" }, [
    h("div", { class: "wrap" }, [
      h("p", { text: preview.coverage }),
    ]),
  ]);
}

function buildMain(route) {
  const main = h("main", { class: "wrap", id: "content", tabindex: "-1" }, [
    statusMessage ? h("p", { class: "status", role: "status", text: statusMessage }) : null,
  ]);
  if (route.view === "overview") main.append(buildOverview());
  else if (route.view === "layers") main.append(buildLayers());
  else if (route.view === "timeline") main.append(buildTimeline());
  else main.append(buildRules());
  if (drawerOpen) main.setAttribute("aria-hidden", "true");
  return main;
}

function buildFooter() {
  return h("footer", { class: "wrap footer" }, [
    h("p", { text: "Design preview for review. Not published. The paper-experiment gallery is a separate site and is unchanged." }),
    h("p", { text: "Notes you type here stay in this browser. Saving is not a review, and it is not a message to anyone." }),
  ]);
}

function buildOverview() {
  const root = h("div", {});
  root.append(h("p", { class: "meta" }, [
    "Latest observation in this preview: ",
    h("time", { datetime: preview.latestObservation, text: formatDate(preview.latestObservation) }),
    ". Send times were not supplied, so there is no clock time.",
  ]));
  root.append(h("section", { class: "section-block" }, [
    h("h2", { text: "House thesis" }),
    h("div", { class: "prose" }, preview.thesis.paragraphs.map((paragraph) => h("p", { text: paragraph }))),
    addNoteButton(
      { id: preview.thesis.id, title: preview.thesis.title },
      "add-overview.thesis",
    ),
  ]));
  root.append(buildPressure());
  root.append(buildPulse());
  root.append(h("section", { class: "counter" }, [
    h("p", { class: "section-kicker", text: "Strongest counter-view" }),
    h("h2", { text: "Usage is not a profit pool" }),
    h("p", { text: preview.counter.text }),
    addNoteButton(
      { id: preview.counter.id, title: preview.counter.title },
      "add-overview.counter",
    ),
  ]));
  return root;
}

function buildPressure() {
  return h("section", { class: "section-block" }, [
    h("h2", { text: "Ideas under pressure" }),
    h("p", { class: "legend", text: "Dated readings that are easy to over-claim. Not permanent truths, and not instructions." }),
    ...preview.pressure.map((item) => {
      const note = researchById(item.researchId);
      return h("article", { class: "item" }, [
        h("div", { class: "item-head" }, [
          h("span", { class: `chip ${item.verdict}`, text: VERDICTS[item.verdict] }),
          h("span", { class: "meta", text: note ? formatDate(note.date) : "" }),
        ]),
        h("h3", { class: "item-title", text: item.title }),
        h("p", { text: item.text }),
        h("div", { class: "row-actions" }, [
          h("button", {
            type: "button",
            class: "text-btn",
            text: "Read the note",
            onClick: () => goToResearch(item.researchId),
          }),
          addNoteButton({ id: item.id, title: item.title }, `add-${item.id}`),
        ]),
      ]);
    }),
    addNoteButton({ id: "overview.pressure", title: "Ideas under pressure" }, "add-overview.pressure"),
  ]);
}

function buildPulse() {
  const groups = ["strengthens", "weakens", "watch"];
  return h("section", { class: "section-block" }, [
    h("h2", { text: "Sublayer pulse" }),
    h("p", { class: "legend", text: "A short reading of this sample. The word on the chip is the claim. Colour is only a spare cue." }),
    ...groups.map((group) => h("div", {}, [
      h("p", { class: "section-kicker", text: VERDICTS[group] }),
      ...preview.pulse.filter((item) => item.group === group).map((item) => {
        const note = researchById(item.researchId);
        return h("article", { class: "item" }, [
          h("div", { class: "item-head" }, [
            h("span", { class: `chip ${group}`, text: VERDICTS[group] }),
            h("span", { text: layerLabel(item.layer) }),
            h("span", { class: "meta", text: note ? formatDate(note.date) : "" }),
          ]),
          h("p", { text: item.text }),
          h("div", { class: "row-actions" }, [
            h("button", {
              type: "button",
              class: "text-btn",
              text: "Read the note",
              onClick: () => goToResearch(item.researchId),
            }),
            addNoteButton({
              id: item.id,
              title: preview.pressure.find((row) => row.id === item.id)?.title
                || `${layerLabel(item.layer)}: ${VERDICTS[group]}`,
            }, `add-${item.id}`),
          ]),
        ]);
      }),
    ])),
  ]);
}

function buildLayers() {
  return h("div", {}, [
    h("h2", { text: "Five layers" }),
    h("p", {
      class: "legend",
      text: "Numbered from the physical base upward. Place on the map is not importance, not a weight, and not a recommendation. Empty boxes stay empty.",
    }),
    h("ol", { class: "map" }, layers.map((layer) => {
      const open = openLayers.has(layer.id);
      return h("li", { class: "layer" }, [
        h("button", {
          type: "button",
          class: "layer-btn",
          id: `layer-${layer.id}`,
          "aria-expanded": open ? "true" : "false",
          "aria-controls": `panel-layer-${layer.id}`,
          onClick: () => toggleLayer(layer.id),
        }, [
          h("span", { class: "layer-id", text: `L${layer.id}` }),
          h("span", { class: "layer-name", text: layer.name }),
          h("span", { class: "layer-line", text: layer.line }),
        ]),
        open ? buildLayerPanel(layer) : null,
      ]);
    })),
  ]);
}

function toggleLayer(id) {
  if (openLayers.has(id)) openLayers.delete(id);
  else openLayers.add(id);
  const hash = openLayers.has(id) ? `#layers/${id}` : "#layers";
  history.pushState(currentState(), "", hash);
  render();
}

function buildLayerPanel(layer) {
  const panel = h("div", { class: "panel", id: `panel-layer-${layer.id}` }, [
    addNoteButton({ id: `layer.${layer.id}`, title: `L${layer.id} ${layer.name}` }, `add-layer.${layer.id}`),
  ]);
  if (!layer.subs.length) {
    panel.append(
      h("p", { text: layer.empty }),
      layer.id === "4" ? openScoutButton("scout-2026-11-22-openrouter") : null,
      layer.id === "5" ? openScoutButton("scout-2026-11-21-recursion") : null,
    );
    return panel;
  }
  panel.append(h("ul", { class: "map" }, layer.subs.map((sub) => {
    const open = openSubs.has(sub.id);
    return h("li", { class: "sub" }, [
      h("button", {
        type: "button",
        class: "sub-btn",
        id: `sub-${sub.id}`,
        "aria-expanded": open ? "true" : "false",
        "aria-controls": `panel-sub-${sub.id}`,
        onClick: () => toggleSub(layer.id, sub.id),
      }, [
        h("span", { class: "sub-id", text: sub.id }),
        h("span", { class: "sub-name", text: sub.name }),
      ]),
      open ? buildSubPanel(sub) : null,
    ]);
  })));
  return panel;
}

function openScoutButton(id) {
  return h("button", {
    type: "button",
    class: "text-btn",
    text: "Open the scout",
    onClick: () => goToResearch(id),
  });
}

function toggleSub(layerId, subId) {
  openLayers.add(layerId);
  if (openSubs.has(subId)) openSubs.delete(subId);
  else openSubs.add(subId);
  const hash = openSubs.has(subId) ? `#layers/${layerId}/${subId}` : `#layers/${layerId}`;
  history.pushState(currentState(), "", hash);
  render();
}

function buildSubPanel(sub) {
  const exampleLine = sub.examples.length
    ? `Examples: ${sub.examples.join(", ")}.`
    : "Examples: none in this preview.";
  return h("div", { class: "panel", id: `panel-sub-${sub.id}` }, [
    h("p", { class: "examples", text: "Examples of the mechanism. Not holdings, and not a recommendation." }),
    h("p", { class: "examples", text: exampleLine }),
    sub.crossExamples?.length
      ? h("p", {
        class: "overlap",
        text: `Cross-tag, not a second count: ${sub.crossExamples.map((item) => `${item.name} (primary ${item.primary})`).join(", ")}.`,
      })
      : null,
    h("dl", {}, [
      h("dt", { text: "Bottleneck" }),
      h("dd", { text: sub.bottleneck }),
      h("dt", { text: "Pricing power" }),
      h("dd", { text: sub.pricing }),
      h("dt", { text: "What would validate" }),
      h("dd", { text: sub.validates }),
      h("dt", { text: "What would invalidate" }),
      h("dd", { text: sub.invalidates }),
    ]),
    sub.nested?.length
      ? h("ul", { class: "nested" }, sub.nested.map((item) => h("li", {}, [
        h("strong", { text: item.name }),
        h("p", { text: item.text }),
      ])))
      : null,
    sub.overlap ? h("p", { class: "overlap", text: sub.overlap }) : null,
    addNoteButton({ id: `layer.${sub.id}`, title: `${sub.id} ${sub.name}` }, `add-layer.${sub.id}`),
  ]);
}

function buildTimeline() {
  const shown = sortResearch(filterResearch(researchNotes, filters));
  const root = h("div", {}, [
    h("h2", { text: "Sample notes" }),
    h("p", {
      class: "legend",
      text: "Preview sample: seven scouts dated 21–24 Nov 2026. No briefs and no alerts. Send times were not supplied. This is not the message archive.",
    }),
    h("p", {
      class: "legend",
      text: "Strengthens, weakens, and watch describe the idea. They are not buy or sell calls.",
    }),
    buildFilters(),
    h("p", { class: "meta", text: `Showing ${shown.length} of ${researchNotes.length} sample notes.` }),
  ]);
  if (!shown.length) {
    const empty = filters.type === "brief"
      ? "No briefs in this preview."
      : filters.type === "alert"
        ? "No alerts in this preview."
        : "Nothing in this sample matches.";
    root.append(h("p", { class: "empty", text: empty }));
    return root;
  }
  root.append(h("div", { class: "cards" }, shown.map(buildCard)));
  return root;
}

function buildFilters() {
  const layerOptions = [["all", "All layers"]];
  for (const layer of layers) {
    layerOptions.push([layer.id, `L${layer.id} ${layer.name}`]);
    for (const sub of layer.subs) layerOptions.push([sub.id, `${sub.id} ${sub.name}`]);
  }
  return h("div", { class: "filters" }, [
    h("label", { class: "field wide" }, [
      "Search",
      h("input", {
        id: "filter-search",
        type: "search",
        value: filters.text,
        placeholder: "Words from a note",
        onInput: (event) => setFilter({ text: event.target.value }, false),
      }),
    ]),
    selectField("From", "filter-from", filters.from, null, { type: "date" }),
    selectField("To", "filter-to", filters.to, null, { type: "date" }),
    selectField("Type", "filter-type", filters.type, [
      ["all", "All types"],
      ["brief", "Brief"],
      ["scout", "Scout"],
      ["alert", "Alert"],
    ]),
    selectField("Layer", "filter-layer", filters.layer, layerOptions),
    selectField("Verdict", "filter-verdict", filters.verdict, [
      ["all", "All verdicts"],
      ["strengthens", "Strengthens"],
      ["weakens", "Weakens"],
      ["watch", "Watch"],
    ]),
    filtersActive()
      ? h("button", {
        type: "button",
        class: "text-btn",
        text: "Clear filters",
        onClick: () => {
          filters = { ...defaultFilters };
          history.pushState(currentState(), "", "#timeline");
          render();
        },
      })
      : null,
  ]);
}

function filtersActive() {
  return Boolean(filters.text || filters.from || filters.to || filters.type !== "all" || filters.layer !== "all" || filters.verdict !== "all");
}

function selectField(label, id, value, options, extra = {}) {
  if (extra.type === "date") {
    return h("label", { class: "field" }, [
      label,
      h("input", {
        id,
        type: "date",
        value,
        onInput: (event) => setFilter({ [id === "filter-from" ? "from" : "to"]: event.target.value }, true),
      }),
    ]);
  }
  return h("label", { class: "field" }, [
    label,
    h("select", {
      id,
      value,
      onChange: (event) => {
        const key = id === "filter-type" ? "type" : id === "filter-layer" ? "layer" : "verdict";
        setFilter({ [key]: event.target.value }, true);
      },
    }, options.map(([optionValue, optionLabel]) => h("option", {
      value: optionValue,
      text: optionLabel,
      selected: optionValue === value ? "selected" : null,
    }))),
  ]);
}

function setFilter(partial, push) {
  filters = { ...filters, ...partial };
  const hash = location.hash.startsWith("#timeline") ? location.hash : "#timeline";
  if (push) history.pushState(currentState(), "", hash);
  else history.replaceState(currentState(), "", hash);
  render();
}

function buildCard(note) {
  const open = openResearch.has(note.id);
  return h("article", { class: "card", id: `card-${note.id}` }, [
    h("div", { class: "card-top" }, [
      h("time", { datetime: note.date, text: formatDate(note.date) }),
      h("span", { class: `chip ${note.type}`, text: TYPES[note.type] }),
      h("span", { class: `chip ${note.verdict}`, text: VERDICTS[note.verdict] }),
      h("span", { text: layerLabel(note.primaryLayer) }),
    ]),
    h("h3", { text: note.title }),
    h("p", { text: note.summary }),
    h("div", { class: "row-actions" }, [
      h("button", {
        type: "button",
        class: "text-btn",
        id: `expand-${note.id}`,
        "aria-expanded": open ? "true" : "false",
        "aria-controls": `detail-${note.id}`,
        text: open ? "Hide fact and counter-view" : "Fact, inference, counter-view",
        onClick: () => toggleResearch(note.id),
      }),
      addNoteButton({ id: `research.${note.id}`, title: note.title }, `add-research.${note.id}`),
    ]),
    open ? buildDetail(note) : null,
  ]);
}

function toggleResearch(id) {
  if (openResearch.has(id)) openResearch.delete(id);
  else openResearch.add(id);
  const hash = openResearch.has(id) ? `#timeline/${id}` : "#timeline";
  history.pushState(currentState(), "", hash);
  render();
}

function buildDetail(note) {
  return h("div", { id: `detail-${note.id}` }, [
    h("dl", {}, [
      h("dt", { text: "Reported" }),
      h("dd", { text: note.fact }),
      h("dt", { text: "Inference" }),
      h("dd", { text: note.inference }),
      h("dt", { text: "Strongest counter-view" }),
      h("dd", { text: note.counter }),
      h("dt", { text: "Not established" }),
      h("dd", { text: note.unknown }),
      h("dt", { text: "Sources" }),
      h("dd", {}, [
        h("ul", { class: "sources" }, note.sources.map((source) => h("li", {}, [
          h("a", {
            href: source.url,
            rel: "noopener noreferrer",
            target: "_blank",
            text: source.name,
          }),
          h("p", { class: "source-note", text: SOURCE_CHECK[source.check] || "" }),
        ]))),
      ]),
    ]),
  ]);
}

function buildRules() {
  return h("div", {}, [
    h("h2", { text: "House rules" }),
    h("p", { class: "legend", text: "Short rules for reading the map. They are not a trading checklist." }),
    h("div", { class: "rules" }, ruleGroups.map((group) => h("section", { class: "rule" }, [
      h("h3", { text: group.title }),
      h("ul", {}, group.items.map((item) => h("li", { text: item }))),
      addNoteButton({ id: group.id, title: group.title }, `add-${group.id}`),
    ]))),
  ]);
}

function buildScrim() {
  return h("button", {
    type: "button",
    class: "scrim",
    "aria-label": "Close notes",
    onClick: () => history.back(),
  });
}

function buildDrawer() {
  const target = composeTarget || { id: "general", title: "General note" };
  const groups = notesState.ok ? groupNotes(notesState.notes) : [];
  return h("aside", {
    class: "drawer",
    id: "drawer",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "notes-title",
  }, [
    h("div", { class: "drawer-top" }, [
      h("div", { class: "row-actions" }, [
        h("h2", { id: "notes-title", text: "Notes" }),
        h("button", {
          type: "button",
          class: "text-btn",
          id: "close-notes",
          text: "Close",
          onClick: () => history.back(),
        }),
      ]),
      h("p", { class: "notice" }, [
        LOCAL_NOTICE,
        h("span", { text: "Saved means stored here. It does not mean reviewed, and it does not mean a message was received." }),
      ]),
      h("form", { class: "composer", onSubmit: saveNote }, [
        h("p", { class: "about" }, [
          "About ",
          h("strong", { text: target.title }),
          h("span", { class: "target-id", text: `Linked section: ${target.id}` }),
        ]),
        h("label", { class: "field" }, [
          "Note",
          h("textarea", {
            id: "note-body",
            maxlength: "2000",
            autocomplete: "off",
            value: draft,
            onInput: (event) => {
              draft = event.target.value;
              const count = document.getElementById("note-count");
              if (count) count.textContent = `${draft.length} / 2000`;
            },
          }),
        ]),
        h("p", { class: "count", id: "note-count", text: `${draft.length} / 2000` }),
        formError ? h("p", { class: "error", role: "alert", text: formError }) : null,
        !notesState.ok ? h("p", { class: "error", role: "alert", text: NOTE_ERRORS.corrupt }) : null,
        h("div", { class: "composer-actions" }, [
          h("button", { type: "submit", class: "primary-btn", id: "note-save", text: "Save on this browser" }),
          h("button", {
            type: "button",
            class: "ghost-btn",
            text: "Clear draft",
            onClick: () => {
              draft = "";
              formError = "";
              focusAfterRender = "note-body";
              render();
            },
          }),
        ]),
      ]),
    ]),
    h("div", { class: "inbox", id: "inbox" }, [
      groups.length ? null : h("p", { class: "empty", text: "No notes in this browser yet." }),
      ...groups.map((group) => h("section", { class: "group" }, [
        h("h3", { text: group.targetTitle }),
        h("p", { class: "target-id", text: group.targetId }),
        ...group.notes.map((note) => h("article", { class: "note" }, [
          h("div", { class: "item-head" }, [
            h("span", { class: "chip saved", text: "Saved", title: "Stored in this browser. Not a review and not a delivery receipt." }),
            h("span", { class: "meta", text: formatSavedAt(note.createdAt) }),
          ]),
          h("p", { text: note.body }),
        ])),
      ])),
      notesState.notes.length
        ? h("button", {
          type: "button",
          class: "text-btn",
          id: "clear-notes",
          text: "Remove notes from this browser",
          onClick: clearNotes,
        })
        : null,
    ]),
  ]);
}

async function saveNote(event) {
  event.preventDefault();
  const target = composeTarget || { id: "general", title: "General note" };
  const result = await notesAdapter.add({
    body: draft,
    targetId: target.id,
    targetTitle: target.title,
  });
  if (!result.ok) {
    formError = NOTE_ERRORS[result.error] || NOTE_ERRORS.storage;
    focusAfterRender = "note-body";
    render();
    return;
  }
  draft = "";
  formError = "";
  statusMessage = "Saved on this browser only — not sent to your advisor. Status: saved. Not reviewed.";
  notesState = await notesAdapter.list();
  focusAfterRender = "note-body";
  render();
}

async function clearNotes() {
  if (!window.confirm("Remove notes from this browser? They were never sent to your advisor.")) return;
  await notesAdapter.clear();
  statusMessage = "Removed from this browser. Nothing had been sent.";
  notesState = await notesAdapter.list();
  render();
}

function onKey(event) {
  if (event.key === "Escape") {
    if (drawerOpen) {
      event.preventDefault();
      history.back();
      return;
    }
    const route = readRoute();
    if (route.view === "timeline" && openResearch.size) {
      openResearch = new Set();
      history.pushState(currentState(), "", "#timeline");
      render();
    } else if (route.view === "layers" && (openLayers.size || openSubs.size)) {
      openLayers = new Set();
      openSubs = new Set();
      history.pushState(currentState(), "", "#layers");
      render();
    }
    return;
  }
  if (!drawerOpen || event.key !== "Tab") return;
  const root = document.getElementById("drawer");
  if (!root) return;
  const focusable = [...root.querySelectorAll("button, textarea, input, select, a")].filter((el) => !el.disabled);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function boot() {
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("popstate", (event) => {
    const previous = readRoute().view;
    const wasOpen = drawerOpen;
    if (event.state) restore(event.state);
    else resetFromRoute();
    if (readRoute().view !== previous) scrollTopNext = true;
    if (wasOpen && !drawerOpen) focusAfterRender = lastOpener;
    else if (!wasOpen && drawerOpen) focusAfterRender = "note-body";
    render();
  });
  if (!history.state) {
    resetFromRoute();
    const hash = location.hash || "#overview";
    history.replaceState(currentState(), "", hash);
  } else {
    restore(history.state);
  }
  try {
    notesState = await notesAdapter.list();
  } catch {
    notesState = { ok: false, notes: [], error: "corrupt" };
  }
  render();
}

boot();
