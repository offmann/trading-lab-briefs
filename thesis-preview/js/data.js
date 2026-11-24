/** Public design-preview copy only. Reported observations, not a portfolio. */

export const VERDICTS = {
  strengthens: "Strengthens",
  weakens: "Weakens",
  watch: "Watch",
};

export const TYPES = {
  brief: "Brief",
  scout: "Scout",
  alert: "Alert",
};

export const SOURCE_CHECK = {
  responded:
    "The page responded to a link check while this preview was prepared. The piece was not re-read, and the observation is not newly verified.",
  unconfirmed:
    "A link check from this environment was refused. The page is not marked missing, and it is not marked confirmed.",
};

export const preview = {
  title: "House view",
  latestObservation: "2026-11-24",
  coverage:
    "Limited sample of research notes, 21–24 Nov 2026. Not the full archive. Reported observations, not newly verified claims.",
  thesis: {
    id: "overview.thesis",
    title: "House thesis",
    paragraphs: [
      "Long-term AI adoption can raise total compute demand even as unit prices fall. Investment returns still depend on who captures the profit.",
      "Bottlenecks move. Scarcity is not automatically a durable toll. Watch financing, permits, actual orders, deployment, and margins, not usage alone.",
    ],
  },
  counter: {
    id: "overview.counter",
    title: "Strongest counter-view",
    text: "AI usage can rise while the profit pool does not. Unit prices can fall faster than volume grows, capital can sit in last year’s bottleneck, and a real constraint can still fail to become a durable toll for shareholders.",
  },
  pulse: [
    {
      group: "strengthens",
      id: "pulse.1b-hv",
      researchId: "scout-2026-11-24-transformers",
      layer: "1b",
      text: "High-voltage equipment, not every electrical product. Export data can lag financing and permits.",
    },
    {
      group: "weakens",
      id: "pulse.2b-nand",
      researchId: "scout-2026-11-22-nand",
      layer: "2b",
      text: "A reported NAND order cut is not an HBM or DRAM shortage.",
    },
    {
      group: "weakens",
      id: "pulse.1c-cooling",
      researchId: "scout-2026-11-23-aaon",
      layer: "1c",
      text: "Cooling scarcity may be easing at one company. That is not a sector trend.",
    },
    {
      group: "watch",
      id: "pulse.2b-rubin",
      researchId: "scout-2026-11-21-rubin",
      layer: "2b",
      text: "Boards and memory may constrain the system below the GPU. The supplier report is unconfirmed.",
    },
    {
      group: "watch",
      id: "pulse.2c-cpo",
      researchId: "scout-2026-11-23-cpo",
      layer: "2c",
      text: "Optics yield may matter. One survey does not confirm an industry-wide delay.",
    },
    {
      group: "watch",
      id: "pulse.usage",
      researchId: "scout-2026-11-22-openrouter",
      layer: "4",
      text: "Cached tokens are not incremental GPU work, and not a power-demand multiplier.",
    },
    {
      group: "watch",
      id: "pulse.5-recursion",
      researchId: "scout-2026-11-21-recursion",
      layer: "5",
      text: "Drug repurposing is an early signal. It is not platform validation.",
    },
  ],
  pressure: [
    {
      id: "pulse.2b-nand",
      researchId: "scout-2026-11-22-nand",
      verdict: "weakens",
      title: "Memory is not one market",
      text: "A reported cut in China-cloud NAND and server-memory orders does not describe HBM or DRAM.",
    },
    {
      id: "pulse.1c-cooling",
      researchId: "scout-2026-11-23-aaon",
      verdict: "weakens",
      title: "Cooling scarcity may be easing",
      text: "One company’s backlog versus fast sales cannot establish a sector trend.",
    },
    {
      id: "pulse.usage",
      researchId: "scout-2026-11-22-openrouter",
      verdict: "watch",
      title: "Token usage is not GPU work",
      text: "Agent usage can rise as token prices fall. Cached tokens are not incremental GPU work, and one platform is not the market.",
    },
    {
      id: "pulse.2c-cpo",
      researchId: "scout-2026-11-23-cpo",
      verdict: "watch",
      title: "A CPO delay is not established",
      text: "A bonding-yield constraint is a single second-hand survey set against existing deployments.",
    },
  ],
};

export const layers = [
  {
    id: "1",
    name: "Physical",
    line: "Power, electrical gear, buildings, and permits.",
    subs: [
      {
        id: "1a",
        name: "Generation",
        bottleneck: "Deliverable power that can actually connect, not the headline that AI needs energy.",
        pricing: "Would come from scarce generation that is contracted and delivered. A power producer is not the equipment maker.",
        validates: "Permits, interconnection, and power that is contracted and then delivered.",
        invalidates: "Treating every company near electricity as a generator, or assuming demand shows up as profit.",
        examples: ["CEG", "TLN"],
        overlap: "GEV is not listed here. It supplies equipment and sits in 1b.",
      },
      {
        id: "1b",
        name: "Grid and electrical equipment",
        bottleneck: "Specific gear can be scarce, especially high-voltage transformers, while smaller electrical products stay competitive.",
        pricing: "Would sit with the constrained class of equipment and the ability to deliver it, not with a whole catalogue.",
        validates: "Orders and lead times for that class of equipment.",
        invalidates: "Reading every electrical product as one shortage, or treating export data as if financing and permits had already turned.",
        examples: ["ETN", "GEV"],
        overlap:
          "GEV is an equipment supplier, not a power producer, so it is not in 1a. ETN is broader than a large-transformer pure play. Similar gear can also serve a data-center plant (1c). Keep one primary category.",
      },
      {
        id: "1c",
        name: "Data-center plant and cooling",
        bottleneck: "Building plant, including cooling, can constrain deployment even when chips are available. It can also loosen.",
        pricing: "Would require scarcity that lasts through installation, not one stretch of lumpy orders.",
        validates: "Lead times and delivery constraints that show up across suppliers.",
        invalidates: "One company’s lumpy contracts, read as the whole cooling market.",
        examples: ["VRT"],
        overlap:
          "A 23 Nov scout names AAON and BASX as the subject of a report. That observation stays on the timeline. It is not added here to fill the box.",
      },
      {
        id: "1d",
        name: "Land and permitting",
        bottleneck: "A site that can be permitted and powered.",
        pricing: "Often a signal rather than a cleanly investable toll. Empty of company names on purpose.",
        validates: "Permits and site control that unblock another layer.",
        invalidates: "Buying a name because the box looked empty.",
        examples: [],
        overlap: "No ticker belongs here just to complete the map.",
      },
    ],
  },
  {
    id: "2",
    name: "Chips",
    line: "Accelerators, memory, interconnect, and the steps that make them.",
    subs: [
      {
        id: "2a",
        name: "Compute GPUs and custom accelerators",
        bottleneck: "The current accelerator, until the constraint moves elsewhere in the system.",
        pricing: "A temporary scarcity rent, not a guaranteed toll. Unit prices can fall while total compute demand rises.",
        validates: "Orders, deployment, and margins.",
        invalidates: "A usage chart, a falling price on its own, or a roadmap comment treated as proof the bottleneck stayed on the GPU.",
        examples: ["NVDA", "AMD", "AVGO"],
        overlap: "AVGO’s primary category on this map is 2a. It is cross-tagged to 2c and must not be counted twice.",
      },
      {
        id: "2b",
        name: "Memory",
        bottleneck: "Depends on the product. HBM and DRAM are not NAND. There is no single memory shortage to assume.",
        pricing: "Only if that specific product is scarce. “Memory” is not one price.",
        validates: "Orders and supply for the named product.",
        invalidates: "A NAND cut read as an HBM collapse, or the reverse.",
        examples: ["MU", "SK hynix"],
        overlap:
          "MU and SK hynix span more than one product. They are examples of the sublayer, not an assignment of one ticker to each nested box.",
        nested: [
          { id: "2b-hbm", name: "HBM and DRAM", text: "High-bandwidth memory and server DRAM. No separate example list." },
          { id: "2b-nand", name: "NAND", text: "Flash, including server solid-state demand. No separate example list." },
        ],
      },
      {
        id: "2c",
        name: "Networking, optics, and interconnect",
        bottleneck: "Moving data inside and between racks. Tools and yield for co-packaged optics can matter. Pluggable optics may keep a longer window. That timing is not settled here.",
        pricing: "Would require a constraint that actually gates shipments, not one survey.",
        validates: "Yield, tool, and shipment evidence from more than one source.",
        invalidates: "One second-hand survey, or counting a company that already has its primary category in 2a.",
        examples: ["MRVL"],
        crossExamples: [{ name: "AVGO", primary: "2a" }],
        overlap: "AVGO is named again because networking is part of the business. Its primary category remains 2a.",
      },
      {
        id: "2d",
        name: "Foundry, equipment, and packaging",
        bottleneck: "Making and packaging the chip can constrain supply upstream of the designer’s brand.",
        pricing: "A foundry, a lithography tool, and a packaging step do not share one toll. One ticker does not stand for all three.",
        validates: "Capacity, utilization, and packaging yield for the specific step.",
        invalidates: "Assuming the designer’s scarcity is automatically the foundry’s profit.",
        examples: ["TSM", "ASML", "ACMR", "BESI"],
        overlap: "These names are examples of different steps, not one basket and not a holding list.",
      },
    ],
  },
  {
    id: "3",
    name: "Infrastructure owners",
    line: "Who owns the compute plant, and where. Geography and business model are different cuts.",
    subs: [
      {
        id: "3a",
        name: "US hyperscalers",
        bottleneck: "Capital, power, and their own deployment schedule. They are also customers of the layers below.",
        pricing: "Comes from the business that uses the infrastructure, not from a spending announcement.",
        validates: "Capacity that is deployed and used, and margins that keep the profit.",
        invalidates: "Treating spend as if it were captured profit.",
        examples: ["GOOGL"],
        overlap: "A US hyperscaler is not the same model as a neocloud (3b) or a China cloud firm (3c).",
      },
      {
        id: "3b",
        name: "Neoclouds and compute landlords",
        bottleneck: "Financing, and filling capacity they rent out. This is not a hyperscaler’s full stack.",
        pricing: "Would depend on contracted utilization that survives delivery. Not established in this preview.",
        validates: "Utilization and financing that still hold after the site is delivered.",
        invalidates: "Adding a name because the box is empty.",
        examples: [],
        overlap: "Left empty on purpose. Do not borrow a ticker from 3a or 3c to tidy the map.",
      },
      {
        id: "3c",
        name: "China cloud",
        bottleneck: "A regional demand and supply system. A signal here is not automatically a signal everywhere else.",
        pricing: "Not established in this preview.",
        validates: "Region-specific orders and deployment.",
        invalidates: "Reading one region’s softness as a global demand collapse.",
        examples: ["BABA"],
        overlap: "This is a geography cut. It is not a second copy of the US hyperscaler model.",
      },
    ],
  },
  {
    id: "4",
    name: "Models",
    line: "No sublayer map in this preview.",
    subs: [],
    empty:
      "Who is paid for inference when the price of a token falls and usage rises is still an open question. One usage scout is on the timeline. It is not coverage of this layer.",
  },
  {
    id: "5",
    name: "Applications",
    line: "No sublayer map in this preview.",
    subs: [],
    empty:
      "One scout reports a drug-repurposing program. That is a single dated observation, not a map of applications, and not broad platform validation.",
  },
];

export const researchNotes = [
  {
    id: "scout-2026-11-21-rubin",
    date: "2026-11-21",
    type: "scout",
    verdict: "watch",
    layers: ["2b", "2a"],
    primaryLayer: "2b",
    title: "Reported Rubin board and memory bottlenecks",
    summary: "System constraints may sit below the GPU, in boards and memory.",
    fact: "A scout reported board-material and memory bottlenecks around Rubin.",
    inference: "System constraints can move below GPUs into memory and boards.",
    counter: "The supplier report is unconfirmed, and Nvidia said the roadmap was on track.",
    unknown: "Send time was not supplied. This preview does not restate the article.",
    sources: [
      {
        name: "Commercial Times",
        url: "https://www.ctee.com.tw/news/20261116700965-430201",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-21-recursion",
    date: "2026-11-21",
    type: "scout",
    verdict: "watch",
    layers: ["5"],
    primaryLayer: "5",
    title: "Recursion REC-4881 progress",
    summary: "Repurposing an existing drug may show an AI-bio result sooner than a new molecule.",
    fact: "A scout reported progress on REC-4881.",
    inference: "Repurposing existing drugs may demonstrate AI-bio sooner than de-novo molecules.",
    counter: "The trial is small, Phase 3 is still needed, and this is not broad platform validation.",
    unknown: "Send time was not supplied. Trial claims were not re-checked for this preview.",
    sources: [
      {
        name: "Recursion",
        url: "https://www.recursion.com/news/rec-4881",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-22-nand",
    date: "2026-11-22",
    type: "scout",
    verdict: "weakens",
    layers: ["2b", "3c"],
    primaryLayer: "2b",
    title: "China cloud reported cutting NAND and server-memory orders",
    summary: "A regional NAND report is not a uniform memory shortage.",
    fact: "A scout reported China cloud reducing NAND and server-memory orders.",
    inference: "There is no uniform memory shortage: NAND differs from HBM and DRAM.",
    counter: "Regional softness does not prove a broad demand collapse.",
    unknown: "Send time was not supplied. The size of any order change is not restated here.",
    sources: [
      {
        name: "TrendForce",
        url: "https://www.trendforce.com/presscenter/news/20261119-13314.html",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-22-openrouter",
    date: "2026-11-22",
    type: "scout",
    verdict: "watch",
    layers: ["4", "5"],
    primaryLayer: "4",
    title: "OpenRouter usage and caching",
    summary: "Higher agent usage is not the same thing as more GPU work.",
    fact: "A scout reported OpenRouter usage and caching trends.",
    inference: "Agent usage can rise as token prices fall, but cached tokens are not equal to incremental GPU work.",
    counter: "One platform is not the whole market. Do not infer a direct power-demand multiplier.",
    unknown: "Send time was not supplied. No usage figures are copied into this preview.",
    sources: [
      {
        name: "OpenRouter",
        url: "https://openrouter.ai/data/october-2026",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-23-cpo",
    date: "2026-11-23",
    type: "scout",
    verdict: "watch",
    layers: ["2c"],
    primaryLayer: "2c",
    title: "Reported CPO bonding yield constraints",
    summary: "Networking can bottleneck on tools and yield. The delay is not confirmed.",
    fact: "A scout reported co-packaged optics bonding yield constraints.",
    inference: "Tools and yield can bottleneck networking, so pluggable optics may keep a longer window.",
    counter: "A single second-hand survey against existing deployments is not a confirmed industry-wide delay.",
    unknown: "Send time was not supplied. This preview does not turn the survey headline into its own claim.",
    sources: [
      {
        name: "Nashnova survey",
        url: "https://www.nashnova.com/feed/special/cpo-volume-shipments-delayed-to-2028-as-hybrid-bonding-yield-becomes-core-17842",
        check: "responded",
      },
      {
        name: "Lambda deployment note",
        url: "https://lambda.com/blog/worlds-first-large-scale-deployment-of-nvidia-photonics-switches-with-cpo",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-23-aaon",
    date: "2026-11-23",
    type: "scout",
    verdict: "weakens",
    layers: ["1c"],
    primaryLayer: "1c",
    title: "AAON and BASX backlog versus fast sales",
    summary: "Cooling scarcity may be easing, on the evidence of one company.",
    fact: "A scout reported AAON and BASX backlog against fast sales.",
    inference: "Cooling scarcity may be easing.",
    counter: "One company’s lumpy contracts cannot establish a sector trend.",
    unknown: "Send time was not supplied. Filing figures are not copied into this preview.",
    sources: [
      {
        name: "AAON filing",
        url: "https://www.sec.gov/Archives/edgar/data/824142/000082414226000088/aaon-20260930.htm",
        check: "responded",
      },
    ],
  },
  {
    id: "scout-2026-11-24-transformers",
    date: "2026-11-24",
    type: "scout",
    verdict: "strengthens",
    layers: ["1b"],
    primaryLayer: "1b",
    title: "Large transformer exports reported strong",
    summary: "Grid scarcity looks concentrated in high-voltage equipment, not in every electrical product.",
    fact: "A scout reported large transformer exports strong while small units face competition.",
    inference: "Grid scarcity is concentrated in high-voltage equipment, not all electrical products.",
    counter: "Export data lag financing and permit changes. ETN’s exposure is broader than a direct large-transformer pure play.",
    unknown: "Send time was not supplied. The link check was refused, so the page is unconfirmed from here.",
    sources: [
      {
        name: "Korea Economic Daily",
        url: "https://www.hankyung.com/article/2026112224611",
        check: "unconfirmed",
      },
    ],
  },
];

export const ruleGroups = [
  {
    id: "rules.reading",
    title: "How a claim is read",
    items: [
      "Separate what was reported, what is inferred, and what is still unknown.",
      "Prefer the evidence over a prominent voice.",
      "Keep the strongest credible counter-view next to the idea.",
      "Date the observation. A dated note is not a permanent truth.",
    ],
  },
  {
    id: "rules.profits",
    title: "Demand and profit",
    items: [
      "Long-term AI adoption can raise total compute demand even as unit prices fall.",
      "Returns depend on who captures the profit, not on usage alone.",
      "Bottlenecks move. Scarcity is not automatically a durable toll.",
      "Watch financing, permits, actual orders, deployment, and margins.",
    ],
  },
  {
    id: "rules.review",
    title: "Changing your mind",
    items: [
      "A changed thesis is a reason to review the idea. It is not an automatic sell.",
      "No mechanical buy or sell calls.",
      "A falling price does not, by itself, validate an idea.",
      "Do not buy a company only to fill an empty sublayer.",
      "Write the review conditions before the event. One earnings print is a weak place to redraw the map.",
    ],
  },
  {
    id: "rules.map",
    title: "How the map is used",
    items: [
      "Five layers, then sublayers. Empty boxes stay empty.",
      "Names are examples of a mechanism. They are not holdings, weights, or recommendations.",
      "If a company fits two places, give it one primary category and a cross-tag.",
      "Geography and business model are different cuts. They will not line up neatly.",
      "GEV is grid and electrical equipment (1b), not a power producer.",
    ],
  },
  {
    id: "rules.boundary",
    title: "What this desk is not",
    items: [
      "Not a trading screen. No orders, transfers, or broker connections.",
      "A note in the inbox is not permission to trade, send, deploy, or skip a confirmation.",
    ],
  },
];

export function findLayer(id) {
  return layers.find((layer) => layer.id === id) || null;
}

export function findSub(id) {
  for (const layer of layers) {
    const sub = (layer.subs || []).find((item) => item.id === id);
    if (sub) return { layer, sub };
  }
  return null;
}

export function layerLabel(id) {
  if (!id) return "";
  const top = findLayer(id);
  if (top) return `L${top.id} ${top.name}`;
  const found = findSub(id);
  if (found) return `${found.sub.id} ${found.sub.name}`;
  return id;
}
