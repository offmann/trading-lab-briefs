import {
  TYPES,
  TYPE_FILTERS,
  VERDICTS,
  loadArchive,
} from "./data.js";
import {
  filterMessages,
  groupMessagesByDay,
} from "./filter.js";
import {
  extractDomain,
  formatCoverageRange,
  formatDate,
  formatDayHeading,
  formatSavedAt,
  formatSentTime,
  formatShortDate,
  formatWeekdayShort,
  parseBulletText,
} from "./format.js";
import { icon } from "./icons.js";
import {
  LOCAL_NOTICE,
  NOTE_ERRORS,
  createLocalNotesAdapter,
  groupNotes,
} from "./notes.js";

const VIEWS = [
  ["overview", "Overview"],
  ["feed", "Feed"],
  ["rules", "Rules"],
];

const notesAdapter = createLocalNotesAdapter(window.localStorage);

const defaultFilters = {
  text: "",
  type: "all",
  layer: "all",
  verdict: "all",
};

let model = null;

function coverageLabel(options = {}) {
  return formatCoverageRange(model?.meta?.coverage?.from, model?.meta?.coverage?.to, options);
}

function sentItemCount() {
  return model?.messages?.length || 0;
}

let loadError = "";
let currentView = "overview";
let selectedTileId = null;
let thesisExpanded = false;
let activeScoreboardIds = new Set();
let filters = { ...defaultFilters };
let mobileFiltersOpen = false;
let activeMessageId = null;
let drawerOpen = false;
let composeTarget = null;
let lastOpener = null;
let draft = "";
let formError = "";
let statusMessage = "";
let notesState = { ok: true, notes: [] };
let focusAfterRender = null;
let scrollTopNext = false;
let pendingAnchorId = null;

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "for") node.htmlFor = String(value);
    else if (key === "value" && (tag === "textarea" || tag === "input")) {
      node.value = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  const flat = Array.isArray(children) ? children : [children];
  for (const child of flat) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function parseHash(rawHash = location.hash) {
  const parts = (rawHash || "#overview").replace(/^#/, "").split("/").filter(Boolean);
  const first = parts[0] || "overview";

  if (first === "overview") {
    if (parts[1] === "tile" && parts[2]) {
      return { view: "overview", tileId: parts[2], messageId: parts[3] || null };
    }
    return { view: "overview", tileId: null, messageId: null };
  }
  if (first === "layers") {
    const candidate = parts[2] || parts[1] || null;
    return { view: "overview", tileId: candidate, messageId: null };
  }
  if (first === "feed" || first === "timeline") {
    return { view: "feed", tileId: null, messageId: parts[1] || null };
  }
  if (first === "message" && parts[1]) {
    return { view: currentView || "feed", tileId: selectedTileId, messageId: parts[1] };
  }
  if (first === "rules") {
    return { view: "rules", tileId: null, messageId: null };
  }
  return { view: "overview", tileId: null, messageId: null };
}

function buildHash() {
  if (currentView === "overview") {
    if (selectedTileId && activeMessageId) return `#overview/tile/${selectedTileId}/${activeMessageId}`;
    if (selectedTileId) return `#overview/tile/${selectedTileId}`;
    if (activeMessageId) return `#message/${activeMessageId}`;
    return "#overview";
  }
  if (currentView === "feed") {
    if (activeMessageId) return `#feed/${activeMessageId}`;
    return "#feed";
  }
  if (activeMessageId) return `#message/${activeMessageId}`;
  return "#rules";
}

function snapshotState() {
  return {
    view: currentView,
    selectedTileId,
    thesisExpanded,
    activeScoreboardIds: [...activeScoreboardIds],
    filters: { ...filters },
    mobileFiltersOpen,
    activeMessageId,
    drawerOpen,
    composeTarget,
  };
}

function applyState(state) {
  currentView = state.view || "overview";
  selectedTileId = state.selectedTileId || null;
  thesisExpanded = Boolean(state.thesisExpanded);
  activeScoreboardIds = new Set(state.activeScoreboardIds || []);
  filters = { ...defaultFilters, ...(state.filters || {}) };
  mobileFiltersOpen = Boolean(state.mobileFiltersOpen);
  activeMessageId = state.activeMessageId || null;
  drawerOpen = Boolean(state.drawerOpen);
  composeTarget = state.composeTarget || null;
}

function syncFromLocation() {
  const parsed = parseHash(location.hash);
  currentView = parsed.view;
  if (parsed.tileId && model?.findTile(parsed.tileId)) {
    selectedTileId = parsed.tileId;
  } else if (parsed.view === "overview" && !parsed.tileId) {
    selectedTileId = null;
  }
  activeMessageId = parsed.messageId && model?.findMessage(parsed.messageId) ? parsed.messageId : null;
  drawerOpen = false;
}

function pushHistory(replace = false) {
  const hash = buildHash();
  if (replace) history.replaceState(snapshotState(), "", hash);
  else history.pushState(snapshotState(), "", hash);
}

function viewTitle(view) {
  return VIEWS.find(([id]) => id === view)?.[1] || "Overview";
}

function render() {
  const savedY = window.scrollY;
  const active = document.activeElement;
  const previousFocus = active && active.id
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
    : null;

  const root = document.getElementById("app");
  root.replaceChildren(buildApp());

  document.body.classList.toggle("overlay-open", Boolean(drawerOpen || activeMessageId));
  const header = document.querySelector(".site-header");
  if (header) {
    document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
  }

  if (activeMessageId && model?.findMessage(activeMessageId)) {
    document.title = `${model.findMessage(activeMessageId).title} · House View`;
  } else {
    document.title = `${viewTitle(currentView)} · House View`;
  }

  if (pendingAnchorId) {
    const targetEl = document.getElementById(pendingAnchorId);
    pendingAnchorId = null;
    if (targetEl) targetEl.scrollIntoView({ block: "start" });
  } else if (scrollTopNext) {
    window.scrollTo(0, 0);
    scrollTopNext = false;
  } else {
    window.scrollTo(0, savedY);
  }

  const nextFocus = focusAfterRender;
  focusAfterRender = null;
  if (nextFocus) {
    document.getElementById(nextFocus)?.focus();
    return;
  }
  if (!previousFocus) return;
  const restored = document.getElementById(previousFocus.id);
  if (!restored) return;
  restored.focus();
  if (typeof previousFocus.start === "number" && restored.setSelectionRange) {
    try {
      restored.setSelectionRange(previousFocus.start, previousFocus.end);
    } catch {
      /* ignore inputs without selection ranges */
    }
  }
}

function showView(nextView) {
  currentView = nextView;
  activeMessageId = null;
  drawerOpen = false;
  scrollTopNext = true;
  focusAfterRender = `tab-${nextView}`;
  pushHistory(false);
  render();
}

function selectTile(tileId) {
  if (selectedTileId === tileId) {
    selectedTileId = null;
  } else {
    selectedTileId = tileId;
  }
  if (currentView !== "overview") {
    currentView = "overview";
    scrollTopNext = true;
  }
  activeMessageId = null;
  focusAfterRender = selectedTileId ? "close-tile-inspector" : (tileId ? `tile-${tileId}` : null);
  pushHistory(false);
  render();
}

function jumpToTileFromReader(tileId) {
  const validTile = model.findTile(tileId) ? tileId : null;
  activeMessageId = null;
  currentView = "overview";
  selectedTileId = validTile;
  pendingAnchorId = "layer-cake";
  pushHistory(false);
  render();
}

function filterFeedByLayer(layerId) {
  filters = { ...defaultFilters, layer: layerId };
  mobileFiltersOpen = false;
  activeMessageId = null;
  currentView = "feed";
  scrollTopNext = true;
  pushHistory(false);
  render();
}

function jumpToFeedDay(dateIso) {
  filters = { ...defaultFilters };
  activeMessageId = null;
  currentView = "feed";
  pendingAnchorId = `day-${dateIso}`;
  pushHistory(false);
  render();
}

function openMessageDetail(messageId, openerId = null) {
  if (!model?.findMessage(messageId)) return;
  lastOpener = openerId || `card-${messageId}`;
  activeMessageId = messageId;
  drawerOpen = false;
  focusAfterRender = "close-reader";
  pushHistory(false);
  render();
  const modal = document.getElementById("reader-modal");
  if (modal) modal.scrollTop = 0;
}

function closeMessageDetail() {
  if (!activeMessageId) return;
  activeMessageId = null;
  focusAfterRender = lastOpener;
  pushHistory(false);
  render();
}

function openNotesDrawer(target, openerId) {
  composeTarget = target || { id: "general", title: "General note" };
  lastOpener = openerId || null;
  formError = "";
  const already = drawerOpen;
  drawerOpen = true;
  focusAfterRender = "note-body";
  pushHistory(already);
  render();
}

function closeNotesDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
  focusAfterRender = lastOpener || "open-notes";
  pushHistory(false);
  render();
}

function quietNoteButton(target, openerId, label = "Note") {
  return h("button", {
    type: "button",
    class: "quiet-note-btn",
    id: openerId,
    title: "Save a private note on this browser only",
    onClick: (event) => {
      event.stopPropagation();
      openNotesDrawer(target, openerId);
    },
  }, [icon("note"), label]);
}

function stanceBadge(verdict) {
  const key = VERDICTS[verdict] ? verdict : "watch";
  return h("span", { class: `badge stance-${key}` }, [
    icon(key),
    VERDICTS[key],
  ]);
}

function typeBadge(type) {
  const label = TYPES[type] || type;
  return h("span", { class: `badge type-${type}` }, [
    icon(type),
    label,
  ]);
}

function renderBulletItem(rawBullet) {
  const parsed = parseBulletText(rawBullet);
  return h("li", {}, [
    parsed.text,
    ...parsed.tags.map((tag) => h("span", {
      class: "ev-tag",
      title: `${tag.label} figure`,
      text: tag.code,
    })),
  ]);
}

function buildApp() {
  if (loadError) {
    return h("div", { class: "boot-shell" }, [
      h("h1", { text: "House View" }),
      h("p", { class: "form-error", text: loadError }),
    ]);
  }
  if (!model) {
    return h("div", { class: "boot-shell" }, [
      h("p", { text: "Loading House View…" }),
    ]);
  }

  const wrapper = h("div", {}, [
    buildHeader(),
    buildMain(),
    buildFooter(),
  ]);

  if (activeMessageId) {
    const msg = model.findMessage(activeMessageId);
    if (msg) {
      wrapper.append(
        h("button", {
          type: "button",
          class: "scrim",
          "aria-label": "Close message reader",
          onClick: closeMessageDetail,
        }),
        buildMessageReader(msg),
      );
    }
  }

  if (drawerOpen) {
    wrapper.append(
      h("button", {
        type: "button",
        class: "scrim scrim-notes",
        "aria-label": "Close notes drawer",
        onClick: closeNotesDrawer,
      }),
      buildNotesDrawer(),
    );
  }

  return wrapper;
}

function buildHeader() {
  const noteCount = notesState.ok ? notesState.notes.length : 0;

  return h("header", { class: "site-header" }, [
    h("a", { class: "skip", href: "#content", text: "Skip to content" }),
    h("div", { class: "container header-inner" }, [
      h("div", { class: "brand-group" }, [
        h("span", { class: "brand-mark" }, [icon("layers")]),
        h("div", { class: "brand-text" }, [
          h("div", { class: "brand-title-row" }, [
            h("h1", { class: "site-title", text: model.meta.title }),
            h("span", { class: "coverage-inline", text: coverageLabel() }),
          ]),
        ]),
      ]),
      h("div", { class: "nav-and-tools" }, [
        h("div", {
          class: "tabs",
          role: "tablist",
          "aria-label": "Sections",
          onKeydown: onTabKeydown,
        }, VIEWS.map(([id, label]) => h("button", {
          type: "button",
          class: "tab",
          id: `tab-${id}`,
          role: "tab",
          "aria-selected": currentView === id ? "true" : "false",
          "aria-controls": "content",
          tabindex: currentView === id ? "0" : "-1",
          onClick: () => showView(id),
        }, [
          label,
          id === "feed"
            ? h("span", { class: "tab-count", text: String(model.messages.length) })
            : null,
        ]))),
        h("button", {
          type: "button",
          class: "notes-trigger",
          id: "open-notes",
          "aria-label": noteCount
            ? `Notes, ${noteCount} saved on this browser only`
            : "Notes, Saved on this browser only",
          onClick: () => openNotesDrawer({ id: "general", title: "General note" }, "open-notes"),
        }, [
          icon("note"),
          "Notes",
          noteCount ? h("span", { class: "notes-badge", text: String(noteCount) }) : null,
        ]),
      ]),
    ]),
  ]);
}

function onTabKeydown(event) {
  const ids = VIEWS.map(([id]) => id);
  const idx = Math.max(0, ids.indexOf(currentView));
  let next = null;
  if (event.key === "ArrowRight") next = ids[(idx + 1) % ids.length];
  else if (event.key === "ArrowLeft") next = ids[(idx - 1 + ids.length) % ids.length];
  else if (event.key === "Home") next = ids[0];
  else if (event.key === "End") next = ids[ids.length - 1];
  if (!next) return;
  event.preventDefault();
  showView(next);
}

function buildMain() {
  const main = h("main", { class: "container", id: "content", tabindex: "-1" }, [
    statusMessage ? h("p", { class: "toast-status", role: "status", text: statusMessage }) : null,
  ]);

  if (currentView === "overview") main.append(buildOverview());
  else if (currentView === "feed") main.append(buildFeed());
  else main.append(buildRules());

  if (drawerOpen || activeMessageId) {
    main.setAttribute("aria-hidden", "true");
  }
  return main;
}

function buildFooter() {
  return h("footer", { class: "container site-footer" }, [
    h("p", {
      text: `Sanitized public house-view desk covering ${coverageLabel()} (Europe/Paris). Tickers are macro mechanism examples — never holdings, weights, or recommendations.`,
    }),
    h("p", {
      text: "Browser notes stay in localStorage on this device only and are never transmitted.",
    }),
  ]);
}

/* ============================
   OVERVIEW VIEW
   ============================ */

function buildOverview() {
  const wrap = h("div", {}, [
    h("div", { class: "overview-top-grid" }, [
      buildThesisCard(),
      buildTimelineStripCard(),
    ]),
    buildLayerCakeSection(),
    buildWhatChangedSection(),
    buildScoreboardSection(),
  ]);
  return wrap;
}

function buildThesisCard() {
  const latestVer = model.houseThesis.versions.at(-1);
  return h("section", { class: "surface-card thesis-card" }, [
    h("div", {}, [
      h("div", { class: "kicker-row" }, [
        h("p", {
          class: "kicker",
          text: `House Thesis · v${latestVer?.version || 4} · Updated ${formatShortDate(model.houseThesis.updatedOn)}`,
        }),
        quietNoteButton({ id: model.houseThesis.id, title: model.houseThesis.title }, "note-thesis"),
      ]),
      h("div", { class: "thesis-lead" }, model.thesisSummaryLines.map((line) => h("p", { text: line }))),
      thesisExpanded
        ? h("div", { class: "thesis-expanded" }, [
          ...model.houseThesis.paragraphs.map((p) => h("p", { text: p })),
          h("div", { class: "thesis-expanded-counter" }, [
            h("strong", { text: "Strongest counter-view: " }),
            model.counterView.text,
          ]),
        ])
        : null,
    ]),
    h("div", { class: "thesis-footer" }, [
      h("button", {
        type: "button",
        class: "link-btn",
        id: "toggle-thesis",
        "aria-expanded": thesisExpanded ? "true" : "false",
        onClick: () => {
          thesisExpanded = !thesisExpanded;
          focusAfterRender = "toggle-thesis";
          pushHistory(true);
          render();
        },
      }, [
        thesisExpanded ? "Collapse full tenets" : "Full 6 tenets & counter-view",
        icon(thesisExpanded ? "chevronUp" : "chevronDown"),
      ]),
      h("span", {
        class: "scope-note",
        text: `Covers ${coverageLabel()} · ${sentItemCount()} sent items`,
      }),
    ]),
  ]);
}

function buildTimelineStripCard() {
  const counts = model.meta.counts || {};
  return h("section", { class: "surface-card timeline-strip-card", "aria-label": "Weekly signal timeline" }, [
    h("div", {}, [
      h("div", { class: "kicker-row" }, [
        h("p", { class: "kicker", text: `${coverageLabel({ short: true })} Pulse · ${sentItemCount()} Items` }),
        h("button", {
          type: "button",
          class: "link-btn",
          onClick: () => showView("feed"),
        }, ["Open feed", icon("arrowRight")]),
      ]),
      h("div", { class: "timeline-bars" }, model.timelineDays.map((day) => {
        const dayNum = day.date.slice(8, 10).replace(/^0/, "");
        const wk = formatWeekdayShort(day.date).slice(0, 2);
        return h("button", {
          type: "button",
          class: "day-col",
          title: `${formatDate(day.date)}: ${day.messages.length} item${day.messages.length === 1 ? "" : "s"} — view in Feed`,
          "aria-label": `${formatDate(day.date)}, ${day.messages.length} items`,
          onClick: () => jumpToFeedDay(day.date),
        }, [
          h("span", { class: "day-pips" }, day.messages.map((msg) => h("span", {
            class: `pip pip-${msg.verdict || "watch"}`,
          }))),
          h("span", { class: "day-num", text: dayNum }),
          h("span", { class: "day-wk", text: wk }),
        ]);
      })),
    ]),
    h("div", { class: "timeline-mix" }, [
      h("span", { text: `${counts.scout || 0} scouts` }),
      h("span", { text: `${counts.brief || 0} briefs` }),
      h("span", { text: `${counts.evening || 0} evening` }),
      h("span", { text: `${counts["thesis-change"] || 0} thesis` }),
      h("span", { text: `${counts.thinkers || 0} thinkers` }),
    ]),
  ]);
}

function buildLayerCakeSection() {
  const selectedTile = selectedTileId ? model.findTile(selectedTileId) : null;

  return h("section", { class: "cake-section", id: "layer-cake" }, [
    h("div", { class: "cake-header" }, [
      h("div", { class: "cake-title-block" }, [
        h("h2", { text: "Five-Layer AI Infrastructure Cake" }),
        h("p", {
          class: "cake-subtitle",
          text: "Stacked from applications down to physical foundation. Click any sublayer tile for bottlenecks & linked messages.",
        }),
      ]),
      h("div", { class: "heat-legend", "aria-label": "Heat and bottleneck legend" }, [
        h("span", { class: "legend-item" }, [h("span", { class: "swatch swatch-tightening" }), "Tightening"]),
        h("span", { class: "legend-item" }, [h("span", { class: "swatch swatch-splitting" }), "Splitting"]),
        h("span", { class: "legend-item" }, [h("span", { class: "swatch swatch-unchanged" }), "Unchanged"]),
        h("span", { class: "legend-item" }, [h("span", { class: "swatch swatch-weakening" }), "Weakening"]),
        h("span", { class: "legend-item legend-bottleneck" }, [icon("bottleneck"), "Bottleneck"]),
      ]),
    ]),
    h("div", {
      class: `cake-workspace${selectedTile ? " has-selection" : ""}`,
    }, [
      h("div", { class: "cake-stack" }, model.cakeTiers.map((tier) => buildCakeTier(tier, selectedTile))),
      selectedTile
        ? buildTileInspector(selectedTile, "tile-inspector-desktop", "close-tile-inspector")
        : null,
    ]),
  ]);
}

function buildCakeTier(tier, selectedTile) {
  const tileCount = tier.tiles.length;
  const tierHasSelected = selectedTile && selectedTile.layerId === tier.id;

  return h("div", { class: "cake-tier", "data-layer": tier.id }, [
    h("div", { class: "tier-spine" }, [
      h("span", { class: "tier-code", text: `L${tier.id}` }),
      h("span", { class: "tier-name", text: tier.name }),
      h("span", { class: "tier-line", text: tier.line }),
    ]),
    h("div", {}, [
      h("div", { class: `tier-tiles tiles-count-${tileCount}` }, tier.tiles.map((tile) => buildSublayerTile(tile, selectedTile))),
      tierHasSelected
        ? buildTileInspector(selectedTile, "tile-inspector-mobile", `close-tile-mobile-${selectedTile.id}`)
        : null,
    ]),
  ]);
}

function buildSublayerTile(tile, selectedTile) {
  const isSelected = selectedTile?.id === tile.id;
  const codeText = /^[1-5]$/.test(tile.id) ? `L${tile.id}` : tile.id;
  const tickerText = tile.examples.length
    ? tile.examples.join(" · ")
    : tile.crossExamples.length
      ? `${tile.crossExamples.map((c) => `${c.name}*`).join(" · ")}`
      : "Empty box";

  return h("button", {
    type: "button",
    class: `sublayer-tile heat-${tile.heat}${isSelected ? " is-selected" : ""}`,
    id: `tile-${tile.id}`,
    "aria-expanded": isSelected ? "true" : "false",
    onClick: () => selectTile(tile.id),
  }, [
    h("div", {}, [
      h("div", { class: "tile-top" }, [
        h("span", { class: "tile-id", text: codeText }),
        h("span", { class: "tile-badges" }, [
          h("span", { class: "heat-pill", text: tile.heatMeta.shortLabel }),
          tile.isBottleneck
            ? h("span", {
              class: "bottleneck-pin",
              title: "Active supply or permission bottleneck",
            }, [icon("bottleneck")])
            : null,
        ]),
      ]),
      h("div", { class: "tile-name", text: tile.shortName }),
      h("div", { class: "tile-note-line", text: tile.bottleneckTag }),
    ]),
    h("div", { class: "tile-bottom" }, [
      h("span", {
        class: `tile-tickers${tile.examples.length ? "" : " is-empty"}`,
        text: tickerText,
      }),
      h("span", {
        class: "tile-msg-count",
        text: `${tile.linkedMessages.length} msg${tile.linkedMessages.length === 1 ? "" : "s"}`,
      }),
    ]),
  ]);
}

function buildTileInspector(tile, extraClass, closeBtnId) {
  const codeText = /^[1-5]$/.test(tile.id) ? `Layer ${tile.id}` : tile.id;

  return h("aside", {
    class: `tile-inspector ${extraClass}`,
    "aria-label": `${codeText} ${tile.name} details`,
  }, [
    h("div", { class: "inspector-head" }, [
      h("div", {}, [
        h("p", { class: "kicker", text: `Layer ${tile.layerId} · ${tile.layerName}` }),
        h("h3", { class: "inspector-title", text: `${codeText} · ${tile.name}` }),
      ]),
      h("button", {
        type: "button",
        class: "icon-close-btn",
        id: closeBtnId,
        "aria-label": "Close sublayer details",
        onClick: () => selectTile(null),
      }, [icon("close")]),
    ]),
    h("div", { class: "inspector-badges" }, [
      h("span", { class: `sublayer-heat-tag badge stance-${tile.heat === "tightening" ? "watch" : tile.heat === "weakening" ? "weakens" : "neutral"}` }, [
        `Heat: ${tile.heatMeta.label}`,
      ]),
      tile.isBottleneck
        ? h("span", { class: "bottleneck-badge" }, [icon("bottleneck"), "Active bottleneck"])
        : null,
    ]),
    h("div", { class: "inspector-box" }, [
      h("strong", { text: "Bottleneck & Supply Signal" }),
      h("p", { text: tile.bottleneck }),
    ]),
    tile.pulse
      ? h("div", { class: "inspector-box" }, [
        h("strong", { text: "Latest Pulse Takeaway" }),
        h("p", { text: tile.pulse.text }),
      ])
      : null,
    h("div", { class: "inspector-examples" }, [
      h("span", { class: "kicker", text: "Mechanism Examples (Not Holdings)" }),
      h("div", { class: "ticker-row" }, [
        ...(tile.examples.length
          ? tile.examples.map((ticker) => h("span", { class: "ticker-chip", text: ticker }))
          : [h("span", { class: "ticker-chip is-cross", text: "Empty by design" })]),
        ...tile.crossExamples.map((cross) => h("span", {
          class: "ticker-chip is-cross",
          text: `${cross.name} (cross-tag · primary ${cross.primary})`,
        })),
      ]),
      tile.notes ? h("p", { class: "inspector-notes", text: tile.notes }) : null,
    ]),
    h("div", { class: "inspector-signals" }, [
      h("span", {
        class: "kicker",
        text: `Linked Messages (${tile.linkedMessages.length})`,
      }),
      h("div", { class: "inspector-signals-list" }, tile.linkedMessages.map((msg) => h("button", {
        type: "button",
        class: "mini-signal-btn",
        id: `insp-${extraClass}-${msg.id}`,
        onClick: () => openMessageDetail(msg.id, `insp-${extraClass}-${msg.id}`),
      }, [
        h("span", { class: "mini-signal-top" }, [
          typeBadge(msg.type),
          stanceBadge(msg.verdict),
          h("span", { class: "subtle-meta", text: formatShortDate(msg.date) }),
        ]),
        h("span", { class: "mini-signal-title", text: msg.title }),
      ]))),
    ]),
    h("div", { class: "inspector-footer" }, [
      h("button", {
        type: "button",
        class: "link-btn",
        onClick: () => filterFeedByLayer(tile.id),
      }, [`Filter feed to ${/^[1-5]$/.test(tile.id) ? `L${tile.id}` : tile.id}`, icon("arrowRight")]),
      quietNoteButton(
        { id: `layer.${tile.id}`, title: `${codeText} ${tile.name}` },
        `note-${extraClass}-${tile.id}`,
      ),
    ]),
  ]);
}

function buildWhatChangedSection() {
  return h("section", { class: "overview-section" }, [
    h("div", { class: "section-header" }, [
      h("h2", { text: "What Changed This Week" }),
      h("p", { text: "Four house-view updates across 18–23 Nov 2026 and the strongest live pushback." }),
    ]),
    h("div", { class: "changes-grid" }, model.weeklyChanges.map((change) => h("article", { class: "change-card" }, [
      h("div", {}, [
        h("div", { class: "kicker-row" }, [
          h("span", { class: "layer-tag is-primary", text: `v${change.version} · ${formatShortDate(change.effectiveOn)}` }),
          stanceBadge(change.stance),
        ]),
        h("h3", { text: change.headline }),
        h("p", { text: change.summary }),
      ]),
      h("div", { class: "change-links" }, [
        ...change.linkedMessages.map((msg) => h("button", {
          type: "button",
          class: "link-btn",
          id: `chg-${change.version}-${msg.id}`,
          onClick: () => openMessageDetail(msg.id, `chg-${change.version}-${msg.id}`),
        }, [
          TYPES[msg.type] || msg.type,
          icon("arrowRight"),
        ])),
        quietNoteButton(
          { id: change.id, title: `v${change.version}: ${change.headline}` },
          `note-change-${change.version}`,
        ),
      ]),
    ]))),
    h("div", { class: "counter-banner" }, [
      h("div", { class: "kicker-row" }, [
        h("span", {
          class: "kicker",
          text: `Strongest Counter-View · As of ${formatShortDate(model.counterView.asOf)}`,
        }),
        quietNoteButton({ id: model.counterView.id, title: model.counterView.title }, "note-counter"),
      ]),
      h("h3", { text: "Regulators, high real rates, and thin profit pools" }),
      h("p", { text: model.counterView.text }),
    ]),
  ]);
}

function buildScoreboardSection() {
  return h("section", { class: "overview-section" }, [
    h("div", { class: "section-header" }, [
      h("h2", { text: "Theses Scoreboard" }),
      h("p", { text: "Strengthened, qualified, and open questions. Click any chip to read its evidence." }),
    ]),
    h("div", { class: "scoreboard-lanes" }, model.scoreboard.map((lane) => {
      const openItems = lane.items.filter((item) => activeScoreboardIds.has(item.id));
      return h("div", { class: "score-lane" }, [
        h("div", { class: "score-lane-head" }, [
          stanceBadge(lane.verdict),
          h("span", {
            class: "subtle-meta",
            text: `${lane.label} (${lane.items.length})`,
          }),
        ]),
        h("div", { class: "score-chips-wrap" }, lane.items.map((item) => {
          const isOpen = activeScoreboardIds.has(item.id);
          return h("button", {
            type: "button",
            class: `thesis-chip chip-${lane.verdict}`,
            id: `chip-${item.id}`,
            "aria-expanded": isOpen ? "true" : "false",
            onClick: () => {
              if (activeScoreboardIds.has(item.id)) activeScoreboardIds.delete(item.id);
              else activeScoreboardIds.add(item.id);
              focusAfterRender = `chip-${item.id}`;
              pushHistory(true);
              render();
            },
          }, [
            icon(lane.verdict),
            h("span", { class: "thesis-chip-text", text: item.title }),
            h("span", { class: "thesis-chip-date", text: formatShortDate(item.asOf) }),
          ]);
        })),
        ...openItems.map((item) => h("div", { class: "score-detail-card" }, [
          h("div", { class: "kicker-row" }, [
            h("span", { class: "kicker", text: `${lane.label} · As of ${formatDate(item.asOf)}` }),
            quietNoteButton({ id: item.id, title: item.title }, `note-${item.id}`),
          ]),
          h("h4", { text: item.title }),
          h("p", { text: item.summary }),
        ])),
      ]);
    })),
  ]);
}

/* ============================
   FEED VIEW
   ============================ */

function hasActiveFilters() {
  return Boolean(
    filters.text.trim() ||
    filters.type !== "all" ||
    filters.layer !== "all" ||
    filters.verdict !== "all",
  );
}

function buildFeed() {
  const filtered = filterMessages(model.messages, filters);
  const dayGroups = groupMessagesByDay(filtered);

  const root = h("div", {}, [
    buildFeedToolbar(filtered.length),
  ]);

  if (!dayGroups.length) {
    root.append(h("div", { class: "empty-state" }, [
      h("p", { text: "No messages match the current filters." }),
      h("button", {
        type: "button",
        class: "ghost-btn",
        text: "Reset filters",
        onClick: resetFilters,
      }),
    ]));
    return root;
  }

  for (const group of dayGroups) {
    root.append(h("section", { class: "day-group", id: `day-${group.date}` }, [
      h("div", { class: "day-header" }, [
        h("h2", { text: formatDayHeading(group.date) }),
        h("span", {
          class: "day-count",
          text: `${group.messages.length} item${group.messages.length === 1 ? "" : "s"}`,
        }),
      ]),
      h("div", { class: "day-cards" }, group.messages.map((msg) => buildFeedCard(msg))),
    ]));
  }

  return root;
}

function buildFeedToolbar(shownCount) {
  const activeCount = [
    filters.type !== "all",
    filters.layer !== "all",
    filters.verdict !== "all",
    Boolean(filters.text.trim()),
  ].filter(Boolean).length;

  const layerChips = [
    { id: "all", label: "All layers" },
    { id: "1", label: "L1 Physical" },
    { id: "1a", label: "1a" },
    { id: "1b", label: "1b" },
    { id: "1c", label: "1c" },
    { id: "1d", label: "1d" },
    { id: "2", label: "L2 Chips" },
    { id: "2a", label: "2a" },
    { id: "2b", label: "2b" },
    { id: "2c", label: "2c" },
    { id: "2d", label: "2d" },
    { id: "3", label: "L3 Infra" },
    { id: "3a", label: "3a" },
    { id: "3b", label: "3b" },
    { id: "3c", label: "3c" },
    { id: "4", label: "L4 Models" },
    { id: "5", label: "L5 Apps" },
  ];

  return h("section", { class: "feed-toolbar", "aria-label": "Filter messages" }, [
    h("div", { class: "feed-mobile-bar" }, [
      h("span", {
        class: "feed-mobile-summary",
        text: `${shownCount} of ${model.messages.length} items · ${coverageLabel({ short: true })}`,
      }),
      h("button", {
        type: "button",
        class: "filter-toggle-btn",
        id: "toggle-mobile-filters",
        "aria-expanded": mobileFiltersOpen ? "true" : "false",
        onClick: () => {
          mobileFiltersOpen = !mobileFiltersOpen;
          focusAfterRender = "toggle-mobile-filters";
          render();
        },
      }, [
        icon("filter"),
        activeCount ? `Filter (${activeCount})` : "Filter & search",
      ]),
    ]),
    h("div", {
      class: `feed-filters-body${mobileFiltersOpen ? " is-open" : ""}`,
    }, [
      h("div", { class: "filter-row-top" }, [
        h("div", { class: "chip-group", role: "group", "aria-label": "Filter by type" }, TYPE_FILTERS.map((item) => {
          const total = item.id === "all"
            ? model.messages.length
            : (model.meta.counts?.[item.id] || 0);
          return h("button", {
            type: "button",
            class: `filter-chip${filters.type === item.id ? " is-active" : ""}`,
            "aria-pressed": filters.type === item.id ? "true" : "false",
            onClick: () => updateFilter({ type: item.id }, true),
          }, [
            item.id !== "all" ? icon(item.id) : null,
            item.label,
            h("span", { class: "chip-num", text: String(total) }),
          ]);
        })),
        h("div", { class: "search-box" }, [
          icon("search"),
          h("input", {
            id: "filter-search",
            class: "search-input",
            type: "search",
             "aria-label": "Search messages",
            placeholder: "Search headlines, bullets, tickers…",
            value: filters.text,
            onInput: (event) => updateFilter({ text: event.target.value }, false),
          }),
        ]),
      ]),
      h("div", { class: "chip-group", role: "group", "aria-label": "Filter by layer" }, layerChips.map((chip) => h("button", {
        type: "button",
        class: `filter-chip layer-filter-chip${filters.layer === chip.id ? " is-active" : ""}`,
        "aria-pressed": filters.layer === chip.id ? "true" : "false",
        onClick: () => updateFilter({ layer: chip.id }, true),
        text: chip.label,
      }))),
      h("div", { class: "filter-status-row" }, [
        h("span", {
          text: `Showing ${shownCount} of ${model.messages.length} sent items (${coverageLabel()}, Europe/Paris)`,
        }),
        hasActiveFilters()
          ? h("button", {
            type: "button",
            class: "link-btn",
            text: "Clear filters",
            onClick: resetFilters,
          })
          : null,
      ]),
    ]),
  ]);
}

function updateFilter(partial, push) {
  filters = { ...filters, ...partial };
  pushHistory(!push);
  render();
}

function resetFilters() {
  filters = { ...defaultFilters };
  pushHistory(false);
  render();
}

function buildFeedCard(message) {
  const timeLabel = formatSentTime(message.sentAt);
  const secondaryLayers = (message.layers || []).filter((id) => id !== message.primaryLayer);

  return h("article", {
    class: "feed-card",
    id: `card-${message.id}`,
    onClick: (event) => {
      if (event.target.closest("a, button")) return;
      openMessageDetail(message.id, `open-${message.id}`);
    },
  }, [
    h("div", { class: "card-meta-bar" }, [
      h("div", { class: "card-badges" }, [
        typeBadge(message.type),
        stanceBadge(message.verdict),
        h("span", {
          class: "layer-tag is-primary",
          text: model.layerLabel(message.primaryLayer),
        }),
        ...secondaryLayers.map((id) => h("span", {
          class: "layer-tag",
          text: model.layerCodeLabel(id),
          title: model.layerLabel(id),
        })),
      ]),
      timeLabel ? h("time", { class: "card-time", datetime: message.sentAt, text: timeLabel }) : null,
    ]),
    h("h3", { text: message.title }),
    h("ul", { class: "bullet-list" }, (message.bullets || []).map((b) => renderBulletItem(b))),
    h("div", { class: "card-counter" }, [
      h("strong", { text: "Counter-view: " }),
      message.counterView,
    ]),
    h("div", { class: "card-footer" }, [
      h("div", { class: "source-pills" }, (message.sources || []).map((source) => h("a", {
        class: "source-pill",
        href: source.url,
        target: "_blank",
        rel: "noopener noreferrer",
        onClick: (event) => event.stopPropagation(),
      }, [
        source.name,
        icon("external"),
      ]))),
      h("div", { class: "card-actions" }, [
        quietNoteButton(
          { id: `msg.${message.id}`, title: message.title },
          `note-msg-${message.id}`,
        ),
        h("button", {
          type: "button",
          class: "link-btn",
          id: `open-${message.id}`,
          onClick: (event) => {
            event.stopPropagation();
            openMessageDetail(message.id, `open-${message.id}`);
          },
        }, ["Full message", icon("arrowRight")]),
      ]),
    ]),
  ]);
}

/* ============================
   MESSAGE DETAIL READER
   ============================ */

function buildMessageReader(message) {
  const timeLabel = formatSentTime(message.sentAt);
  const idx = model.sortedMessages.findIndex((m) => m.id === message.id);
  const newerMsg = idx > 0 ? model.sortedMessages[idx - 1] : null;
  const olderMsg = idx >= 0 && idx < model.sortedMessages.length - 1 ? model.sortedMessages[idx + 1] : null;

  const attachedNotes = notesState.ok
    ? notesState.notes.filter((n) => n.targetId === `msg.${message.id}`)
    : [];

  return h("aside", {
    class: "reader-modal",
    id: "reader-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "reader-title",
  }, [
    h("div", { class: "reader-topbar" }, [
      h("div", { class: "reader-top-meta" }, [
        typeBadge(message.type),
        stanceBadge(message.verdict),
        h("time", {
          class: "subtle-meta",
          datetime: message.sentAt || message.date,
          text: timeLabel ? `${formatDate(message.date)} · ${timeLabel}` : formatDate(message.date),
        }),
      ]),
      h("button", {
        type: "button",
        class: "icon-close-btn",
        id: "close-reader",
        "aria-label": "Close message detail",
        onClick: closeMessageDetail,
      }, [icon("close")]),
    ]),
    h("div", { class: "reader-body" }, [
      h("h2", { class: "reader-title", id: "reader-title", text: message.title }),
      h("div", { class: "reader-layer-row" }, (message.layers || []).map((layerId) => h("button", {
        type: "button",
        class: `layer-tag${layerId === message.primaryLayer ? " is-primary" : ""}`,
        title: "Inspect this sublayer on the Five-Layer Cake",
        onClick: () => jumpToTileFromReader(layerId),
        text: model.layerLabel(layerId),
      }))),
      h("ul", { class: "reader-bullets" }, (message.bullets || []).map((b) => renderBulletItem(b))),
      h("div", { class: "reader-counter-box" }, [
        h("h3", { text: "Strongest Counter-View" }),
        h("p", { text: message.counterView }),
      ]),
      message.sources?.length
        ? h("div", { class: "reader-sources" }, [
          h("h3", { text: `Sources (${message.sources.length})` }),
          h("ul", { class: "reader-source-list" }, message.sources.map((src) => h("li", {}, [
            h("a", {
              class: "reader-source-link",
              href: src.url,
              target: "_blank",
              rel: "noopener noreferrer",
            }, [
              h("span", { text: src.name }),
              h("span", { class: "reader-domain" }, [
                extractDomain(src.url),
                icon("external"),
              ]),
            ]),
          ]))),
        ])
        : null,
      h("p", {
        class: "reader-provenance",
        text: `Record provenance: ${message.provenance}`,
      }),
      attachedNotes.length
        ? h("div", { class: "reader-saved-notes" }, [
          h("h4", { text: "Saved on this browser" }),
          ...attachedNotes.map((n) => h("p", { text: n.body })),
        ])
        : null,
      h("div", { class: "reader-footer" }, [
        h("div", { class: "reader-stepper" }, [
          newerMsg
            ? h("button", {
              type: "button",
              class: "ghost-btn",
              onClick: () => openMessageDetail(newerMsg.id, lastOpener),
            }, [icon("arrowLeft"), "Newer"])
            : null,
          olderMsg
            ? h("button", {
              type: "button",
              class: "ghost-btn",
              onClick: () => openMessageDetail(olderMsg.id, lastOpener),
            }, ["Older", icon("arrowRight")])
            : null,
        ]),
        quietNoteButton(
          { id: `msg.${message.id}`, title: message.title },
          "reader-add-note",
          "Add a note",
        ),
      ]),
    ]),
  ]);
}

/* ============================
   HOUSE RULES VIEW
   ============================ */

function buildRules() {
  const keyHighlights = [
    {
      code: "TOLL VS SHORTAGE",
      text: "Ask whether scarcity is a durable, controllable toll or a shortage capital can copy.",
    },
    {
      code: "EVIDENCE TAGS [S] / [C]",
      text: "Figures are marked Sourced or Computed with a dated source rather than bare claims.",
    },
    {
      code: "COUNTER-VIEW REQUIRED",
      text: "Every brief, scout, evening check, and thesis update carries its strongest pushback.",
    },
    {
      code: "EMPTY BOXES STAY EMPTY",
      text: "Sublayers spot bottleneck shifts; tickers are mechanism examples, never boxes to fill.",
    },
  ];

  return h("div", {}, [
    h("div", { class: "section-header" }, [
      h("h2", { text: "House Rules" }),
      h("p", { text: "Operating discipline for reading the five-layer map and weekly signals." }),
    ]),
    h("div", { class: "rules-key-strip" }, keyHighlights.map((item) => h("div", { class: "key-pill-card" }, [
      h("strong", { text: item.code }),
      h("span", { text: item.text }),
    ]))),
    h("div", { class: "rules-grid" }, model.houseRules.map((group, index) => h("section", { class: "rule-card" }, [
      h("div", {}, [
        h("div", { class: "rule-card-head" }, [
          h("span", { class: "rule-icon-box" }, [icon(group.id)]),
          h("div", {}, [
            h("span", { class: "rule-num", text: `RULE SET 0${index + 1}` }),
            h("h3", { text: group.title }),
          ]),
        ]),
        h("ul", { class: "rule-items" }, group.items.map((item) => h("li", { text: item }))),
      ]),
      h("div", { class: "rule-card-foot" }, [
        quietNoteButton({ id: group.id, title: group.title }, `note-${group.id}`, "Add a note"),
      ]),
    ]))),
  ]);
}

/* ============================
   LOCAL-ONLY NOTES DRAWER
   ============================ */

function buildNotesDrawer() {
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
      h("div", { class: "drawer-head" }, [
        h("h2", { id: "notes-title", text: "Notes" }),
        h("button", {
          type: "button",
          class: "icon-close-btn",
          id: "close-notes",
          "aria-label": "Close notes",
          onClick: closeNotesDrawer,
        }, [icon("close")]),
      ]),
      h("p", { class: "notice-box" }, [
        LOCAL_NOTICE,
        h("span", {
          text: "Saved means stored in localStorage on this browser. It is never sent to a server or advisor.",
        }),
      ]),
      h("form", { onSubmit: onSaveNote }, [
        h("p", { class: "about-target" }, [
          "Linked to: ",
          h("strong", { text: target.title }),
          h("span", { class: "target-id", text: target.id }),
        ]),
        h("label", { class: "kicker", for: "note-body", text: "Your note" }),
        h("textarea", {
          id: "note-body",
          maxlength: "2000",
          autocomplete: "off",
          placeholder: "Jot a thought for your next review…",
          value: draft,
          onInput: (event) => {
            draft = event.target.value;
            const counter = document.getElementById("note-count");
            if (counter) counter.textContent = `${draft.length} / 2000`;
          },
        }),
        h("div", { class: "composer-meta" }, [
          h("span", { id: "note-count", text: `${draft.length} / 2000` }),
        ]),
        formError ? h("p", { class: "form-error", role: "alert", text: formError }) : null,
        !notesState.ok ? h("p", { class: "form-error", role: "alert", text: NOTE_ERRORS.corrupt }) : null,
        h("div", { class: "composer-actions" }, [
          h("button", {
            type: "submit",
            class: "primary-btn",
            id: "note-save",
            text: "Save on this browser",
          }),
          draft
            ? h("button", {
              type: "button",
              class: "ghost-btn",
              text: "Clear draft",
              onClick: () => {
                draft = "";
                formError = "";
                focusAfterRender = "note-body";
                render();
              },
            })
            : null,
        ]),
      ]),
    ]),
    h("div", { class: "inbox", id: "inbox" }, [
      groups.length ? null : h("p", { class: "subtle-meta", text: "No notes saved in this browser yet." }),
      ...groups.map((group) => h("section", { class: "note-group" }, [
        h("h3", { text: group.targetTitle }),
        h("span", { class: "target-id", text: group.targetId }),
        ...group.notes.map((note) => h("article", { class: "saved-note" }, [
          h("div", { class: "kicker-row" }, [
            h("span", {
              class: "badge stance-neutral",
              title: "Stored in this browser only.",
              text: "Saved locally",
            }),
            h("span", { class: "subtle-meta", text: formatSavedAt(note.createdAt) }),
          ]),
          h("p", { text: note.body }),
        ])),
      ])),
      notesState.notes.length
        ? h("button", {
          type: "button",
          class: "ghost-btn",
          id: "clear-notes",
          text: "Remove notes from this browser",
          onClick: onClearNotes,
        })
        : null,
    ]),
  ]);
}

async function onSaveNote(event) {
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
  statusMessage = "Saved on this browser only — not sent to your advisor.";
  notesState = await notesAdapter.list();
  focusAfterRender = "note-body";
  render();
}

async function onClearNotes() {
  if (!window.confirm("Remove notes from this browser? They were never sent to your advisor.")) return;
  await notesAdapter.clear();
  statusMessage = "Removed local notes from this browser.";
  notesState = await notesAdapter.list();
  render();
}

function onGlobalKeydown(event) {
  if (event.key === "Escape") {
    if (drawerOpen) {
      event.preventDefault();
      closeNotesDrawer();
      return;
    }
    if (activeMessageId) {
      event.preventDefault();
      closeMessageDetail();
      return;
    }
    if (currentView === "overview" && selectedTileId) {
      event.preventDefault();
      selectTile(null);
      return;
    }
    return;
  }

  if (event.key !== "Tab") return;
  const modalRoot = drawerOpen
    ? document.getElementById("drawer")
    : activeMessageId
      ? document.getElementById("reader-modal")
      : null;
  if (!modalRoot) return;

  const focusable = [...modalRoot.querySelectorAll("button, textarea, input, select, a[href]")].filter((el) => !el.disabled);
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
  document.addEventListener("keydown", onGlobalKeydown, true);

  try {
    notesState = await notesAdapter.list();
  } catch {
    notesState = { ok: false, notes: [], error: "corrupt" };
  }

  try {
    model = await loadArchive();
  } catch (err) {
    loadError = err?.message || "Unable to load content/archive.json.";
    render();
    return;
  }

  window.addEventListener("popstate", (event) => {
    const prevView = currentView;
    if (event.state) applyState(event.state);
    else syncFromLocation();
    if (currentView !== prevView) scrollTopNext = true;
    render();
  });

  if (history.state) {
    applyState(history.state);
  } else {
    syncFromLocation();
    pushHistory(true);
  }

  render();
}

boot();
