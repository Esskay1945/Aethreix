/**
 * QueryParser — Classifies user queries into investigation intents.
 * Extracts temporal, spatial, and analytical parameters from natural language.
 */

const INTENT_PATTERNS = [
  {
    intent: 'change_detection',
    patterns: [
      /what.*chang/i, /chang.*detect/i, /differ.*between/i,
      /compar/i, /before.*after/i, /evolution/i, /transform/i,
      /what.*happen/i, /show.*change/i,
    ],
  },
  {
    intent: 'construction_detection',
    patterns: [
      /construct/i, /build/i, /develop/i, /urbaniz/i,
      /new.*structure/i, /when.*built/i, /when.*construct/i,
    ],
  },
  {
    intent: 'vegetation_analysis',
    patterns: [
      /vegetat/i, /forest/i, /deforest/i, /green/i,
      /tree/i, /crop/i, /agricultur/i, /ndvi/i, /plant/i,
    ],
  },
  {
    intent: 'water_analysis',
    patterns: [
      /water/i, /flood/i, /river/i, /lake/i, /coast/i,
      /sea.*level/i, /drought/i, /wetland/i,
    ],
  },
  {
    intent: 'disaster_assessment',
    patterns: [
      /disaster/i, /damage/i, /earthquake/i, /cyclone/i,
      /typhoon/i, /hurricane/i, /landslide/i, /fire/i,
    ],
  },
  {
    intent: 'object_detection',
    patterns: [
      /detect.*object/i, /identify/i, /count/i, /how.*many/i,
      /find/i, /locate/i, /spot/i, /where.*is/i,
    ],
  },
  {
    intent: 'describe_scene',
    patterns: [
      /describ/i, /what.*see/i, /what.*is.*this/i, /tell.*about/i,
      /overview/i, /summar/i, /explain/i, /analyz/i, /what.*area/i,
    ],
  },
];

const TEMPORAL_PATTERNS = [
  { regex: /since\s+(\d{4})/i, extract: (m) => ({ from: parseInt(m[1]), to: new Date().getFullYear() }) },
  { regex: /from\s+(\d{4})\s+to\s+(\d{4})/i, extract: (m) => ({ from: parseInt(m[1]), to: parseInt(m[2]) }) },
  { regex: /between\s+(\d{4})\s+and\s+(\d{4})/i, extract: (m) => ({ from: parseInt(m[1]), to: parseInt(m[2]) }) },
  { regex: /(\d{4})\s*(?:vs|versus|and|to|→)\s*(\d{4})/i, extract: (m) => ({ from: parseInt(m[1]), to: parseInt(m[2]) }) },
  { regex: /in\s+(\d{4})/i, extract: (m) => ({ from: parseInt(m[1]), to: parseInt(m[1]) }) },
  { regex: /last\s+(\d+)\s+years?/i, extract: (m) => ({ from: new Date().getFullYear() - parseInt(m[1]), to: new Date().getFullYear() }) },
];

export function parseQuery(query) {
  // Detect intent
  let intent = 'describe_scene'; // default
  let confidence = 0.5;

  for (const { intent: intentType, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        intent = intentType;
        confidence = 0.85;
        break;
      }
    }
    if (confidence > 0.5) break;
  }

  // Extract temporal references
  let temporal = null;
  for (const { regex, extract } of TEMPORAL_PATTERNS) {
    const match = query.match(regex);
    if (match) {
      temporal = extract(match);
      break;
    }
  }

  // If change detection but no temporal, set default range
  if (['change_detection', 'construction_detection'].includes(intent) && !temporal) {
    temporal = { from: 2020, to: new Date().getFullYear() };
  }

  return {
    intent,
    confidence,
    temporal,
    originalQuery: query,
    requiresSAR: ['construction_detection', 'disaster_assessment', 'flood'].some(
      (k) => intent.includes(k) || query.toLowerCase().includes(k.replace('_', ' '))
    ),
    requiresMultitemporal: !!temporal && temporal.from !== temporal.to,
  };
}
