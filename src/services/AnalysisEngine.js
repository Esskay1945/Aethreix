/**
 * AnalysisEngine — Client-side interface to ORBITAL Backend.
 * 
 * IMPORTANT: This module NEVER generates fake analysis results.
 * If the backend is unavailable, it returns an honest error.
 */

const ORBITAL_BACKEND_URL = "http://127.0.0.1:8000/api/orbital/query";
const ORBITAL_MISSION_URL = "http://127.0.0.1:8000/api/mission";

/**
 * Run analysis via the ORBITAL backend.
 * Returns real results from the backend or an honest error.
 */
export async function runAnalysis(query, context) {
  const { location, selectedYear, aoi } = context;

  try {
    const resp = await fetch(ORBITAL_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        location: {
          lat: location.lat,
          lon: location.lon,
          name: location.name || "Target Location",
          cameraAlt: location.cameraAlt || 5000,
        },
        selectedYear: selectedYear || 2024,
        aoi: aoi?.geometry || null,
        image_base64: context.image_base64,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout for real processing
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        text: data.text,
        confidence: data.confidence,
        abstained: data.abstained,
        abstention_reason: data.abstention_reason,
        geojson_mask: data.geojson_mask,
        quantitative_metrics: data.quantitative_metrics,
        transitions: data.transitions,
        sar_verification: data.sar_verification,
        audit_trail: data.audit_trail,
        evidence: data.evidence || {
          type: "orbital_agent",
          confidence: data.confidence,
          abstained: data.abstained,
          sources: data.spectral_sources || [],
          fusionUsed: !!data.sar_verification,
          geojson_mask: data.geojson_mask,
          metrics: data.quantitative_metrics,
          transitions: data.transitions,
          audit_trail: data.audit_trail,
        },
      };
    }

    // Non-OK response — return honest error
    const errText = await resp.text();
    return {
      text: `### ⚠️ Analysis Backend Error\n\nThe ORBITAL backend returned status **${resp.status}**.\n\n\`\`\`\n${errText.slice(0, 500)}\n\`\`\`\n\nPlease ensure the backend server is running: \`python server.py\``,
      evidence: null,
    };
  } catch (err) {
    // Backend unavailable — return honest message (NEVER fake data)
    return {
      text: `### ⚠️ Backend Unavailable\n\nCannot connect to the ORBITAL analysis backend at \`${ORBITAL_BACKEND_URL}\`.\n\n**Reason:** ${err.message}\n\n**To start the backend:**\n\`\`\`bash\ncd ${window.location.pathname}\npython server.py\n\`\`\`\n\nThe system requires the FastAPI backend for real satellite analysis. No simulated results will be shown.`,
      evidence: null,
    };
  }
}

/**
 * Create a mission via the backend.
 */
export async function createMission(query, aoi, location, preferences = {}) {
  try {
    const resp = await fetch(ORBITAL_MISSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        aoi,
        location: {
          lat: location.lat,
          lon: location.lon,
          name: location.name,
        },
        preferences,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      return await resp.json();
    }
    return { error: `Backend returned ${resp.status}` };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Poll mission status.
 */
export async function getMissionStatus(missionId) {
  try {
    const resp = await fetch(`${ORBITAL_MISSION_URL}/${missionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) return await resp.json();
    return null;
  } catch {
    return null;
  }
}
