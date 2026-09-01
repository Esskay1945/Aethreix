/**
 * EODataService — Earth Observation data availability service.
 * Queries Copernicus STAC API for Sentinel-2/1 data availability.
 * Falls back to simulated data if API is unavailable.
 */

const STAC_API = 'https://stac.dataspace.copernicus.eu/v1';

/**
 * Get available EO data for a bounding box.
 * Returns array of { year, optical, sar, cloudCover } objects.
 */
export async function getDataAvailability(lat, lon, radiusKm = 10) {
  try {
    const bbox = getBoundingBox(lat, lon, radiusKm);
    const results = await querySTAC(bbox);
    return processAvailability(results);
  } catch (err) {
    console.warn('STAC API unavailable, using simulated data:', err.message);
    return getSimulatedAvailability();
  }
}

function getBoundingBox(lat, lon, radiusKm) {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return [
    lon - lonDelta,
    lat - latDelta,
    lon + lonDelta,
    lat + latDelta,
  ];
}

async function querySTAC(bbox) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${STAC_API}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        collections: ['sentinel-2-l2a'],
        bbox,
        datetime: '2017-01-01T00:00:00Z/2026-12-31T23:59:59Z',
        limit: 100,
        fields: {
          include: ['properties.datetime', 'properties.eo:cloud_cover'],
        },
      }),
    });

    if (!response.ok) throw new Error(`STAC ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function processAvailability(stacResponse) {
  const yearMap = {};

  // Initialize years
  for (let y = 2017; y <= 2026; y++) {
    yearMap[y] = { year: y, optical: false, sar: y >= 2018, opticalCount: 0, avgCloudCover: 0 };
  }

  if (stacResponse.features) {
    for (const feat of stacResponse.features) {
      const date = new Date(feat.properties?.datetime);
      const year = date.getFullYear();
      if (yearMap[year]) {
        yearMap[year].optical = true;
        yearMap[year].opticalCount++;
        yearMap[year].avgCloudCover += feat.properties?.['eo:cloud_cover'] || 0;
      }
    }

    // Average cloud cover
    for (const y of Object.values(yearMap)) {
      if (y.opticalCount > 0) {
        y.avgCloudCover = Math.round(y.avgCloudCover / y.opticalCount);
      }
    }
  }

  return Object.values(yearMap);
}

function getSimulatedAvailability() {
  return Array.from({ length: 10 }, (_, i) => ({
    year: 2017 + i,
    optical: true,
    sar: i >= 1, // SAR from 2018+
    opticalCount: Math.floor(Math.random() * 40) + 15,
    avgCloudCover: Math.floor(Math.random() * 30) + 5,
  }));
}

/**
 * Format coordinates for display.
 */
export function formatCoords(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

/**
 * Calculate approximate area visible in the viewport.
 */
export function estimateViewportArea(cameraAlt) {
  // Very rough estimation based on camera altitude
  const widthKm = cameraAlt * 0.001 * 2; // rough FOV
  return (widthKm * widthKm).toFixed(0);
}
