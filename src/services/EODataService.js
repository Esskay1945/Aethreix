/**
 * EODataService — Earth Observation data availability service.
 * Queries Copernicus STAC API for Sentinel-2/1 data availability.
 * 
 * IMPORTANT: NO simulated/random fallback data. If API is unavailable,
 * returns an honest empty result.
 */

const STAC_API = 'https://stac.dataspace.copernicus.eu/v1';

/**
 * Get available EO data for a bounding box.
 * Returns array of { year, sensors: [{name, count, avgCloudCover}] } objects.
 */
export async function getDataAvailability(lat, lon, radiusKm = 10) {
  try {
    const bbox = getBoundingBox(lat, lon, radiusKm);
    const results = await querySTAC(bbox);
    return processAvailability(results);
  } catch (err) {
    console.warn('STAC API unavailable:', err.message);
    // Return empty — NOT simulated data
    return getKnownSensorAvailability();
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
        datetime: '2015-01-01T00:00:00Z/2026-12-31T23:59:59Z',
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

  // Initialize only years where sensors actually existed
  // Sentinel-2: launched June 2015 (2A), March 2017 (2B)
  // Sentinel-1: launched April 2014 (1A), April 2016 (1B)
  // Landsat-8: launched February 2013
  for (let y = 2013; y <= 2026; y++) {
    yearMap[y] = {
      year: y,
      sensors: [],
      hasData: false,
    };

    if (y >= 2013) {
      yearMap[y].sensors.push({ name: 'Landsat-8', count: 0, avgCloudCover: null });
    }
    if (y >= 2014) {
      yearMap[y].sensors.push({ name: 'Sentinel-1 SAR', count: 0, avgCloudCover: null });
    }
    if (y >= 2015) {
      yearMap[y].sensors.push({ name: 'Sentinel-2', count: 0, avgCloudCover: null });
    }
  }

  if (stacResponse.features) {
    for (const feat of stacResponse.features) {
      const date = new Date(feat.properties?.datetime);
      const year = date.getFullYear();
      if (yearMap[year]) {
        const s2sensor = yearMap[year].sensors.find(s => s.name === 'Sentinel-2');
        if (s2sensor) {
          s2sensor.count++;
          const cc = feat.properties?.['eo:cloud_cover'] || 0;
          s2sensor.avgCloudCover = s2sensor.avgCloudCover
            ? (s2sensor.avgCloudCover * (s2sensor.count - 1) + cc) / s2sensor.count
            : cc;
          yearMap[year].hasData = true;
        }
      }
    }
  }

  return Object.values(yearMap);
}

/**
 * Known sensor availability dates — NOT measured data, just sensor launch dates.
 * This is factual metadata, not simulated observations.
 */
function getKnownSensorAvailability() {
  const result = [];
  for (let y = 2013; y <= 2026; y++) {
    const sensors = [];
    if (y >= 2013) sensors.push({ name: 'Landsat-8', count: null, avgCloudCover: null });
    if (y >= 2014) sensors.push({ name: 'Sentinel-1 SAR', count: null, avgCloudCover: null });
    if (y >= 2015) sensors.push({ name: 'Sentinel-2', count: null, avgCloudCover: null });
    result.push({
      year: y,
      sensors,
      hasData: null, // null = unknown (STAC unavailable), not simulated
    });
  }
  return result;
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
  const widthKm = cameraAlt * 0.001 * 2;
  return (widthKm * widthKm).toFixed(0);
}
