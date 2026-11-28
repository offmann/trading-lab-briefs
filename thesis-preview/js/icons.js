/**
 * Clean inline SVG icons constructed via createElementNS.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_DEFS = {
  brief: [
    ["rect", { x: "2.2", y: "2", width: "11.6", height: "12", rx: "2" }],
    ["path", { d: "M5 5.5h6M5 8.2h6M5 10.9h3.8" }],
  ],
  scout: [
    ["circle", { cx: "8", cy: "8", r: "5.8" }],
    ["polygon", { points: "10.3,5.7 8.8,8.8 5.7,10.3 7.2,7.2" }],
  ],
  evening: [
    ["path", { d: "M12.6 9.9A5.4 5.4 0 0 1 6.1 3.4a5.5 5.5 0 1 0 6.5 6.5Z" }],
  ],
  thinkers: [
    ["path", { d: "M6 12.2h4M6.6 14h2.8" }],
    ["path", { d: "M5.5 9.6a4.2 4.2 0 1 1 5 0c-.6.5-1 1.1-1.1 1.8H6.6c-.1-.7-.5-1.3-1.1-1.8Z" }],
  ],
  "thesis-change": [
    ["circle", { cx: "4.5", cy: "4", r: "1.7" }],
    ["circle", { cx: "4.5", cy: "12", r: "1.7" }],
    ["circle", { cx: "11.5", cy: "8", r: "1.7" }],
    ["path", { d: "M4.5 5.7v4.6M6.2 4.4c2 0 2.5 3.6 3.6 3.6" }],
  ],
  alert: [
    ["path", { d: "M8 2.3a4.2 4.2 0 0 1 4.2 4.2v2.4l1.2 1.8H2.6l1.2-1.8V6.5A4.2 4.2 0 0 1 8 2.3Z" }],
    ["path", { d: "M6.6 13a1.6 1.6 0 0 0 2.8 0" }],
  ],
  bottleneck: [
    ["path", { d: "M3 2.5h10l-3.4 4.3v2.4L13 13.5H3l3.4-4.3V6.8L3 2.5Z" }],
  ],
  strengthens: [
    ["path", { d: "M4 11.5 11.5 4M6.2 4h5.3v5.3" }],
  ],
  weakens: [
    ["path", { d: "M4 4.5 11.5 12M6.2 12h5.3V6.7" }],
  ],
  watch: [
    ["path", { d: "M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4Z" }],
    ["circle", { cx: "8", cy: "8", r: "1.8" }],
  ],
  neutral: [
    ["circle", { cx: "8", cy: "8", r: "5.5" }],
    ["path", { d: "M5.5 8h5" }],
  ],
  layers: [
    ["polygon", { points: "8,2 14,5.2 8,8.4 2,5.2" }],
    ["path", { d: "M2 8.4 8 11.6 14 8.4" }],
    ["path", { d: "M2 11.4 8 14.4 14 11.4" }],
  ],
  search: [
    ["circle", { cx: "7.2", cy: "7.2", r: "4.6" }],
    ["path", { d: "m10.7 10.7 3.1 3.1" }],
  ],
  filter: [
    ["path", { d: "M2.5 4h11M4.5 8h7M6.5 12h3" }],
  ],
  note: [
    ["path", { d: "M11.2 2.4 13.6 4.8 6 12.4H3.6V10l7.6-7.6Z" }],
    ["path", { d: "M3.2 14h9.6" }],
  ],
  close: [
    ["path", { d: "M4 4l8 8M12 4l-8 8" }],
  ],
  chevronDown: [
    ["path", { d: "m4 6 4 4 4-4" }],
  ],
  chevronUp: [
    ["path", { d: "m4 10 4-4 4 4" }],
  ],
  arrowRight: [
    ["path", { d: "M3.2 8h9.6M9.2 4.4 12.8 8l-3.6 3.6" }],
  ],
  arrowLeft: [
    ["path", { d: "M12.8 8H3.2M6.8 4.4 3.2 8l3.6 3.6" }],
  ],
  external: [
    ["path", { d: "M9.5 3h3.5v3.5M13 3 7.8 8.2" }],
    ["path", { d: "M11.5 9.2v3.3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3.3" }],
  ],
  "rules.ideas": [
    ["path", { d: "M8 2.2 13 4.2v3.6c0 3.1-2.1 5.2-5 6.2-2.9-1-5-3.1-5-6.2V4.2l5-2Z" }],
    ["path", { d: "m5.8 8 1.5 1.5 3-3.1" }],
  ],
  "rules.reading": [
    ["circle", { cx: "7.5", cy: "7.5", r: "4.8" }],
    ["path", { d: "m11.1 11.1 2.7 2.7M5.6 7.5h3.8" }],
  ],
  "rules.map": [
    ["rect", { x: "2.3", y: "2.5", width: "11.4", height: "11", rx: "1.6" }],
    ["path", { d: "M2.3 6.2h11.4M2.3 9.8h11.4M7.8 6.2v7.3" }],
  ],
  "rules.boundary": [
    ["rect", { x: "3.2", y: "7.2", width: "9.6", height: "6.5", rx: "1.5" }],
    ["path", { d: "M5.4 7.2V5.3a2.6 2.6 0 0 1 5.2 0v1.9" }],
  ],
};

export function icon(name, className = "icon") {
  const shapes = ICON_DEFS[name] || ICON_DEFS.layers;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.55");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);

  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }
  return svg;
}
