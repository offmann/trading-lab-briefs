export function layerMatches(note, layerId) {
  if (!layerId || layerId === "all") return true;
  const tags = note.layers || [];
  if (tags.includes(layerId)) return true;
  if (/^[1-5]$/.test(layerId)) return tags.some((tag) => tag === layerId || tag.startsWith(layerId));
  return false;
}

export function filterResearch(notes, query = {}) {
  const text = (query.text || "").trim().toLowerCase();
  return notes.filter((note) => {
    if (query.type && query.type !== "all" && note.type !== query.type) return false;
    if (query.verdict && query.verdict !== "all" && note.verdict !== query.verdict) return false;
    if (!layerMatches(note, query.layer || "all")) return false;
    if (query.from && note.date < query.from) return false;
    if (query.to && note.date > query.to) return false;
    if (text) {
      const haystack = [
        note.title,
        note.summary,
        note.fact,
        note.inference,
        note.counter,
        note.unknown,
        note.date,
        note.primaryLayer,
        ...(note.layers || []),
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

export function sortResearch(notes) {
  return [...notes].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
