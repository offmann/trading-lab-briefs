#!/usr/bin/env python3
"""Rebuild the public briefs gallery and scrub private-capital leaks.

Scans docs/briefs/*.html, refreshes the Overview card list on docs/index.html,
stamps last-updated to the second (Europe/Paris) on Overview / Progress /
Keepers / Investor / Leaderboard, and appends data-driven nodes on progress.html,
keepers.html, and leaderboard.html when a brief is not already linked.
Editorial IA (family board, “Right now”, investor digest, rank tables) is
left alone.

Privacy: paper $1,000 / $1000 is allowed. Holdings, RISK_PROFILE, “0.15 BTC”,
and personal totals like ~$14k fail the scan (or are stripped with --strip).

Usage:
  python3 scripts/rebuild_gallery.py           # fail if leaks; else rebuild
  python3 scripts/rebuild_gallery.py --strip   # redact leaks, then rebuild
  python3 scripts/rebuild_gallery.py --check   # scan only
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BRIEFS_DIR = DOCS / "briefs"
INDEX_HTML = DOCS / "index.html"
PROGRESS_HTML = DOCS / "progress.html"
KEEPERS_HTML = DOCS / "keepers.html"
INVESTOR_HTML = DOCS / "investor.html"
LEADERBOARD_HTML = DOCS / "leaderboard.html"

PARIS_TZ = ZoneInfo("Europe/Paris")

BRIEFS_START = "<!-- gallery:briefs:start -->"
BRIEFS_END = "<!-- gallery:briefs:end -->"
UPDATED_START = "<!-- gallery:updated:start -->"
UPDATED_END = "<!-- gallery:updated:end -->"
PROGRESS_START = "<!-- gallery:progress-auto:start -->"
PROGRESS_END = "<!-- gallery:progress-auto:end -->"
KEEPERS_START = "<!-- gallery:keepers-auto:start -->"
KEEPERS_END = "<!-- gallery:keepers-auto:end -->"
LEADERBOARD_START = "<!-- gallery:leaderboard-auto:start -->"
LEADERBOARD_END = "<!-- gallery:leaderboard-auto:end -->"

GENERIC_TITLES = {
    "trading lab — experiment brief",
    "trading lab - experiment brief",
    "experiment brief",
}

SKIP_CHIP_LABELS = re.compile(
    r"^(paper\s*only|next|not financial advice)$",
    re.I,
)
GO_LIVE_CHIP = re.compile(r"go live|ship to|as-is", re.I)

# Optional per-brief override, e.g.
# <!-- gallery-card title="First screen — BTC & ALGO grids" chip="Keep" class="keep" teaser="$6,196 vs hold $4,619" -->
GALLERY_CARD_RE = re.compile(
    r"<!--\s*gallery-card\b(.*?)-->",
    re.I | re.S,
)
ATTR_RE = re.compile(
    r"""(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')""",
    re.S,
)

CHIP_RE = re.compile(
    r"""<span\s+class=["']chip\s+([^"']+)["']\s*>(.*?)</span>""",
    re.I | re.S,
)
H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.I | re.S)
TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title>", re.I | re.S)
META_DESC_RE = re.compile(
    r"""<meta\s+name=["']description["']\s+content=["'](.*?)["']""",
    re.I | re.S,
)
SUBTITLE_RE = re.compile(
    r"""<p\s+class=["']subtitle["'][^>]*>(.*?)</p>""",
    re.I | re.S,
)
LEDE_RE = re.compile(
    r"""<p\s+class=["']lede["'][^>]*>(.*?)</p>""",
    re.I | re.S,
)
CHIPS_BLOCK_RE = re.compile(
    r"""<div\s+class=["']chips["'][^>]*>(.*?)</div>""",
    re.I | re.S,
)
FILENAME_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-")

# --- Privacy patterns (paper $1,000 / $1000 is allow-listed first) -----------

PAPER_CASH_RE = re.compile(r"\$\s*1[,\s]?000(?:\.00)?\b")

FORBIDDEN_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "RISK_PROFILE",
        re.compile(r"RISK[_ ]?PROFILE", re.I),
    ),
    (
        "0.15 BTC holding",
        re.compile(r"0\.15\s*BTC\b", re.I),
    ),
    (
        "personal ~$14k-style total",
        re.compile(
            # Known Revolut snapshot totals only — not paper $1k KPIs / entry prices
            # ($124k, ~$2,484, ~$1,011). Source of truth: trading-lab scrubber.
            r"~?\s*\$\s*14(?:k\b|,?000\b)"
            r"|~?\s*\$\s*13,?197\b"
            r"|~?\s*\$\s*12,?237\b"
        ),
    ),
    (
        "Revolut holdings / balances",
        re.compile(
            r"Revolut.{0,48}(?:holding|holdings|balance|portfolio)(?:\s*\$\s*[\d,.]+)?"
            r"|Revolut.{0,24}\$\s*[\d,.]+"
            r"|(?:holding|holdings|balance|portfolio).{0,48}Revolut",
            re.I | re.S,
        ),
    ),
    (
        "personal sleeve framing",
        re.compile(r"core wealth sleeve|accumulate bias", re.I),
    ),
]

SCRUB_GLOBS = (
    "briefs/*.html",
    "briefs/*.md",
    "index.html",
    "progress.html",
    "keepers.html",
    "investor.html",
    "leaderboard.html",
)
SCRUB_SKIP_NAMES = {"UX.md", "README.md"}

REDACT = "[redacted]"


@dataclass
class Chip:
    kind: str
    label: str


@dataclass
class Brief:
    filename: str
    path: Path
    date: dt.date
    title: str
    chip_kind: str
    chip_label: str
    summary: str
    teaser: str
    href: str = field(init=False)

    def __post_init__(self) -> None:
        self.href = f"briefs/{self.filename}"


@dataclass
class ScrubHit:
    path: Path
    rule: str
    snippet: str
    line: int


def html_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def parse_attrs(blob: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for match in ATTR_RE.finditer(blob):
        out[match.group(1).lower()] = match.group(2) or match.group(3) or ""
    return out


def classify_chip(css_class: str, label: str) -> str | None:
    label_l = label.lower().strip()
    if SKIP_CHIP_LABELS.match(label_l):
        return None
    css = css_class.lower()
    if "park" in css or label_l.startswith("park"):
        return "park"
    if "tweak" in label_l and "drop" in label_l:
        return "drop"
    if "keep" in css or label_l.startswith("keep"):
        return "keep"
    if "tweak" in css or label_l.startswith("tweak"):
        return "tweak"
    if "drop" in css or label_l.startswith("drop"):
        return "drop"
    return None


def chips_from_html(block: str) -> list[Chip]:
    found: list[Chip] = []
    for match in CHIP_RE.finditer(block):
        label = html_text(match.group(2))
        kind = classify_chip(match.group(1), label)
        if kind:
            found.append(Chip(kind=kind, label=label))
    return found


def headline_chip(chips: list[Chip]) -> tuple[str, str]:
    if not chips:
        return "tweak", "Tweak"
    for chip in chips:
        if chip.kind == "park" or "park" in chip.label.lower():
            label = chip.label
            if label.lower() in {"park", "park family"}:
                label = "Parked"
            return "park", label
    first = chips[0]
    return first.kind, first.label


def date_from_filename(name: str) -> dt.date | None:
    match = FILENAME_DATE_RE.match(name)
    if not match:
        return None
    return dt.date.fromisoformat(match.group(1))


def date_from_text(text: str) -> dt.date | None:
    match = re.search(
        r"\b(\d{4}-\d{2}-\d{2})\b|"
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s+(\d{4})\b",
        text,
        re.I,
    )
    if not match:
        return None
    if match.group(1):
        return dt.date.fromisoformat(match.group(1))
    months = {
        "jan": 1,
        "feb": 2,
        "mar": 3,
        "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "aug": 8,
        "sep": 9,
        "oct": 10,
        "nov": 11,
        "dec": 12,
    }
    month = months[match.group(2)[:3].lower()]
    return dt.date(int(match.group(4)), month, int(match.group(3)))


def public_date_label(day: dt.date) -> str:
    """Full date on Overview cards and Progress nodes, e.g. '6 Sep 2026'."""
    return f"{day.day} {day.strftime('%b')} {day.year}"


def card_date_label(day: dt.date) -> str:
    return public_date_label(day)


def format_updated_stamp(when: dt.datetime) -> str:
    """Second-precision local stamp, e.g. '2026-09-09 13:54:16 CEST'."""
    local = when.astimezone(PARIS_TZ)
    tzname = local.tzname() or "CET"
    return local.strftime("%Y-%m-%d %H:%M:%S ") + tzname


def briefs_publish_datetime() -> dt.datetime:
    """Latest publish time: git commit on docs/briefs/, else rebuild now.

    Override with GALLERY_UPDATED_AT (ISO-8601) or SOURCE_DATE_EPOCH (unix).
    """
    env = os.environ.get("GALLERY_UPDATED_AT") or os.environ.get("SOURCE_DATE_EPOCH")
    if env:
        if env.isdigit():
            return dt.datetime.fromtimestamp(int(env), tz=dt.timezone.utc)
        return dt.datetime.fromisoformat(env.replace("Z", "+00:00"))
    try:
        raw = subprocess.check_output(
            ["git", "log", "-1", "--format=%cI", "--", "docs/briefs"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if raw:
            return dt.datetime.fromisoformat(raw)
    except (OSError, subprocess.CalledProcessError):
        pass
    return dt.datetime.now(PARIS_TZ)


def render_updated_kicker(when: dt.datetime) -> str:
    return (
        f"{UPDATED_START}Updated {format_updated_stamp(when)}"
        f" · hypothetical $1,000{UPDATED_END}"
    )


def stamp_updated_region(source: str, when: dt.datetime, path: Path) -> str:
    if UPDATED_START not in source or UPDATED_END not in source:
        raise SystemExit(f"{path}: missing {UPDATED_START} … {UPDATED_END}")
    return re.sub(
        re.escape(UPDATED_START) + r".*?" + re.escape(UPDATED_END),
        render_updated_kicker(when),
        source,
        count=1,
        flags=re.S,
    )


def short_title(raw: str) -> str:
    title = html_text(raw)
    title = re.sub(r"\s*[·|].*$", "", title).strip()
    title = re.sub(r"\s+experiment brief:?\s+", " — ", title, flags=re.I)
    title = re.sub(r"^paper-only\s+", "", title, flags=re.I)
    if title.lower() in GENERIC_TITLES:
        return ""
    return title


def pick_title(html_src: str, filename: str) -> str:
    override = GALLERY_CARD_RE.search(html_src)
    if override:
        title = parse_attrs(override.group(1)).get("title", "").strip()
        if title:
            return title

    title_tag = TITLE_RE.search(html_src)
    if title_tag:
        candidate = short_title(title_tag.group(1))
        if candidate:
            return candidate

    h1 = H1_RE.search(html_src)
    if h1:
        candidate = short_title(h1.group(1))
        if candidate and len(candidate) <= 72:
            return candidate

    subtitle = SUBTITLE_RE.search(html_src)
    if subtitle:
        first = html_text(subtitle.group(1)).split("·")[0].strip()
        if first and not re.match(r"^\d{4}", first):
            body = html_src.upper()
            if "FIRST SCREEN" in first.upper() and "BTC" in body and "ALGO" in body:
                return "First screen — BTC & ALGO grids"
            return first

    meta = META_DESC_RE.search(html_src)
    if meta:
        desc = html.unescape(meta.group(1))
        desc = re.sub(r"\s*Not financial advice\.?\s*", "", desc, flags=re.I)
        desc = desc.split(".")[0].strip()
        desc = re.sub(r"\s+experiment brief:?\s+", " — ", desc, flags=re.I)
        if desc:
            return desc[:72].rstrip(" ,;:-")

    slug = FILENAME_DATE_RE.sub("", Path(filename).stem)
    return slug.replace("-", " ").strip().title() or filename


def pick_teaser(html_src: str) -> str:
    """One-line paper $1,000 outcome for Overview cards and Progress nodes.

    Never invent a dollar figure. Prefer an explicit gallery-card teaser;
    otherwise only a plain Day-0 fallback when the brief is clearly paper-live.
    """
    override = GALLERY_CARD_RE.search(html_src)
    if override:
        teaser = parse_attrs(override.group(1)).get("teaser", "").strip()
        if teaser:
            return teaser

    blob = html_text(html_src).lower()
    if "paper-live" in blob or "paper live" in blob:
        if any(
            needle in blob
            for needle in (
                "no p&l",
                "day 0",
                "books are open",
                "books still hold $1,000",
                "books still hold $1000",
            )
        ):
            return "$1,000 books open — no P&L yet"
    return ""


def pick_summary(html_src: str) -> str:
    lede = LEDE_RE.search(html_src)
    if lede:
        text = html_text(lede.group(1))
        if text:
            return _clip(text, 280)
    meta = META_DESC_RE.search(html_src)
    if meta:
        text = html.unescape(meta.group(1))
        text = re.sub(r"\s*Not financial advice\.?\s*", "", text, flags=re.I)
        if text:
            return _clip(text, 280)
    return "New paper brief. Open for tables and the full verdict."


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "…"


def pick_chips(html_src: str) -> list[Chip]:
    override = GALLERY_CARD_RE.search(html_src)
    if override:
        attrs = parse_attrs(override.group(1))
        kind = (attrs.get("class") or "").strip().lower()
        label = (attrs.get("chip") or "").strip()
        if kind in {"keep", "tweak", "drop", "park"} and label:
            return [Chip(kind=kind, label=label)]

    block = CHIPS_BLOCK_RE.search(html_src)
    if block:
        chips = chips_from_html(block.group(1))
        if chips:
            return chips

    h1 = H1_RE.search(html_src)
    if h1:
        start = max(0, h1.start() - 400)
        nearby = chips_from_html(html_src[start : h1.start()])
        if nearby:
            return nearby

    # Takeaways / verdict rows: skip “go live” drops so the headline stands.
    chips: list[Chip] = []
    for chip in chips_from_html(html_src):
        if GO_LIVE_CHIP.search(chip.label):
            continue
        chips.append(chip)
    return chips


def parse_brief(path: Path) -> Brief:
    src = path.read_text(encoding="utf-8")
    chips = pick_chips(src)
    kind, label = headline_chip(chips)
    day = date_from_filename(path.name) or date_from_text(src) or dt.date.today()
    return Brief(
        filename=path.name,
        path=path,
        date=day,
        title=pick_title(src, path.name),
        chip_kind=kind,
        chip_label=label,
        summary=pick_summary(src),
        teaser=pick_teaser(src),
    )


def scan_briefs() -> list[Brief]:
    if not BRIEFS_DIR.is_dir():
        raise SystemExit(f"missing briefs directory: {BRIEFS_DIR}")
    briefs = [parse_brief(path) for path in sorted(BRIEFS_DIR.glob("*.html"))]
    if not briefs:
        raise SystemExit(f"no HTML briefs in {BRIEFS_DIR}")
    return briefs


def existing_brief_order(index_html: str) -> list[str]:
    return re.findall(r"""href=["']briefs/([^"']+\.html)["']""", index_html)


def order_briefs(briefs: list[Brief], index_html: str) -> list[Brief]:
    by_name = {b.filename: b for b in briefs}
    ordered: list[Brief] = []
    seen: set[str] = set()
    for name in existing_brief_order(index_html):
        brief = by_name.get(name)
        if brief and name not in seen:
            ordered.append(brief)
            seen.add(name)
    extras = [b for b in briefs if b.filename not in seen]
    extras.sort(key=lambda b: (b.date, b.filename))
    return ordered + extras


def render_brief_cards(briefs: list[Brief]) -> str:
    cards: list[str] = []
    for brief in briefs:
        teaser_html = ""
        if brief.teaser:
            teaser_html = (
                "\n          <p class=\"teaser\">" + esc(brief.teaser) + "</p>"
            )
        cards.append(
            "        <a class=\"brief\" href=\""
            + esc(brief.href)
            + "\">\n          <div class=\"brief-top\"><span class=\"date\">"
            + esc(card_date_label(brief.date))
            + "</span><span class=\"chip "
            + esc(brief.chip_kind)
            + "\">"
            + esc(brief.chip_label)
            + "</span></div>\n          <h3>"
            + esc(brief.title)
            + "</h3>"
            + teaser_html
            + "\n        </a>"
        )
    return "\n".join(cards)


def replace_region(source: str, start: str, end: str, inner: str, path: Path) -> str:
    if start not in source or end not in source:
        raise SystemExit(f"{path}: missing markers {start} … {end}")
    found = re.search(
        r"^([ \t]*)" + re.escape(start) + r".*?" + re.escape(end),
        source,
        re.S | re.M,
    )
    if not found:
        raise SystemExit(f"{path}: could not replace region {start}")
    indent = found.group(1)
    body = inner.strip("\n")
    if body:
        replacement = f"{start}\n{body}\n{indent}{end}"
    else:
        replacement = f"{start}\n{indent}{end}"
    return source[: found.start(0) + len(indent)] + replacement + source[found.end(0) :]


def hrefs_outside_region(source: str, start: str, end: str) -> set[str]:
    if start in source and end in source:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        clipped = pattern.sub("", source)
    else:
        clipped = source
    return set(re.findall(r"""href=["'](briefs/[^"']+\.html)["']""", clipped))


def count_nodes_outside_region(source: str, start: str, end: str) -> int:
    if start in source and end in source:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        clipped = pattern.sub("", source)
    else:
        clipped = source
    return len(re.findall(r"<li\s+class=\"node", clipped))


def paper_line(brief: Brief) -> str:
    if brief.teaser:
        return brief.teaser
    return "No single $1,000 figure in this brief — open for tables."


def render_progress_nodes(briefs: list[Brief], start_step: int) -> str:
    if not briefs:
        return ""
    chunks: list[str] = []
    for offset, brief in enumerate(briefs, start=1):
        step = start_step + offset
        node_class = "node"
        if brief.chip_kind in {"drop", "park"}:
            node_class = f"node {brief.chip_kind}"
        chunks.append(
            "      <li class=\""
            + node_class
            + "\">\n"
            "        <div class=\"dot\" aria-hidden=\"true\"></div>\n"
            "        <article class=\"card\">\n"
            "          <div class=\"meta\">\n"
            "            <span class=\"date\">"
            + esc(card_date_label(brief.date))
            + "</span>\n"
            "            <span class=\"step\">"
            + esc(f"{step} · Brief")
            + "</span>\n"
            "            <span class=\"chip "
            + esc(brief.chip_kind)
            + "\">"
            + esc(brief.chip_label)
            + "</span>\n"
            "          </div>\n"
            "          <h2>"
            + esc(brief.title)
            + "</h2>\n"
            "          <p class=\"learned\"><strong>Learned:</strong> "
            + esc(brief.summary)
            + "</p>\n"
            "          <p class=\"paper\">"
            + esc(paper_line(brief))
            + "</p>\n"
            "          <a class=\"open\" href=\""
            + esc(brief.href)
            + "\">Open brief →</a>\n"
            "        </article>\n"
            "      </li>"
        )
    return "\n".join(chunks)


def render_keepers_section(briefs: list[Brief]) -> str:
    if not briefs:
        return ""
    items: list[str] = []
    for brief in briefs:
        items.append(
            "      <article class=\"card\">\n"
            "        <div class=\"top\">\n"
            "          <span class=\"date\">"
            + esc(card_date_label(brief.date))
            + "</span>\n"
            "          <span class=\"chip "
            + esc(brief.chip_kind)
            + "\">"
            + esc(brief.chip_label)
            + "</span>\n"
            "        </div>\n"
            "        <h2>"
            + esc(brief.title)
            + "</h2>\n"
            "        <p>"
            + esc(brief.summary)
            + "</p>\n"
            "        <a class=\"open\" href=\""
            + esc(brief.href)
            + "\">Open brief →</a>\n"
            "      </article>"
        )
    return (
        "    <section aria-labelledby=\"auto-keepers-title\">\n"
        "      <h2 id=\"auto-keepers-title\" style=\"margin:1.2rem 0 .65rem;font-size:1.125rem\">"
        "From newer briefs</h2>\n"
        + "\n".join(items)
        + "\n    </section>"
    )


def render_leaderboard_drops(briefs: list[Brief]) -> str:
    if not briefs:
        return ""
    items: list[str] = []
    for brief in briefs:
        teaser = paper_line(brief)
        items.append(
            "      <article class=\"drop-card\">\n"
            "        <div class=\"top\">\n"
            "          <span class=\"date\">"
            + esc(card_date_label(brief.date))
            + "</span>\n"
            "          <span class=\"chip "
            + esc(brief.chip_kind)
            + "\">"
            + esc(brief.chip_label)
            + "</span>\n"
            "        </div>\n"
            "        <h3>"
            + esc(brief.title)
            + "</h3>\n"
            "        <p>"
            + esc(teaser)
            + "</p>\n"
            "        <a class=\"open\" href=\""
            + esc(brief.href)
            + "\">Open brief →</a>\n"
            "      </article>"
        )
    return "\n".join(items)


def ensure_markers() -> None:
    """No-op guard used by tests; markers must already be in the hub pages."""
    for path, start, end in (
        (INDEX_HTML, BRIEFS_START, BRIEFS_END),
        (INDEX_HTML, UPDATED_START, UPDATED_END),
        (PROGRESS_HTML, UPDATED_START, UPDATED_END),
        (PROGRESS_HTML, PROGRESS_START, PROGRESS_END),
        (KEEPERS_HTML, UPDATED_START, UPDATED_END),
        (KEEPERS_HTML, KEEPERS_START, KEEPERS_END),
        (INVESTOR_HTML, UPDATED_START, UPDATED_END),
        (LEADERBOARD_HTML, UPDATED_START, UPDATED_END),
        (LEADERBOARD_HTML, LEADERBOARD_START, LEADERBOARD_END),
    ):
        text = path.read_text(encoding="utf-8")
        if start not in text or end not in text:
            raise SystemExit(f"{path.relative_to(ROOT)} is missing {start} / {end}")


def update_hub_pages(briefs: list[Brief]) -> list[Path]:
    changed: list[Path] = []
    published = briefs_publish_datetime()
    index_src = INDEX_HTML.read_text(encoding="utf-8")
    ordered = order_briefs(briefs, index_src)
    index_new = stamp_updated_region(index_src, published, INDEX_HTML)
    index_new = replace_region(
        index_new,
        BRIEFS_START,
        BRIEFS_END,
        render_brief_cards(ordered),
        INDEX_HTML,
    )
    if index_new != index_src:
        INDEX_HTML.write_text(index_new, encoding="utf-8")
        changed.append(INDEX_HTML)

    progress_src = PROGRESS_HTML.read_text(encoding="utf-8")
    progress_new = stamp_updated_region(progress_src, published, PROGRESS_HTML)
    known = hrefs_outside_region(progress_new, PROGRESS_START, PROGRESS_END)
    extras = [b for b in ordered if b.href not in known]
    start_step = count_nodes_outside_region(progress_new, PROGRESS_START, PROGRESS_END)
    progress_new = replace_region(
        progress_new,
        PROGRESS_START,
        PROGRESS_END,
        render_progress_nodes(extras, start_step),
        PROGRESS_HTML,
    )
    if progress_new != progress_src:
        PROGRESS_HTML.write_text(progress_new, encoding="utf-8")
        changed.append(PROGRESS_HTML)

    keepers_src = KEEPERS_HTML.read_text(encoding="utf-8")
    keepers_new = stamp_updated_region(keepers_src, published, KEEPERS_HTML)
    known_k = hrefs_outside_region(keepers_new, KEEPERS_START, KEEPERS_END)
    # Skip briefs already told on the hand-written timeline — those ideas
    # already have editorial keeper cards. Only new files get a stub.
    known_story = hrefs_outside_region(progress_new, PROGRESS_START, PROGRESS_END)
    keeper_extras = [
        b
        for b in ordered
        if b.chip_kind in {"keep", "park"}
        and b.href not in known_k
        and b.href not in known_story
    ]
    keepers_new = replace_region(
        keepers_new,
        KEEPERS_START,
        KEEPERS_END,
        render_keepers_section(keeper_extras),
        KEEPERS_HTML,
    )
    if keepers_new != keepers_src:
        KEEPERS_HTML.write_text(keepers_new, encoding="utf-8")
        changed.append(KEEPERS_HTML)

    investor_src = INVESTOR_HTML.read_text(encoding="utf-8")
    investor_new = stamp_updated_region(investor_src, published, INVESTOR_HTML)
    if investor_new != investor_src:
        INVESTOR_HTML.write_text(investor_new, encoding="utf-8")
        changed.append(INVESTOR_HTML)

    board_src = LEADERBOARD_HTML.read_text(encoding="utf-8")
    board_new = stamp_updated_region(board_src, published, LEADERBOARD_HTML)
    known_board = hrefs_outside_region(board_new, LEADERBOARD_START, LEADERBOARD_END)
    # Hand-written scoreboard history already links the revalidation story.
    # Only append briefs that are not already on Progress (hand-written) or
    # this page — chronological research drops after the truth-serum beat.
    board_extras = [
        b
        for b in ordered
        if b.href not in known_board and b.href not in known_story
    ]
    board_new = replace_region(
        board_new,
        LEADERBOARD_START,
        LEADERBOARD_END,
        render_leaderboard_drops(board_extras),
        LEADERBOARD_HTML,
    )
    if board_new != board_src:
        LEADERBOARD_HTML.write_text(board_new, encoding="utf-8")
        changed.append(LEADERBOARD_HTML)

    return changed


def mask_allowed_paper_cash(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def stash(match: re.Match[str]) -> str:
        tokens.append(match.group(0))
        return f"\x00PAPER{len(tokens) - 1}\x00"

    return PAPER_CASH_RE.sub(stash, text), tokens


def restore_paper_cash(text: str, tokens: list[str]) -> str:
    for i, token in enumerate(tokens):
        text = text.replace(f"\x00PAPER{i}\x00", token)
    return text


def find_hits_in_text(text: str, path: Path) -> list[ScrubHit]:
    masked, _tokens = mask_allowed_paper_cash(text)
    hits: list[ScrubHit] = []
    for rule, pattern in FORBIDDEN_RULES:
        for match in pattern.finditer(masked):
            line = masked.count("\n", 0, match.start()) + 1
            snippet = re.sub(r"\s+", " ", match.group(0)).strip()
            if len(snippet) > 80:
                snippet = snippet[:77] + "…"
            hits.append(ScrubHit(path=path, rule=rule, snippet=snippet, line=line))
    return hits


def strip_text(text: str) -> tuple[str, int]:
    masked, tokens = mask_allowed_paper_cash(text)
    count = 0
    for _rule, pattern in FORBIDDEN_RULES:
        masked, n = pattern.subn(REDACT, masked)
        count += n
    return restore_paper_cash(masked, tokens), count


def iter_scrub_files() -> list[Path]:
    files: list[Path] = []
    for glob in SCRUB_GLOBS:
        files.extend(sorted(DOCS.glob(glob)))
    return [p for p in files if p.is_file() and p.name not in SCRUB_SKIP_NAMES]


def scan_privacy(files: list[Path] | None = None) -> list[ScrubHit]:
    hits: list[ScrubHit] = []
    for path in files or iter_scrub_files():
        text = path.read_text(encoding="utf-8")
        hits.extend(find_hits_in_text(text, path))
    return hits


def strip_privacy(files: list[Path] | None = None) -> list[Path]:
    changed: list[Path] = []
    for path in files or iter_scrub_files():
        original = path.read_text(encoding="utf-8")
        updated, n = strip_text(original)
        if n and updated != original:
            path.write_text(updated, encoding="utf-8")
            changed.append(path)
    return changed


def report_hits(hits: list[ScrubHit]) -> None:
    for hit in hits:
        rel = hit.path.relative_to(ROOT)
        print(f"PRIVACY  {rel}:{hit.line}  [{hit.rule}]  {hit.snippet}", file=sys.stderr)
        print(
            f"::warning file={rel},line={hit.line}::{hit.rule}: {hit.snippet}",
        )


def self_test() -> None:
    clean = (
        "Paper-only BTC screen. Start $1,000 (also $1000). "
        "Ended $6,196 vs hold $4,619. Units 0.219 vs 0.132. "
        "Sticky ~$10.2k ≈ hold ~$10.6k; fast ~$48.8k. "
        "Donchian vs SMA $124k. Paper BUY ~$2,484.55; book ~$1,011.47; hold ~$1,019."
    )
    assert find_hits_in_text(clean, Path("ok.html")) == []

    leaked = (
        "RISK_PROFILE.md says ~$14k. Revolut holdings $4200. "
        "Stack is 0.15 BTC. Core wealth sleeve / accumulate bias."
    )
    rules = {h.rule for h in find_hits_in_text(leaked, Path("bad.html"))}
    assert "RISK_PROFILE" in rules
    assert "0.15 BTC holding" in rules
    assert "personal ~$14k-style total" in rules
    assert "Revolut holdings / balances" in rules
    assert "personal sleeve framing" in rules

    stripped, n = strip_text("Keep $1,000 and drop 0.15 BTC plus ~$14k.")
    assert n >= 2
    assert "$1,000" in stripped
    assert "0.15 BTC" not in stripped
    assert "~$14k" not in stripped

    chips = chips_from_html(
        '<span class="chip tweak">Tweak family</span>'
        '<span class="chip drop">Park family</span>'
    )
    kind, label = headline_chip(chips)
    assert kind == "park" and label == "Parked"

    drop_chips = chips_from_html('<span class="chip tweak">Tweak → Drop</span>')
    kind, label = headline_chip(drop_chips)
    assert kind == "drop" and "Drop" in label

    keep_src = (
        "<title>SMA 5/20 stress — BTC · Sep 6, 2026</title>"
        '<span class="chip tweak">Tweak</span><h1>Long thesis sentence here</h1>'
    )
    assert pick_title(keep_src, "2026-09-06-sma520-stress.html") == "SMA 5/20 stress — BTC"
    assert public_date_label(dt.date(2026, 9, 6)) == "6 Sep 2026"

    utc = dt.datetime(2026, 9, 9, 11, 54, 16, tzinfo=dt.timezone.utc)
    assert format_updated_stamp(utc) == "2026-09-09 13:54:16 CEST"
    kicker = render_updated_kicker(utc)
    assert "13:54:16 CEST" in kicker
    assert UPDATED_START in kicker and UPDATED_END in kicker

    teaser_src = (
        '<!-- gallery-card title="Alts upside screen" chip="Keep Donchian" '
        'class="keep" teaser="Donchian paper: ALGO $8.8M · ETH $81.4M (historical)" -->'
    )
    assert "ALGO $8.8M" in pick_teaser(teaser_src)

    live_src = (
        "<p class='lede'>This is path step Paper-live. Two separate $1,000 paper "
        "books are open. Day 0 does not pretend we traded.</p>"
    )
    assert pick_teaser(live_src) == "$1,000 books open — no P&L yet"
    print("self-test ok")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strip",
        action="store_true",
        help="Redact forbidden patterns in published docs, then rebuild.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Scan for leaks only; do not write gallery HTML.",
    )
    parser.add_argument(
        "--skip-self-test",
        action="store_true",
        help="Skip built-in privacy/parser assertions.",
    )
    args = parser.parse_args(argv)

    if args.check and args.strip:
        print("use --check or --strip, not both", file=sys.stderr)
        return 2

    if not args.skip_self_test:
        self_test()

    if args.check:
        hits = scan_privacy()
        if hits:
            report_hits(hits)
            print(f"{len(hits)} privacy hit(s)", file=sys.stderr)
            return 1
        print("privacy scan clean")
        return 0

    if args.strip:
        hits = scan_privacy()
        if hits:
            report_hits(hits)
            stripped = strip_privacy()
            print(f"stripped {len(hits)} hit(s) in {len(stripped)} file(s)", file=sys.stderr)
        leftover = scan_privacy()
        if leftover:
            report_hits(leftover)
            print("privacy hits remain after strip", file=sys.stderr)
            return 1
    else:
        hits = scan_privacy()
        if hits:
            report_hits(hits)
            print(
                f"{len(hits)} privacy hit(s). Fix the files or rerun with --strip.",
                file=sys.stderr,
            )
            return 1

    ensure_markers()
    briefs = scan_briefs()
    changed = update_hub_pages(briefs)
    print(f"scanned {len(briefs)} brief(s)")
    for brief in briefs:
        print(f"  {brief.filename}  [{brief.chip_kind}] {brief.chip_label}  — {brief.title}")
    if changed:
        print("wrote " + ", ".join(str(p.relative_to(ROOT)) for p in changed))
    else:
        print("hub pages already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
