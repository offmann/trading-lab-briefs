#!/usr/bin/env python3
"""Rebuild the public briefs gallery and scrub private-capital leaks.

Scans docs/briefs/*.html, refreshes the Experiments card lists, stamps
last-updated to the second (Europe/Paris) on Investor (index.html),
Leaderboard, and Experiments, and appends newer research drops on
leaderboard.html when a brief is not already linked.

Also keeps hub IA honest: three-tab chrome only (Investor / Leaderboard /
Experiments), cache-busts internal .html links, copies Investor onto
investor.html, and writes Experiments-equivalent alias pages for the
old progress.html / keepers.html URLs so they are never blank stubs.
Injects a compact Back to Investor · Leaderboard · Experiments bar on
each brief.

Editorial IA (Investor copy, rank tables, plot data) is left alone.
Public chip labels are mapped at render from PUBLIC_VERDICT (Lab pick /
Still testing / Dropped / Parked / Just hold). Internal kinds stay
keep/tweak/drop. Brief KEEP/TWEAK/DROP chips are rewritten through the
same glossary so rebuild cannot reintroduce those visitor labels.

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
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BRIEFS_DIR = DOCS / "briefs"
INDEX_HTML = DOCS / "index.html"
EXPERIMENTS_HTML = DOCS / "experiments.html"
LEADERBOARD_HTML = DOCS / "leaderboard.html"
INVESTOR_HTML = DOCS / "investor.html"
PROGRESS_HTML = DOCS / "progress.html"
KEEPERS_HTML = DOCS / "keepers.html"

# Bump this string when hub HTML must win against a cached GH Pages client.
CACHE_BUSTER = "20260912a"
CACHE_META = '<meta http-equiv="Cache-Control" content="no-cache">'
BUILD_COMMENT = f"<!-- hub-build: {CACHE_BUSTER} -->"

HUB_JUMP_CSS_START = "  /* gallery:hub-jump */"
HUB_JUMP_CSS_END = "  /* gallery:hub-jump:end */"
HUB_JUMP_CSS = f"""{HUB_JUMP_CSS_START}
  nav.hub-jump {{
    display: flex; flex-wrap: wrap; align-items: center; gap: .15rem .5rem;
    margin: 0 0 .85rem; font-size: .8rem; font-weight: 650;
  }}
  nav.hub-jump a {{
    color: var(--teal-ink, #115e59); text-decoration: none;
    min-height: 2.5rem; display: inline-flex; align-items: center;
  }}
  nav.hub-jump a:focus-visible {{
    outline: 2px solid var(--teal, #0f766e); outline-offset: 2px;
  }}
  nav.hub-jump .sep {{ color: var(--ink-faint, #64748b); font-weight: 500; }}
{HUB_JUMP_CSS_END}"""
HUB_JUMP_HTML = (
    '    <nav class="hub-jump" aria-label="Lab sections">\n'
    f'      <a href="../index.html?v={CACHE_BUSTER}">Back to Investor</a>\n'
    '      <span class="sep" aria-hidden="true">·</span>\n'
    f'      <a href="../leaderboard.html?v={CACHE_BUSTER}">Leaderboard</a>\n'
    '      <span class="sep" aria-hidden="true">·</span>\n'
    f'      <a href="../experiments.html?v={CACHE_BUSTER}">Experiments</a>\n'
    "    </nav>"
)

MOVED_NOTES = {
    "progress.html": (
        "This address moved. You are on <strong>Experiments</strong> "
        "(the old Progress URL)."
    ),
    "keepers.html": (
        "This address moved. You are on <strong>Experiments</strong> "
        "(the old Keepers URL)."
    ),
}

HUB_TAB_ITEMS = (
    ("index.html", "Investor"),
    ("leaderboard.html", "Leaderboard"),
    ("experiments.html", "Experiments"),
)
FORBIDDEN_NAV_LABELS = {"overview", "progress", "keepers"}
STUB_MAX_BYTES = 2048

PARIS_TZ = ZoneInfo("Europe/Paris")
REVALIDATION_DAY = dt.date(2026, 9, 9)
PIN_CURRENT = ("2026-09-09-harness-revalidation.html",)
PAPER_LIVE_RE = re.compile(r"paper[\s-]*live", re.I)

BRIEFS_START = "<!-- gallery:briefs:start -->"
BRIEFS_END = "<!-- gallery:briefs:end -->"
SUPERSEDED_START = "<!-- gallery:superseded:start -->"
SUPERSEDED_END = "<!-- gallery:superseded:end -->"
UPDATED_START = "<!-- gallery:updated:start -->"
UPDATED_END = "<!-- gallery:updated:end -->"
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

# Public investor glossary. Internal kinds stay keep/tweak/drop/park/hold.
# Map at render (cards, leaderboard auto, brief chip spans) so CI cannot
# reintroduce KEEP / TWEAK / DROP as the visitor-facing label.
PUBLIC_VERDICT = {
    "keep": "Lab pick",
    "tweak": "Still testing",
    "drop": "Dropped",
    "park": "Parked",
    "hold": "Just hold",
}
# Instruction / status chips — not KEEP/TWEAK/DROP vocabulary.
LEAVE_PUBLIC_CHIP = re.compile(
    r"^(don't|dont|watch|next|paper\s*only|not financial advice|"
    r"demote|baseline|no upgrade|eth transfer no|not btc core)$",
    re.I,
)
HOLD_BASELINE_RE = re.compile(
    r"just\s+hold|buy\s*&(?:amp;)?\s*hold|buy\s+and\s+hold|"
    r"\b(?:bitcoin|btc)\s+hold\b",
    re.I,
)
PUBLIC_CHIP_EXACT = {label.lower() for label in PUBLIC_VERDICT.values()}

GLOSSARY_START = "<!-- gallery:glossary:start -->"
GLOSSARY_END = "<!-- gallery:glossary:end -->"
HOLD_CHIP_CSS_START = "  /* gallery:chip-hold */"
HOLD_CHIP_CSS_END = "  /* gallery:chip-hold:end */"
HOLD_CHIP_CSS = f"""{HOLD_CHIP_CSS_START}
  .chip.hold {{
    color: var(--ink-faint, #64748b);
    background: var(--bg-soft, #e2e8f0);
  }}
{HOLD_CHIP_CSS_END}"""

# Optional per-brief override, e.g.
# <!-- gallery-card title="First screen — BTC & ALGO grids" chip="Lab pick" class="keep" teaser="$6,196 vs hold $4,619" -->
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
    "experiments.html",
    "leaderboard.html",
    "investor.html",
    "progress.html",
    "keepers.html",
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
    published_at: dt.datetime = field(
        default_factory=lambda: dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)
    )
    published_source: str = "unset"
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


def is_hold_baseline(label: str) -> bool:
    """True when the chip is 'own the coin', never a lab-pick KEEP."""
    text = html.unescape(label)
    if re.search(r"hold[\s-]*protect", text, re.I):
        return False
    if re.search(r"\bvs\s+hold\b", text, re.I):
        return False
    return bool(HOLD_BASELINE_RE.search(text))


def classify_chip(css_class: str, label: str) -> str | None:
    label_l = label.lower().strip()
    if SKIP_CHIP_LABELS.match(label_l):
        return None
    css = css_class.lower()
    css_tokens = set(css.split())
    if is_hold_baseline(label) or "hold" in css_tokens or label_l.startswith(
        "just hold"
    ):
        return "hold"
    if "park" in css_tokens or label_l.startswith("park"):
        return "park"
    if "tweak" in label_l and "drop" in label_l:
        return "drop"
    if "keep" in css_tokens or label_l.startswith("keep") or label_l.startswith(
        "lab pick"
    ):
        return "keep"
    if (
        "tweak" in css_tokens
        or label_l.startswith("tweak")
        or label_l.startswith("still testing")
    ):
        return "tweak"
    if (
        "drop" in css_tokens
        or label_l.startswith("drop")
        or label_l.startswith("dropped")
    ):
        return "drop"
    return None


def public_verdict_kind(kind: str | None, label: str) -> str:
    if kind == "hold" or is_hold_baseline(label):
        return "hold"
    if kind in PUBLIC_VERDICT:
        return kind
    return kind or "tweak"


def public_chip_label(kind: str | None, label: str) -> str:
    """Visitor-facing glossary word. Internal KEEP keys stay on Brief."""
    pub_kind = public_verdict_kind(kind, label)
    return PUBLIC_VERDICT.get(pub_kind, label.strip() or "Still testing")


def should_remap_public_chip(kind: str | None, label: str) -> bool:
    text = html_text(label) if "<" in label else label
    text = text.strip()
    if not text:
        return False
    if SKIP_CHIP_LABELS.match(text) or LEAVE_PUBLIC_CHIP.match(text):
        return False
    if text.lower() in PUBLIC_CHIP_EXACT:
        return kind == "hold" or is_hold_baseline(text) or kind in PUBLIC_VERDICT
    return kind in PUBLIC_VERDICT


def rewrite_public_chips(src: str) -> str:
    """Rewrite KEEP/TWEAK/DROP/PARK chip labels through PUBLIC_VERDICT."""

    def repl(match: re.Match[str]) -> str:
        css = match.group(1)
        inner = match.group(2)
        label = html_text(inner)
        kind = classify_chip(css, label)
        if not should_remap_public_chip(kind, label):
            return match.group(0)
        pub_kind = public_verdict_kind(kind, label)
        pub_label = public_chip_label(kind, label)
        return f'<span class="chip {pub_kind}">{esc(pub_label)}</span>'

    return CHIP_RE.sub(repl, src)


def render_glossary_json() -> str:
    payload = (
        '{"keep":"Lab pick","tweak":"Still testing","drop":"Dropped",'
        '"park":"Parked","hold":"Just hold"}'
    )
    return (
        f"{GLOSSARY_START}\n"
        f'  <script type="application/json" id="gallery-glossary">{payload}</script>\n'
        f"  {GLOSSARY_END}"
    )


def ensure_glossary_script(src: str) -> str:
    block = render_glossary_json()
    if GLOSSARY_START in src and GLOSSARY_END in src:
        return re.sub(
            re.escape(GLOSSARY_START) + r".*?" + re.escape(GLOSSARY_END),
            block,
            src,
            count=1,
            flags=re.S,
        )
    if "</body>" in src:
        return src.replace("</body>", f"  {block}\n</body>", 1)
    return src + "\n" + block + "\n"


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
    """Legacy date-only label. Cards must use format_updated_stamp instead."""
    return f"{day.day} {day.strftime('%b')} {day.year}"


def card_date_label(day: dt.date) -> str:
    return public_date_label(day)


def card_published_label(when: dt.datetime) -> str:
    """Second-precision card clock, e.g. '2026-09-09 13:54:16 CEST'."""
    return format_updated_stamp(when)


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
    """One-line paper $1,000 outcome for Experiment cards.

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
        if kind in {"keep", "tweak", "drop", "park", "hold"} and label:
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


GALLERY_PUBLISHED_RE = re.compile(
    r"""<!--\s*gallery-published\b(.*?)-->""",
    re.I | re.S,
)
PUBLISHED_START = "<!-- gallery:published:start -->"
PUBLISHED_END = "<!-- gallery:published:end -->"
PUBLISHED_CSS_START = "  /* gallery:published */"
PUBLISHED_CSS_END = "  /* gallery:published:end */"
PUBLISHED_CSS = f"""{PUBLISHED_CSS_START}
  p.published {{
    font-family: var(--mono, "JetBrains Mono", ui-monospace, monospace);
    font-size: .72rem; color: var(--ink-faint, #64748b);
    margin: 0 0 .85rem; line-height: 1.4;
  }}
{PUBLISHED_CSS_END}"""

NAV_BLOCK_RE = re.compile(
    r'[ \t]*<nav class="tabs"[^>]*>.*?</nav>',
    re.S,
)
HUB_JUMP_NAV_RE = re.compile(
    r"\s*<nav class=\"hub-jump\"[^>]*>.*?</nav>",
    re.S,
)
HEAD_REDIRECT_RE = re.compile(
    r"<head\b[\s\S]*?location\.replace\([\s\S]*?</head>",
    re.I,
)
SECOND_STAMP_RE = re.compile(
    r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (?:CEST|CET)"
)


def bust_href(href: str) -> str:
    """Append or refresh ?v=CACHE_BUSTER on relative .html links."""
    if not href or href.startswith(("http://", "https://", "mailto:", "#", "data:", "javascript:")):
        return href
    path, hashfrag = (href.split("#", 1) + [""])[:2]
    if ".html" not in path:
        return href
    if "?" in path:
        base, query = path.split("?", 1)
        params = [p for p in query.split("&") if p and not p.startswith("v=") and p != "v"]
        params.append(f"v={CACHE_BUSTER}")
        path = base + "?" + "&".join(params)
    else:
        path = path + f"?v={CACHE_BUSTER}"
    return path + (f"#{hashfrag}" if hashfrag else "")


def bust_internal_html_hrefs(src: str) -> str:
    def repl(match: re.Match[str]) -> str:
        quote = match.group(1)
        return f"href={quote}{bust_href(match.group(2))}{quote}"

    return re.sub(
        r"""href=(["'])([^"']+\.html(?:\?[^"']*)?(?:#[^"']*)?)(\1)""",
        repl,
        src,
    )


def ensure_cache_headers(src: str) -> str:
    if 'http-equiv="Cache-Control"' not in src:
        src = src.replace(
            '<meta charset="utf-8">',
            f'<meta charset="utf-8">\n{CACHE_META}\n{BUILD_COMMENT}',
            1,
        )
    elif BUILD_COMMENT not in src:
        if re.search(r"<!-- hub-build:.*?-->", src):
            src = re.sub(r"<!-- hub-build:.*?-->", BUILD_COMMENT, src, count=1)
        else:
            src = src.replace(CACHE_META, f"{CACHE_META}\n{BUILD_COMMENT}", 1)
    return src


def ensure_footer_build(src: str) -> str:
    src = re.sub(r"(?: ·)? build \S+", "", src)
    return re.sub(
        r"(not financial advice)",
        rf"\1 · build {CACHE_BUSTER}",
        src,
        count=1,
    )


def render_hub_tabs(current: str) -> str:
    links: list[str] = []
    for href, label in HUB_TAB_ITEMS:
        attr = ' aria-current="page"' if label == current else ""
        links.append(f'        <a href="{bust_href(href)}"{attr}>{label}</a>')
    return (
        '      <nav class="tabs" aria-label="Lab sections">\n'
        + "\n".join(links)
        + "\n      </nav>"
    )


def set_hub_tabs(src: str, current: str) -> str:
    if not NAV_BLOCK_RE.search(src):
        raise SystemExit("hub page is missing nav.tabs")
    return NAV_BLOCK_RE.sub(render_hub_tabs(current), src, count=1)


def insert_style_block(src: str, start: str, end: str, block: str) -> str:
    region = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if region.search(src):
        return region.sub(block, src, count=1)
    if "</style>" not in src:
        return src
    return src.replace("</style>", block + "\n</style>", 1)


def ensure_brief_hub_jump(src: str) -> str:
    src = insert_style_block(src, HUB_JUMP_CSS_START, HUB_JUMP_CSS_END, HUB_JUMP_CSS)
    src = insert_style_block(src, PUBLISHED_CSS_START, PUBLISHED_CSS_END, PUBLISHED_CSS)
    src = HUB_JUMP_NAV_RE.sub("", src, count=1)
    if "<header class=\"top\">" not in src:
        raise SystemExit("brief is missing <header class=\"top\">")
    return src.replace("<header class=\"top\">", HUB_JUMP_HTML + "\n    <header class=\"top\">", 1)


def parse_gallery_published(src: str) -> tuple[dt.datetime, str] | None:
    match = GALLERY_PUBLISHED_RE.search(src)
    if not match:
        return None
    attrs = parse_attrs(match.group(1))
    iso = (attrs.get("iso") or "").strip()
    if not iso:
        return None
    when = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.timezone.utc)
    source = (attrs.get("source") or "gallery-published").strip()
    return when, source or "gallery-published"


TIMESTAMP_MAP_PATH = ROOT / "scripts" / "brief_timestamps.md"
TIMESTAMP_MAP_ROW_RE = re.compile(
    r"^\|\s*`([^`]+\.html)`\s*\|\s*"
    r"([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\s|]+)\s*\|\s*"
    r"[^|]*\|\s*(.*?)\s*\|\s*$",
    re.M,
)


def _git_rel(path: Path) -> str:
    resolved = path if path.is_absolute() else (ROOT / path)
    try:
        return resolved.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return Path(path).as_posix()


def git_is_shallow() -> bool:
    """True when git history is truncated (or GALLERY_GIT_SHALLOW=1 in tests).

    A depth-1 clone still answers `git log --diff-filter=A`, but it attributes
    every file to HEAD — a fake first-add at the checkout clock.
    """
    override = os.environ.get("GALLERY_GIT_SHALLOW")
    if override is not None and override.strip() != "":
        return override.strip().lower() in {"1", "true", "yes"}
    try:
        raw = subprocess.check_output(
            ["git", "rev-parse", "--is-shallow-repository"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return False
    return raw == "true"


def git_first_add(path: Path) -> tuple[dt.datetime, str] | None:
    """Committer clock of the first add of this path. No --follow (avoids rename ghosts)."""
    rel = _git_rel(path)
    try:
        raw = subprocess.check_output(
            ["git", "log", "--diff-filter=A", "--format=%cI\t%h\t%s", "--", rel],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    if not raw:
        return None
    line = raw.splitlines()[-1]
    parts = line.split("\t", 2)
    if len(parts) < 2:
        return None
    when = dt.datetime.fromisoformat(parts[0])
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.timezone.utc)
    sha = parts[1]
    subject = parts[2] if len(parts) > 2 else ""
    source = f"git-add:{sha}"
    lab = re.search(r"trading-lab@([0-9a-f]+)", subject, re.I)
    if lab:
        source += f" trading-lab@{lab.group(1)}"
    return when, source


def trusted_git_first_add(path: Path) -> tuple[dt.datetime, str] | None:
    """Like git_first_add, but ignore shallow clones (their A-filter is a graft)."""
    if git_is_shallow():
        return None
    return git_first_add(path)


def git_show_file(path: Path, rev: str = "HEAD") -> str | None:
    """Blob contents at rev:path, or None if missing (works on shallow clones)."""
    rel = _git_rel(path)
    try:
        proc = subprocess.run(
            ["git", "show", f"{rev}:{rel}"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def committed_gallery_published(path: Path) -> tuple[dt.datetime, str] | None:
    """Last-published clock from HEAD, surviving a working-tree overwrite."""
    blob = git_show_file(path, "HEAD")
    if blob is None:
        return None
    return parse_gallery_published(blob)


def _map_source(raw: str) -> str:
    sha = re.search(r"git-add\s+`([0-9a-f]+)`", raw, re.I)
    lab = re.search(r"trading-lab@([0-9a-f]+)", raw, re.I)
    if sha:
        source = f"git-add:{sha.group(1)}"
        if lab:
            source += f" trading-lab@{lab.group(1)}"
        return source
    cleaned = re.sub(r"`+|^\s+|\s+$", "", raw)
    return cleaned or "timestamp-map"


@lru_cache(maxsize=1)
def published_timestamp_map() -> dict[str, tuple[dt.datetime, str]]:
    """First-add clocks documented in scripts/brief_timestamps.md."""
    if not TIMESTAMP_MAP_PATH.is_file():
        return {}
    text = TIMESTAMP_MAP_PATH.read_text(encoding="utf-8")
    out: dict[str, tuple[dt.datetime, str]] = {}
    for match in TIMESTAMP_MAP_ROW_RE.finditer(text):
        name, iso, source_raw = match.group(1), match.group(2), match.group(3)
        when = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=dt.timezone.utc)
        out[name] = (when, _map_source(source_raw))
    return out


def timestamp_map_lookup(name: str) -> tuple[dt.datetime, str] | None:
    return published_timestamp_map().get(name)


def _parse_iso_datetime(raw: str) -> dt.datetime:
    if raw.isdigit():
        when = dt.datetime.fromtimestamp(int(raw), tz=dt.timezone.utc)
    else:
        when = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=dt.timezone.utc)
    return when.astimezone(dt.timezone.utc).replace(microsecond=0)


def trading_lab_sha() -> str | None:
    """Lab snapshot sha from env (publish CI) or an explicit commit-message env.

    Do not read `git log -1`: first-publish runs *before* the publish commit, so
    HEAD would be the previous lab snapshot.
    """
    for key in ("TRADING_LAB_SHA", "TRADING_LAB_REF"):
        raw = (os.environ.get(key) or "").strip()
        if not raw:
            continue
        raw = re.sub(r"^trading-lab@", "", raw, flags=re.I)
        match = re.search(r"([0-9a-f]{7,40})", raw, re.I)
        if match:
            return match.group(1)
    blob = " ".join(
        os.environ.get(k) or ""
        for k in ("GALLERY_COMMIT_MESSAGE", "GALLERY_SOURCE")
    )
    match = re.search(r"trading-lab@([0-9a-f]+)", blob, re.I)
    if match:
        return match.group(1)
    repo = os.environ.get("GITHUB_REPOSITORY") or ""
    sha = (os.environ.get("GITHUB_SHA") or "").strip()
    if sha and re.search(r"(?:^|/)trading-lab$", repo):
        return sha
    return None


def first_publish_datetime() -> dt.datetime:
    """UTC now, second precision. Never derive a clock from a filename date.

    Freeze with GALLERY_PUBLISHED_AT (ISO-8601 or unix epoch).
    """
    env = os.environ.get("GALLERY_PUBLISHED_AT")
    if env:
        return _parse_iso_datetime(env)
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def first_publish_source() -> str:
    source = "first-publish"
    sha = trading_lab_sha()
    if sha:
        source += f" trading-lab@{sha}"
    return source


def resolve_brief_published(path: Path, src: str) -> tuple[dt.datetime, str]:
    """Second-precision publish clock. Never invent seconds from a date-only name.

    Resolution order (documented in scripts/brief_timestamps.md):
    1. <!-- gallery-published iso="..." source="..." --> already in the brief
    2. git first-add (skipped on shallow clones — A-filter grafts every file to HEAD)
    3. same comment from HEAD (last public publish; survives a scrub overwrite)
    4. scripts/brief_timestamps.md first-add map
    5. first-publish UTC now — only if this path is not already on HEAD
    """
    embedded = parse_gallery_published(src)
    if embedded:
        return embedded
    added = trusted_git_first_add(path)
    if added:
        return added
    committed = committed_gallery_published(path)
    if committed:
        return committed
    mapped = timestamp_map_lookup(path.name)
    if mapped:
        return mapped
    on_head = git_show_file(path, "HEAD") is not None
    if on_head:
        raise SystemExit(
            f"{path}: no second-precision publish time. Shallow git history "
            "cannot see the first-add, the working tree has no "
            "<!-- gallery-published --> comment, and HEAD / "
            "scripts/brief_timestamps.md have none either. Restore the "
            "comment instead of inventing a new clock."
        )
    return first_publish_datetime(), first_publish_source()


def ensure_brief_published_meta(src: str, when: dt.datetime, source: str) -> str:
    iso = when.isoformat()
    comment = f'<!-- gallery-published iso="{iso}" source="{esc(source)}" -->'
    if GALLERY_PUBLISHED_RE.search(src):
        src = GALLERY_PUBLISHED_RE.sub(comment, src, count=1)
    else:
        src = src.replace("<body>", f"<body>\n  {comment}", 1)
    stamp = format_updated_stamp(when)
    visible = (
        f'<p class="published">Published {PUBLISHED_START}{stamp}{PUBLISHED_END}</p>'
    )
    region = re.compile(
        r'<p class="published">.*?</p>',
        re.S,
    )
    if region.search(src):
        src = region.sub(visible, src, count=1)
    elif "<header class=\"top\">" in src:
        src = re.sub(
            r"(<header class=\"top\">.*?</header>)",
            rf"\1\n    {visible}",
            src,
            count=1,
            flags=re.S,
        )
    else:
        src = src.replace("<body>", f"<body>\n  {visible}", 1)
    return src


def polish_hub_page(src: str, current: str) -> str:
    src = ensure_cache_headers(src)
    src = set_hub_tabs(src, current)
    src = ensure_footer_build(src)
    src = bust_internal_html_hrefs(src)
    src = insert_style_block(src, HOLD_CHIP_CSS_START, HOLD_CHIP_CSS_END, HOLD_CHIP_CSS)
    src = ensure_glossary_script(src)
    return src


def write_if_changed(path: Path, new: str) -> bool:
    old = path.read_text(encoding="utf-8") if path.is_file() else ""
    if new == old:
        return False
    path.write_text(new, encoding="utf-8")
    return True


def add_alias_head(src: str, canonical: str, refresh_to: str | None) -> str:
    src = re.sub(r'[ \t]*<link rel="canonical"[^>]*>\n?', "", src)
    src = re.sub(r'[ \t]*<meta http-equiv="refresh"[^>]*>\n?', "", src)
    extras = [f'<link rel="canonical" href="{canonical}">']
    if refresh_to:
        extras.append(f'<meta http-equiv="refresh" content="1; url={refresh_to}">')
    blob = "\n".join(extras) + "\n"
    return src.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + blob, 1)


def insert_moved_note(src: str, note_html: str) -> str:
    src = re.sub(
        r'[ \t]*<p class="lede" role="status"><!-- alias:moved -->.*?</p>\n?',
        "",
        src,
        count=1,
        flags=re.S,
    )
    note = (
        f'    <p class="lede" role="status"><!-- alias:moved -->{note_html}'
        f"<!-- /alias:moved --></p>\n"
    )
    marker = '<main id="main" class="wrap">'
    if marker not in src:
        raise SystemExit("experiments clone is missing <main id=\"main\">")
    return src.replace(marker, marker + "\n" + note, 1)


def append_alias_redirect(src: str, target: str) -> str:
    src = re.sub(
        r"\s*<script>\s*setTimeout\(function \(\) \{\s*location\.replace\([^)]+\);\s*\}, \d+\);\s*</script>",
        "",
        src,
        count=1,
    )
    script = (
        "  <script>\n"
        "    setTimeout(function () {\n"
        f'      location.replace("{target}");\n'
        "    }, 400);\n"
        "  </script>\n"
    )
    if "</body>" not in src:
        return src + script
    return src.replace("</body>", script + "</body>", 1)


def sync_alias_pages() -> list[Path]:
    changed: list[Path] = []
    index = INDEX_HTML.read_text(encoding="utf-8")
    investor = add_alias_head(index, "index.html", None)
    if write_if_changed(INVESTOR_HTML, investor):
        changed.append(INVESTOR_HTML)

    experiments = EXPERIMENTS_HTML.read_text(encoding="utf-8")
    for path, note in (
        (PROGRESS_HTML, MOVED_NOTES["progress.html"]),
        (KEEPERS_HTML, MOVED_NOTES["keepers.html"]),
    ):
        html = insert_moved_note(experiments, note)
        html = add_alias_head(html, "experiments.html", None)
        if write_if_changed(path, html):
            changed.append(path)
    return changed


def nav_link_labels(src: str) -> list[str]:
    labels: list[str] = []
    for nav in re.finditer(r"<nav\b[^>]*>(.*?)</nav>", src, re.S | re.I):
        for anchor in re.findall(r"<a\b[^>]*>(.*?)</a>", nav.group(1), re.S | re.I):
            labels.append(html_text(anchor))
    return labels


def check_hub_ia() -> list[str]:
    """Fail CI if old 5-tab chrome or blank redirect stubs come back."""
    errors: list[str] = []
    for path in (
        INDEX_HTML,
        INVESTOR_HTML,
        LEADERBOARD_HTML,
        EXPERIMENTS_HTML,
        PROGRESS_HTML,
        KEEPERS_HTML,
    ):
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")
            continue
        src = path.read_text(encoding="utf-8")
        rel = str(path.relative_to(ROOT))
        if len(src.encode("utf-8")) < STUB_MAX_BYTES:
            errors.append(f"{rel} is a blank/stub page ({len(src)} bytes)")
        if HEAD_REDIRECT_RE.search(src) and 'class="tabs"' not in src:
            errors.append(f"{rel} redirects from <head> with no 3-tab chrome")
        if 'http-equiv="Cache-Control"' not in src:
            errors.append(f"{rel} is missing Cache-Control: no-cache")
        if 'class="tabs"' not in src:
            errors.append(f"{rel} is missing the 3-tab nav")
        for label in nav_link_labels(src):
            if label.lower().strip() in FORBIDDEN_NAV_LABELS:
                errors.append(f"{rel} still has {label!r} as a nav label")
        if path in {INDEX_HTML, INVESTOR_HTML}:
            if "$19,879" not in src or "$18,662" not in src:
                errors.append(f"{rel} lost the BTC hold / ALGO lab-pick truth rails")
            if "20/12" not in src:
                errors.append(f"{rel} does not name ALGO lab pick 20/12")
            if re.search(r"ALGO KEEP", src):
                errors.append(f"{rel} still uses ALGO KEEP as a public label")
            if "Just hold" not in src or "Lab pick" not in src:
                errors.append(f"{rel} is missing the Just hold / Lab pick glossary")
        if path == LEADERBOARD_HTML:
            if "Donchian 20/12" not in src or "18662" not in src:
                errors.append("leaderboard is missing ALGO Donchian 20/12 $18,662")
            if re.search(r"20/10 is the only active KEEP", src):
                errors.append("leaderboard still crowns ALGO 20/10 as KEEP")
        if path in {INDEX_HTML, INVESTOR_HTML, LEADERBOARD_HTML, EXPERIMENTS_HTML}:
            if re.search(
                r'<span class="chip[^"]*">\s*(?:Keep|Tweak|Drop|KEEP|TWEAK|DROP)\b',
                src,
            ):
                errors.append(f"{rel} still shows KEEP/TWEAK/DROP as a public chip")
    experiments = EXPERIMENTS_HTML.read_text(encoding="utf-8") if EXPERIMENTS_HTML.is_file() else ""
    if experiments:
        cards = re.findall(
            r'<a class="brief".*?</a>',
            experiments,
            re.S,
        )
        for card in cards:
            if not SECOND_STAMP_RE.search(card):
                errors.append("experiments card missing YYYY-MM-DD HH:MM:SS CEST stamp")
                break
            if re.search(r'<span class="date">\d{1,2} [A-Z][a-z]{2} \d{4}</span>', card):
                errors.append("experiments card still uses a date-only chip")
                break
    for brief in sorted(BRIEFS_DIR.glob("*.html")):
        src = brief.read_text(encoding="utf-8")
        for label in nav_link_labels(src):
            if label.lower().strip() in FORBIDDEN_NAV_LABELS:
                errors.append(f"{brief.name} still has {label!r} as a nav label")
    return errors


def parse_brief(path: Path) -> Brief:
    src = path.read_text(encoding="utf-8")
    chips = pick_chips(src)
    kind, label = headline_chip(chips)
    day = date_from_filename(path.name) or date_from_text(src) or dt.date.today()
    published_at, published_source = resolve_brief_published(path, src)
    return Brief(
        filename=path.name,
        path=path,
        date=day,
        title=pick_title(src, path.name),
        chip_kind=kind,
        chip_label=label,
        summary=pick_summary(src),
        teaser=pick_teaser(src),
        published_at=published_at,
        published_source=published_source,
    )


def scan_briefs() -> list[Brief]:
    if not BRIEFS_DIR.is_dir():
        raise SystemExit(f"missing briefs directory: {BRIEFS_DIR}")
    briefs = [parse_brief(path) for path in sorted(BRIEFS_DIR.glob("*.html"))]
    if not briefs:
        raise SystemExit(f"no HTML briefs in {BRIEFS_DIR}")
    return briefs


def existing_brief_order(html: str) -> list[str]:
    return re.findall(r"""href=["']briefs/([^"'?#]+\.html)""", html)


def existing_brief_order_in_region(source: str, start: str, end: str) -> list[str]:
    found = re.search(re.escape(start) + r".*?" + re.escape(end), source, re.S)
    if not found:
        return []
    return existing_brief_order(found.group(0))


def lane_override(brief: Brief) -> str | None:
    try:
        src = brief.path.read_text(encoding="utf-8")
    except OSError:
        return None
    override = GALLERY_CARD_RE.search(src)
    if not override:
        return None
    lane = parse_attrs(override.group(1)).get("lane", "").strip().lower()
    if lane in {"current", "superseded"}:
        return lane
    return None


def brief_is_superseded(brief: Brief) -> bool:
    """Pre-revalidation write-ups and paper-live path steps are demoted.

    Override with gallery-card lane="current"|"superseded".
    """
    lane = lane_override(brief)
    if lane == "superseded":
        return True
    if lane == "current":
        return False
    blob = " ".join((brief.filename, brief.title, brief.chip_label))
    if PAPER_LIVE_RE.search(blob):
        return True
    return brief.date < REVALIDATION_DAY


def pin_filenames(briefs: list[Brief], pins: tuple[str, ...]) -> list[Brief]:
    by_name = {b.filename: b for b in briefs}
    out: list[Brief] = []
    seen: set[str] = set()
    for name in pins:
        brief = by_name.get(name)
        if brief and name not in seen:
            out.append(brief)
            seen.add(name)
    out.extend(b for b in briefs if b.filename not in seen)
    return out


def split_current_superseded(briefs: list[Brief], experiments_html: str) -> tuple[list[Brief], list[Brief]]:
    by_name = {b.filename: b for b in briefs}
    current: list[Brief] = []
    superseded: list[Brief] = []
    seen: set[str] = set()
    for name in existing_brief_order_in_region(experiments_html, BRIEFS_START, BRIEFS_END):
        brief = by_name.get(name)
        if brief and name not in seen:
            current.append(brief)
            seen.add(name)
    for name in existing_brief_order_in_region(
        experiments_html, SUPERSEDED_START, SUPERSEDED_END
    ):
        brief = by_name.get(name)
        if brief and name not in seen:
            superseded.append(brief)
            seen.add(name)
    extras = [b for b in briefs if b.filename not in seen]
    extras.sort(key=lambda b: (b.date, b.filename))
    for brief in extras:
        if brief_is_superseded(brief):
            superseded.append(brief)
        else:
            current.append(brief)
    return pin_filenames(current, PIN_CURRENT), superseded


def render_brief_cards(briefs: list[Brief]) -> str:
    cards: list[str] = []
    for brief in briefs:
        stamp = card_published_label(brief.published_at)
        iso = brief.published_at.isoformat()
        teaser_html = ""
        if brief.teaser:
            teaser_html = (
                "\n          <p class=\"teaser\">" + esc(brief.teaser) + "</p>"
            )
        when_html = (
            "\n          <p class=\"when\">Published "
            + esc(stamp)
            + "</p>"
        )
        cards.append(
            "        <a class=\"brief\" href=\""
            + esc(bust_href(brief.href))
            + "\">\n          <div class=\"brief-top\"><time class=\"date\" datetime=\""
            + esc(iso)
            + "\">"
            + esc(stamp)
            + "</time><span class=\"chip "
            + esc(public_verdict_kind(brief.chip_kind, brief.chip_label))
            + "\">"
            + esc(public_chip_label(brief.chip_kind, brief.chip_label))
            + "</span></div>\n          <h3>"
            + esc(brief.title)
            + "</h3>"
            + teaser_html
            + when_html
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
    return set(re.findall(r"""href=["'](briefs/[^"'?#]+\.html)""", clipped))


def paper_line(brief: Brief) -> str:
    if brief.teaser:
        return brief.teaser
    return "No single $1,000 figure in this brief — open for tables."


def render_leaderboard_drops(briefs: list[Brief]) -> str:
    if not briefs:
        return ""
    items: list[str] = []
    for brief in briefs:
        teaser = paper_line(brief)
        stamp = card_published_label(brief.published_at)
        items.append(
            "      <article class=\"drop-card\">\n"
            "        <div class=\"top\">\n"
            "          <time class=\"date\" datetime=\""
            + esc(brief.published_at.isoformat())
            + "\">"
            + esc(stamp)
            + "</time>\n"
            "          <span class=\"chip "
            + esc(public_verdict_kind(brief.chip_kind, brief.chip_label))
            + "\">"
            + esc(public_chip_label(brief.chip_kind, brief.chip_label))
            + "</span>\n"
            "        </div>\n"
            "        <h3>"
            + esc(brief.title)
            + "</h3>\n"
            "        <p>"
            + esc(teaser)
            + "</p>\n"
            "        <p class=\"when\">Published "
            + esc(stamp)
            + "</p>\n"
            "        <a class=\"open\" href=\""
            + esc(bust_href(brief.href))
            + "\">Open brief →</a>\n"
            "      </article>"
        )
    return "\n".join(items)


def ensure_markers() -> None:
    """Markers must already be in the hub pages."""
    for path, start, end in (
        (INDEX_HTML, UPDATED_START, UPDATED_END),
        (EXPERIMENTS_HTML, UPDATED_START, UPDATED_END),
        (EXPERIMENTS_HTML, BRIEFS_START, BRIEFS_END),
        (EXPERIMENTS_HTML, SUPERSEDED_START, SUPERSEDED_END),
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
    index_new = stamp_updated_region(index_src, published, INDEX_HTML)
    index_new = polish_hub_page(index_new, "Investor")
    if write_if_changed(INDEX_HTML, index_new):
        changed.append(INDEX_HTML)

    experiments_src = EXPERIMENTS_HTML.read_text(encoding="utf-8")
    experiments_new = stamp_updated_region(experiments_src, published, EXPERIMENTS_HTML)
    current, superseded = split_current_superseded(briefs, experiments_new)
    experiments_new = replace_region(
        experiments_new,
        BRIEFS_START,
        BRIEFS_END,
        render_brief_cards(current),
        EXPERIMENTS_HTML,
    )
    experiments_new = replace_region(
        experiments_new,
        SUPERSEDED_START,
        SUPERSEDED_END,
        render_brief_cards(superseded),
        EXPERIMENTS_HTML,
    )
    experiments_new = polish_hub_page(experiments_new, "Experiments")
    if write_if_changed(EXPERIMENTS_HTML, experiments_new):
        changed.append(EXPERIMENTS_HTML)

    board_src = LEADERBOARD_HTML.read_text(encoding="utf-8")
    board_new = stamp_updated_region(board_src, published, LEADERBOARD_HTML)
    known_board = hrefs_outside_region(board_new, LEADERBOARD_START, LEADERBOARD_END)
    # Hand-written "latest beat" already links the revalidation. Only append
    # later briefs so the auto region does not dump the superseded archive.
    board_extras = [
        b
        for b in sorted(briefs, key=lambda x: (x.date, x.filename))
        if b.href.split("?")[0] not in known_board
        and bust_href(b.href).split("?")[0] not in {h.split("?")[0] for h in known_board}
        and b.date > REVALIDATION_DAY
    ]
    board_new = replace_region(
        board_new,
        LEADERBOARD_START,
        LEADERBOARD_END,
        render_leaderboard_drops(board_extras),
        LEADERBOARD_HTML,
    )
    board_new = polish_hub_page(board_new, "Leaderboard")
    if write_if_changed(LEADERBOARD_HTML, board_new):
        changed.append(LEADERBOARD_HTML)

    for brief in briefs:
        src = brief.path.read_text(encoding="utf-8")
        new = ensure_brief_hub_jump(src)
        new = insert_style_block(new, HOLD_CHIP_CSS_START, HOLD_CHIP_CSS_END, HOLD_CHIP_CSS)
        new = rewrite_public_chips(new)
        new = ensure_brief_published_meta(new, brief.published_at, brief.published_source)
        if write_if_changed(brief.path, new):
            changed.append(brief.path)

    changed.extend(p for p in sync_alias_pages() if p not in changed)
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
    assert public_chip_label(kind, label) == "Dropped"

    assert public_chip_label("keep", "Keep") == "Lab pick"
    assert public_chip_label("tweak", "Tweak family") == "Still testing"
    assert public_chip_label("drop", "Drop prior Donchian 10/5 KEEPs") == "Dropped"
    assert public_verdict_kind("keep", "Keep buy&hold on BTC") == "hold"
    assert public_chip_label("keep", "Keep buy&hold on BTC") == "Just hold"
    assert public_chip_label("keep", "Lab pick") == "Lab pick"
    assert classify_chip("keep", "Lab pick") == "keep"
    remapped = rewrite_public_chips(
        '<span class="chip keep">Keep</span>'
        '<span class="chip drop">Don\'t</span>'
        '<span class="chip keep">Keep buy&amp;hold on BTC</span>'
    )
    assert ">Lab pick<" in remapped
    assert ">Don't<" in remapped
    assert 'class="chip hold">Just hold<' in remapped
    assert rewrite_public_chips(remapped) == remapped

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

    pub_src = (
        '<!-- gallery-published iso="2026-09-06T17:02:20+00:00" '
        'source="git-add:502d31b" -->'
    )
    when, source = parse_gallery_published(pub_src)
    assert when is not None
    assert format_updated_stamp(when) == "2026-09-06 19:02:20 CEST"
    assert source == "git-add:502d31b"
    assert bust_href("index.html") == f"index.html?v={CACHE_BUSTER}"
    assert bust_href("briefs/x.html?v=old") == f"briefs/x.html?v={CACHE_BUSTER}"
    assert "Overview" not in {label for _, label in HUB_TAB_ITEMS}

    live_src = (
        "<p class='lede'>This is path step Paper-live. Two separate $1,000 paper "
        "books are open. Day 0 does not pretend we traded.</p>"
    )
    assert pick_teaser(live_src) == "$1,000 books open — no P&L yet"

    env_keys = (
        "GALLERY_PUBLISHED_AT",
        "TRADING_LAB_SHA",
        "TRADING_LAB_REF",
        "GALLERY_COMMIT_MESSAGE",
        "GALLERY_SOURCE",
        "GITHUB_REPOSITORY",
        "GITHUB_SHA",
        "GALLERY_GIT_SHALLOW",
    )
    saved_env = {k: os.environ.get(k) for k in env_keys}
    try:
        for key in env_keys:
            os.environ.pop(key, None)
        os.environ["GALLERY_PUBLISHED_AT"] = "2026-09-11T12:34:56Z"
        os.environ["TRADING_LAB_SHA"] = "deadbeefcafebabe"
        new_path = BRIEFS_DIR / "2026-09-11-unit-test-untracked.html"
        bare_src = '<html><body>\n    <header class="top"></header>\n</body></html>'
        when, source = resolve_brief_published(new_path, bare_src)
        assert when == dt.datetime(2026, 9, 11, 12, 34, 56, tzinfo=dt.timezone.utc)
        assert source == "first-publish trading-lab@deadbeefcafebabe"
        # Filename date must not become a fake midnight clock.
        assert when.time() != dt.time(0, 0, 0)
        stamped = ensure_brief_published_meta(bare_src, when, source)
        parsed = parse_gallery_published(stamped)
        assert parsed is not None
        assert parsed[0] == when
        assert parsed[1] == source
        assert 'iso="2026-09-11T12:34:56+00:00"' in stamped

        os.environ.pop("TRADING_LAB_SHA", None)
        os.environ["GALLERY_COMMIT_MESSAGE"] = (
            "Publish scrubbed briefs from trading-lab@abc1234"
        )
        when, source = resolve_brief_published(new_path, bare_src)
        assert source == "first-publish trading-lab@abc1234"

        os.environ.pop("GALLERY_COMMIT_MESSAGE", None)
        when, source = resolve_brief_published(new_path, bare_src)
        assert source == "first-publish"

        commented = (
            '<!-- gallery-published iso="2026-09-06T17:02:20+00:00" '
            'source="git-add:502d31b" -->'
        )
        when, source = resolve_brief_published(new_path, commented)
        assert format_updated_stamp(when) == "2026-09-06 19:02:20 CEST"
        assert source == "git-add:502d31b"

        existing = BRIEFS_DIR / "2026-09-09-harness-revalidation.html"
        expected = dt.datetime(2026, 9, 9, 11, 54, 16, tzinfo=dt.timezone.utc)
        mapped = timestamp_map_lookup(existing.name)
        assert mapped is not None
        assert mapped[0] == expected
        assert mapped[1].startswith("git-add:c07e6ba")

        # Stripped working-tree HTML must not first-publish "now" (frozen above).
        when, source = resolve_brief_published(existing, "<html></html>")
        assert when == expected
        assert "first-publish" not in source

        # Publish CI: shallow clone + comments wiped by the lab copy.
        os.environ["GALLERY_GIT_SHALLOW"] = "1"
        when, source = resolve_brief_published(existing, "<html></html>")
        assert when == expected
        assert "first-publish" not in source
        when, source = resolve_brief_published(new_path, bare_src)
        assert source == "first-publish"
        os.environ.pop("GALLERY_GIT_SHALLOW", None)
    finally:
        for key, value in saved_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    old = Brief(
        filename="2026-09-06-first-grids.html",
        path=Path("missing.html"),
        date=dt.date(2026, 9, 6),
        title="First screen",
        chip_kind="keep",
        chip_label="Keep",
        summary="",
        teaser="",
    )
    live = Brief(
        filename="2026-09-09-paper-live-btc-donchian.html",
        path=Path("missing.html"),
        date=dt.date(2026, 9, 9),
        title="Paper-live",
        chip_kind="tweak",
        chip_label="Tweak — paper-live path step",
        summary="",
        teaser="",
    )
    reval = Brief(
        filename="2026-09-09-harness-revalidation.html",
        path=Path("missing.html"),
        date=dt.date(2026, 9, 9),
        title="Harness revalidation",
        chip_kind="drop",
        chip_label="Drop prior Donchian 10/5 KEEPs",
        summary="",
        teaser="",
    )
    assert brief_is_superseded(old) is True
    assert brief_is_superseded(live) is True
    assert brief_is_superseded(reval) is False
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
        ia = check_hub_ia()
        if ia:
            for err in ia:
                print(f"IA  {err}", file=sys.stderr)
            print(f"{len(ia)} hub IA error(s)", file=sys.stderr)
            return 1
        print("privacy scan clean")
        print("hub IA clean")
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
    ia = check_hub_ia()
    if ia:
        for err in ia:
            print(f"IA  {err}", file=sys.stderr)
        print(f"{len(ia)} hub IA error(s)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
