const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Date-only labels. Never invents a clock time. */
export function formatDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return isoDate;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function formatShortDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return isoDate;
  return `${Number(match[3])} ${month}`;
}

export function formatDayHeading(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const month = MONTHS[monthIdx];
  if (!month) return isoDate;
  const utc = new Date(Date.UTC(year, monthIdx, day));
  const weekday = WEEKDAYS_LONG[utc.getUTCDay()];
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatWeekdayShort(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return "";
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, monthIdx, day));
  return WEEKDAYS_SHORT[utc.getUTCDay()] || "";
}

/**
 * Formats an explicit ISO-8601 timestamp with offset without inventing clock
 * times for date-only/null items and without shifting across viewer timezones.
 */
export function formatSentTime(sentAt) {
  if (!sentAt || typeof sentAt !== "string") return "";
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}):\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(sentAt);
  if (!match) return "";
  const [, hhmm, offset] = match;
  let zone = offset;
  if (offset === "+01:00") zone = "CET";
  else if (offset === "+02:00") zone = "CEST";
  else if (offset === "Z" || offset === "+00:00") zone = "UTC";
  return `${hhmm} ${zone}`;
}

export function formatSavedAt(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

const EVIDENCE_TAG_LABELS = {
  S: "Sourced",
  C: "Computed",
  E: "Estimated",
};

/** Splits trailing [S]/[C]/[E] markers from a bullet into clean text + tags. */
export function parseBulletText(raw) {
  if (typeof raw !== "string") return { text: "", tags: [] };
  let working = raw.trim();
  const found = [];
  const trailing = /\s*((?:\[(?:S|C|E)\])+)\s*$/;
  const match = trailing.exec(working);
  if (match) {
    working = working.slice(0, match.index).trim();
    const codes = match[1].match(/[SCE]/g) || [];
    for (const code of codes) {
      if (!found.some((item) => item.code === code)) {
        found.push({ code, label: EVIDENCE_TAG_LABELS[code] || code });
      }
    }
  }
  return { text: working, tags: found };
}

export function extractDomain(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Formats a coverage window from archive dates. Used by the UI so labels
 * stay in sync when messages are appended. Uses an en dash.
 * short: "17–26 Nov"  full: "17–26 Nov 2026"
 * Cross-month or cross-year ranges include the extra month/year as needed.
 */
export function formatCoverageRange(from, to, options = {}) {
  const short = Boolean(options && options.short);
  const start = parseIsoDate(from);
  const end = parseIsoDate(to) || start;
  if (!start) return "";
  const startMonth = MONTHS[start.month];
  const endMonth = MONTHS[end.month];
  if (!startMonth || !endMonth) return [from, to].filter(Boolean).join("–");
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  if (sameDay) {
    return short ? `${start.day} ${startMonth}` : `${start.day} ${startMonth} ${start.year}`;
  }
  if (start.year === end.year && start.month === end.month) {
    const range = `${start.day}–${end.day} ${startMonth}`;
    return short ? range : `${range} ${start.year}`;
  }
  if (start.year === end.year) {
    const range = `${start.day} ${startMonth}–${end.day} ${endMonth}`;
    return short ? range : `${range} ${start.year}`;
  }
  return `${start.day} ${startMonth} ${start.year}–${end.day} ${endMonth} ${end.year}`;
}

function parseIsoDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

