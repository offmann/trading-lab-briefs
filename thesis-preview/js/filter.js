export function layerMatches(message, layerId) {
  if (!layerId || layerId === "all") return true;
  const tags = message.layers || [];
  if (tags.includes(layerId)) return true;
  if (/^[1-5]$/.test(layerId)) {
    return tags.some((tag) => tag === layerId || tag.startsWith(layerId));
  }
  return false;
}

export function filterMessages(messages, query = {}) {
  const text = (query.text || "").trim().toLowerCase();
  const type = query.type || "all";
  const layer = query.layer || "all";
  const verdict = query.verdict || "all";

  return messages.filter((message) => {
    if (type !== "all" && message.type !== type) return false;
    if (verdict !== "all" && message.verdict !== verdict) return false;
    if (!layerMatches(message, layer)) return false;
    if (text) {
      const haystack = [
        message.title,
        ...(message.bullets || []),
        message.counterView,
        message.date,
        message.type,
        message.primaryLayer,
        ...(message.layers || []),
        ...((message.sources || []).map((source) => source.name)),
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

/**
 * Sorts newest date first. Within the same date, preserves reverse archive
 * sequence so evening items sit above earlier morning briefs and scouts without
 * inventing timestamps for scouts whose sentAt is null.
 */
export function sortMessages(messages) {
  const indexed = messages.map((message, index) => ({ message, index }));
  indexed.sort((a, b) => {
    const byDate = b.message.date.localeCompare(a.message.date);
    if (byDate !== 0) return byDate;
    return b.index - a.index;
  });
  return indexed.map((entry) => entry.message);
}

export function groupMessagesByDay(messages) {
  const sorted = sortMessages(messages);
  const groups = [];
  const byDate = new Map();
  for (const message of sorted) {
    let group = byDate.get(message.date);
    if (!group) {
      group = { date: message.date, messages: [] };
      byDate.set(message.date, group);
      groups.push(group);
    }
    group.messages.push(message);
  }
  return groups;
}

export function buildTimelineDays(fromDate, toDate, messages) {
  const days = [];
  const byDate = new Map();
  for (const message of messages) {
    if (!byDate.has(message.date)) byDate.set(message.date, []);
    byDate.get(message.date).push(message);
  }
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDate || "");
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDate || "");
  if (!startMatch || !endMatch) {
    for (const [date, items] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      days.push({ date, messages: items });
    }
    return days;
  }
  const cursor = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])));
  const end = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])));
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push({ date: iso, messages: byDate.get(iso) || [] });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// Backwards-compatible aliases
export const filterResearch = filterMessages;
export const sortResearch = sortMessages;
