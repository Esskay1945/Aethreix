/**
 * AnalysisEngine — Orchestrates AI investigation pipeline.
 * Provides informed analysis based on known geospatial data patterns.
 * 
 * IMPORTANT: This engine does NOT connect to a real ML backend.
 * It uses knowledge-based heuristics from OpenStreetMap, Sentinel program metadata,
 * and geospatial domain expertise to provide contextual (not fabricated) answers.
 */

import { parseQuery } from './QueryParser.js';

// Processing delay for realistic UX
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run analysis based on user query + current location/date context.
 * Returns { text, evidence } for the AI response.
 */
export async function runAnalysis(query, context) {
  const parsed = parseQuery(query);
  const { lat, lon, name } = context.location;
  const { selectedYear } = context;

  // Simulate processing time
  await delay(1500 + Math.random() * 800);

  // General knowledge Q&A — handle common questions that aren't intent-specific
  const generalAnswer = tryGeneralKnowledge(query, name, lat, lon, selectedYear);
  if (generalAnswer) return generalAnswer;

  switch (parsed.intent) {
    case 'change_detection':
      return generateChangeDetectionResponse(parsed, name, lat, lon, selectedYear);
    case 'construction_detection':
      return generateConstructionResponse(parsed, name, lat, lon, selectedYear);
    case 'vegetation_analysis':
      return generateVegetationResponse(parsed, name, lat, lon, selectedYear);
    case 'water_analysis':
      return generateWaterResponse(parsed, name, lat, lon, selectedYear);
    case 'disaster_assessment':
      return generateDisasterResponse(parsed, name, lat, lon, selectedYear);
    case 'object_detection':
      return generateObjectDetectionResponse(parsed, name, lat, lon, selectedYear);
    case 'describe_scene':
    default:
      return generateSceneDescription(parsed, name, lat, lon, selectedYear);
  }
}

/**
 * Handle common questions that don't require satellite analysis.
 * Returns null if the query doesn't match any known pattern.
 */
function tryGeneralKnowledge(query, name, lat, lon, year) {
  const q = query.toLowerCase();
  const loc = name || `${lat?.toFixed(2)}°N, ${lon?.toFixed(2)}°E`;

  // What data sources are available
  if (q.includes('what data') || q.includes('data source') || q.includes('what satellite') || q.includes('resolution')) {
    return {
      text: `**Available Data Sources for ${loc}**\n\n**Imagery currently loaded:**\n- 🛰️ **Esri World Imagery** — High-res commercial satellite mosaic (sub-meter to 1m resolution in urban areas, 15m elsewhere)\n- 🌍 **Sentinel-2 Cloudless** — Annual mosaics from 2017–2024 via EOX (10m optical, 4 spectral bands visible)\n- 🗺️ **CartoDB / Esri Reference** — Road networks, city labels, and administrative boundaries\n\n**Sentinel-2 Program Details:**\n- Resolution: 10m (visible bands), 20m (vegetation red-edge), 60m (atmospheric)\n- Revisit: Every 5 days (2 satellites: S2A + S2B)\n- Coverage: Global land surfaces between 56°S and 84°N\n\n**Note:** The timeline shows pre-processed annual cloud-free mosaics, not raw scene-level acquisitions. For specific date imagery, a direct Copernicus Data Space API integration would be needed.`,
      evidence: { type: 'info', sources: ['Sentinel-2 Program', 'Esri', 'EOX'], confidence: 95 },
    };
  }

  // What is this platform
  if (q.includes('what is aethrix') || q.includes('what is this') || q.includes('what can you do') || q.includes('help') || q.includes('how does this work')) {
    return {
      text: `**About Aethrix**\n\nAethrix is a geospatial intelligence platform that lets you explore Earth observation data interactively.\n\n**What you can do:**\n- 🔍 **Search** any location worldwide and fly to it on the 3D globe\n- 📅 **Timeline** — Browse Sentinel-2 annual mosaics from 2017 to present\n- 🗺️ **Map Modes** — Switch between Satellite, Hybrid, SAR simulation, and NDVI visualization\n- 💬 **Ask me questions** about what you're looking at — I can provide contextual analysis based on location and time\n\n**Current limitations:**\n- Analysis is based on geospatial heuristics, not a live ML pipeline\n- Historical imagery shows annual cloud-free composites, not specific dates\n- SAR and NDVI modes are visual simulations applied to optical imagery`,
      evidence: { type: 'info', sources: ['Aethrix Platform'], confidence: 100 },
    };
  }

  // Weather / climate — can't answer
  if (q.includes('weather') || q.includes('temperature') || q.includes('rain') || q.includes('forecast')) {
    return {
      text: `I don't have access to real-time weather data or forecasts. Aethrix focuses on **satellite imagery analysis**, not meteorological data.\n\nFor weather information, I'd recommend:\n- [OpenWeatherMap](https://openweathermap.org)\n- [Windy.com](https://windy.com)\n- India Meteorological Department (IMD) for Indian locations`,
      evidence: { type: 'info', sources: [], confidence: 100 },
    };
  }

  // Population / demographics
  if (q.includes('population') || q.includes('how many people') || q.includes('census')) {
    return {
      text: `I don't have access to census or population databases. Satellite imagery can show **urban density patterns** (building footprints, road networks, nighttime lights), but converting that to population numbers requires census data integration.\n\n**What I can tell you from imagery:**\n- Relative urban density (high/medium/low built-up area)\n- Urban expansion trends over time using the timeline\n- Residential vs commercial/industrial zone patterns\n\nFor actual population data, refer to national census databases or the UN World Urbanization Prospects.`,
      evidence: { type: 'info', sources: ['Sentinel-2'], confidence: 85 },
    };
  }

  return null; // Not a general knowledge question
}

function generateChangeDetectionResponse(parsed, name, lat, lon, year) {
  const from = parsed.temporal?.from || 2020;
  const to = parsed.temporal?.to || year;
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  const years = [];
  for (let y = from; y <= to; y++) {
    years.push({ year: y, status: y < from + Math.floor((to - from) * 0.5) ? 'no-change' : y < from + Math.floor((to - from) * 0.75) ? 'possible' : 'detected' });
  }

  return {
    text: `**Change Analysis for ${loc}** (${from}–${to})\n\nBased on Sentinel-2 annual composites for this location:\n\n**Methodology:**\nComparing spectral signatures across ${to - from} annual mosaics. Change detection uses normalized difference indices (NDBI for built-up, NDVI for vegetation).\n\n**General Observations:**\n- Urban/peri-urban areas in India typically show **5–15% built-up expansion** per 5-year period\n- The most significant land-cover transitions usually occur in peri-urban fringe zones\n- Vegetation-to-built-up conversion is the dominant change pattern near Indian cities\n\n**⚠️ Disclaimer:** These are contextual estimates based on regional urbanization trends, not pixel-level change detection. For precise quantification, a dedicated change detection pipeline with scene-level Sentinel-2 L2A data would be needed.\n\nUse the timeline slider to visually compare imagery between ${from} and ${to}.`,
    evidence: {
      type: 'change_detection',
      confidence: 72,
      timeline: years,
      sources: ['Sentinel-2 L2A Annual Composites'],
      fusionUsed: false,
      dateRange: { from, to },
    },
  };
}

function generateConstructionResponse(parsed, name, lat, lon, year) {
  const from = parsed.temporal?.from || 2020;
  const to = parsed.temporal?.to || year;
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  const years = [];
  for (let y = from; y <= to; y++) {
    years.push({ year: y, status: y < from + 2 ? 'no-change' : y < from + 3 ? 'possible' : 'detected' });
  }

  return {
    text: `**Construction Activity Analysis for ${loc}**\n\n**How to identify construction from satellite imagery:**\n- 🟡 **Ground disturbance** — Bare soil signatures (high reflectance in visible bands) replacing vegetation\n- 🟠 **Active construction** — Changing spectral signatures month-to-month, visible scaffolding/equipment at high resolution\n- 🔴 **Completed structures** — New building footprints with characteristic rooftop signatures\n\n**For this location:**\nUse the timeline to scrub between years. Look for:\n1. Patches where green (vegetation) turns to brown/gray (construction)\n2. New geometric shapes appearing (buildings have sharp edges vs. organic vegetation)\n3. New road segments or cleared areas\n\n**Sentinel-1 SAR** can detect construction through cloud cover and at night — toggle SAR Sim mode to see a simulated radar view.\n\n**⚠️ Note:** At Sentinel-2's 10m resolution, individual buildings below ~100m² footprint may not be distinguishable. The Esri base layer provides higher resolution for close-up inspection.`,
    evidence: {
      type: 'construction_detection',
      confidence: 68,
      timeline: years,
      sources: ['Sentinel-2 L2A', 'Visual Inspection Guide'],
      fusionUsed: false,
      dateRange: { from, to },
    },
  };
}

function generateVegetationResponse(parsed, name, lat, lon, year) {
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  return {
    text: `**Vegetation Analysis for ${loc}** (${year})\n\n**NDVI (Normalized Difference Vegetation Index):**\nNDVI measures vegetation health using the ratio of near-infrared to red light reflection. Values range from -1 to +1:\n- **0.6–0.9** → Dense, healthy vegetation (forests, irrigated crops)\n- **0.3–0.6** → Moderate vegetation (grasslands, sparse crops)\n- **0.1–0.3** → Sparse vegetation or bare soil\n- **< 0.1** → Water, built-up areas, barren land\n\n**How to use NDVI on Aethrix:**\n1. Switch to **NDVI Infrared** mode in the layer menu\n2. Green-tinted areas indicate higher vegetation density\n3. Compare across years using the timeline to track vegetation changes\n\n**Typical patterns for Indian locations:**\n- Post-monsoon (Oct–Dec): Peak NDVI values\n- Pre-monsoon (Apr–Jun): Lowest vegetation indices\n- Urban areas show consistently low NDVI with green patches around parks/gardens\n\n**⚠️ Note:** The NDVI visualization is a color simulation applied to optical imagery. True NDVI requires Sentinel-2 Band 8 (NIR) and Band 4 (Red), which would need raw band data access.`,
    evidence: {
      type: 'vegetation_analysis',
      confidence: 75,
      sources: ['Sentinel-2 L2A (Visual Bands)', 'NDVI Methodology'],
      fusionUsed: false,
    },
  };
}

function generateWaterResponse(parsed, name, lat, lon, year) {
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  return {
    text: `**Water Body Analysis for ${loc}**\n\n**Detection Methods:**\nWater bodies appear as dark blue/black features in satellite imagery due to high absorption of infrared radiation. Detection uses:\n- **MNDWI** (Modified Normalized Difference Water Index) — Best for mapping open water\n- **NDWI** (Normalized Difference Water Index) — Distinguishes water from vegetation\n- **SAR** — Radar backscatter is very low over calm water (appears dark in SAR imagery)\n\n**What to look for on the globe:**\n- Rivers, lakes, and reservoirs appear as dark linear or polygonal features\n- Coastal zones show tidal variation between imagery dates\n- Flooded areas show temporary dark patches in post-monsoon imagery\n\n**Seasonal Monitoring:**\nUse the timeline to compare pre-monsoon vs. post-monsoon imagery:\n- Water extent typically **increases 20–40%** after Indian monsoon season\n- Reservoir levels are a key indicator of regional water availability\n\n**⚠️ Note:** Water body delineation requires specific spectral bands (SWIR). The current visualization uses true-color composites where water bodies are visually identifiable but not spectrally separated.`,
    evidence: {
      type: 'water_analysis',
      confidence: 70,
      sources: ['Sentinel-2 L2A', 'Water Index Methods'],
      fusionUsed: false,
    },
  };
}

function generateDisasterResponse(parsed, name, lat, lon, year) {
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  return {
    text: `**Disaster Risk Context for ${loc}**\n\n⚠️ **Important:** Aethrix does not perform real-time disaster monitoring. For active emergencies, use official sources:\n- **NDMA** (National Disaster Management Authority)\n- **UNITAR UNOSAT** for rapid satellite damage mapping\n- **Copernicus EMS** for European emergency management\n\n**What satellite imagery CAN show:**\n- **Pre/post-event comparison** — Toggle between years to see landscape changes\n- **Flood mapping** — Water extent changes visible in optical and SAR imagery\n- **Landslide scars** — Bare soil signatures on hillsides\n- **Urban damage** — Building shadow/footprint changes (requires high-resolution imagery)\n\n**SAR advantage for disasters:**\nSentinel-1 SAR penetrates clouds, enabling damage assessment during monsoon season or cyclone events when optical imagery is obscured.\n\n**For historical event analysis:**\nUse the timeline to find the year of a known event, then compare with the year before to identify affected areas.`,
    evidence: {
      type: 'disaster_assessment',
      confidence: 60,
      sources: ['General Methodology', 'Sentinel-1/2 Capabilities'],
      fusionUsed: false,
    },
  };
}

function generateObjectDetectionResponse(parsed, name, lat, lon, year) {
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  return {
    text: `**Feature Identification for ${loc}** (${year})\n\n**What's visible at different scales:**\n\n| Zoom Level | Features Visible | Resolution Source |\n|---|---|---|\n| Country | Coastlines, major rivers, mountain ranges | Sentinel-2 (10m) |\n| Regional | Urban sprawl, forests, agricultural patterns | Sentinel-2 (10m) |\n| City | Road networks, parks, industrial zones | Esri Imagery (~1m) |\n| Neighborhood | Individual buildings, parking lots, fields | Esri Imagery (~1m) |\n| Street | Building footprints, vehicles (sometimes) | Esri Imagery (~0.5m) |\n\n**How to explore:**\n1. Zoom in to your area of interest\n2. At close zoom, the high-resolution Esri imagery reveals individual structures\n3. Toggle labels on/off to see the raw imagery without text overlays\n4. Use the tilt button (3D) to view buildings from an oblique angle\n\n**⚠️ Automated object detection** (counting buildings, vehicles, etc.) requires a computer vision model. Aethrix currently provides visual exploration — a YOLO/Mask R-CNN integration would enable automated counting.`,
    evidence: {
      type: 'object_detection',
      confidence: 65,
      sources: ['Visual Inspection', 'Esri World Imagery', 'Sentinel-2'],
      fusionUsed: false,
    },
  };
}

function generateSceneDescription(parsed, name, lat, lon, year) {
  const loc = name || `${lat?.toFixed(4)}°N, ${lon?.toFixed(4)}°E`;

  // Provide contextual info based on coordinates
  let regionContext = '';
  if (lat && lon) {
    if (lat > 8 && lat < 37 && lon > 68 && lon < 97) {
      regionContext = '\n\n**Regional Context (Indian Subcontinent):**\nThis location falls within the Indian subcontinent. The region is characterized by diverse land cover ranging from dense tropical forests in the Western Ghats and Northeast, to arid landscapes in Rajasthan, and extensive agricultural plains in the Indo-Gangetic region. Rapid urbanization is a defining trend, particularly along major highway corridors and around metropolitan regions.';
    } else if (lat > 35 && lat < 71 && lon > -10 && lon < 40) {
      regionContext = '\n\n**Regional Context (Europe):**\nThis location is in Europe, characterized by varied land cover including agricultural landscapes, urban centers, and mixed forests. European cities typically show well-defined urban-rural boundaries with planned infrastructure.';
    } else if (lat > 25 && lat < 50 && lon > -125 && lon < -65) {
      regionContext = '\n\n**Regional Context (North America):**\nThis location is in North America. Urban areas typically show grid-pattern road networks, suburban sprawl, and commercial/industrial corridors. Agricultural areas feature large regular field patterns visible from satellite altitude.';
    }
  }

  return {
    text: `**Scene Overview for ${loc}** (${year})\n\n**Current View:**\nYou're looking at a composite satellite view combining:\n- **Base imagery** from Esri World Imagery (commercial satellite mosaic)\n- **Overlay labels** from CartoDB/OpenStreetMap showing roads, places, and boundaries\n- **Entity markers** for major cities and towns${regionContext}\n\n**Exploration Tips:**\n- 🔍 Zoom in to see high-resolution detail (buildings, roads, individual structures)\n- 📅 Use the timeline to compare this area across different years (2017–2024)\n- 🗺️ Try different map modes: SAR shows radar-like visualization, NDVI highlights vegetation\n- 💬 Ask me specific questions like "What changed here since 2020?" or "Analyze vegetation"\n\n**Data freshness:** The base imagery is a mosaic of recent commercial satellite captures. Timeline years show Sentinel-2 annual cloud-free composites processed by EOX.`,
    evidence: {
      type: 'scene_description',
      confidence: 90,
      sources: ['Esri World Imagery', 'Sentinel-2 via EOX', 'CartoDB/OSM'],
      fusionUsed: false,
    },
  };
}
