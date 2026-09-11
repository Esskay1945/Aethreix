/**
 * MissionService — SSE client for real-time mission streaming.
 * 
 * Connects to /api/mission/{id}/stream and dispatches live progress
 * events into the Athreix context via provided callbacks.
 */

const API_BASE = 'http://127.0.0.1:8000';

/**
 * Creates a mission on the backend and returns the mission object.
 */
export async function createMission(query, location, aoi = null) {
  const resp = await fetch(`${API_BASE}/api/mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, location, aoi }),
  });
  if (!resp.ok) throw new Error(`Mission creation failed: ${resp.status}`);
  return resp.json();
}

/**
 * Streams mission progress via SSE.
 * 
 * @param {string} missionId - The mission ID to stream
 * @param {object} callbacks - Event handlers:
 *   - onStepStart(data)    — a specialist step has begun
 *   - onStepDone(data)     — a specialist step completed
 *   - onProgress(pct)      — progress percentage updated
 *   - onComplete(result)   — mission finished with full result
 *   - onError(error)       — connection or processing error
 * @returns {function} cleanup — call to close the SSE connection
 */
export function streamMission(missionId, callbacks) {
  const {
    onStepStart = () => {},
    onStepDone = () => {},
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
  } = callbacks;

  const eventSource = new EventSource(`${API_BASE}/api/mission/${missionId}/stream`);

  eventSource.addEventListener('mission_start', (e) => {
    const data = JSON.parse(e.data);
    onStepStart({ step: 'mission_start', name: `Mission started: ${data.query}`, progress: 0 });
  });

  eventSource.addEventListener('step_start', (e) => {
    const data = JSON.parse(e.data);
    onStepStart(data);
    if (data.progress != null) onProgress(data.progress);
  });

  eventSource.addEventListener('step_done', (e) => {
    const data = JSON.parse(e.data);
    onStepDone(data);
    if (data.progress != null) onProgress(data.progress);
  });

  eventSource.addEventListener('mission_complete', (e) => {
    const data = JSON.parse(e.data);
    onComplete(data);
    onProgress(100);
    eventSource.close();
  });

  eventSource.onerror = (err) => {
    onError(err);
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

/**
 * Fetch EE tile URL for a given layer type.
 */
export async function fetchEETileUrl(lat, lon, year, layerType = 'ndvi') {
  const resp = await fetch(`${API_BASE}/api/ee/tiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, year, layer_type: layerType }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.status === 'success' ? data.tile_url : null;
}

/**
 * Fetch enhanced spectral indices (8 indices) from Earth Engine.
 */
export async function fetchEnhancedIndices(lat, lon, year) {
  const resp = await fetch(`${API_BASE}/api/ee/enhanced-indices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, year }),
  });
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * One-shot mission: create + stream + return results.
 * This is the main entry point for the ChatPanel.
 */
export async function executeMission(query, location, aoi, callbacks) {
  try {
    const mission = await createMission(query, location, aoi);
    const cleanup = streamMission(mission.id, callbacks);
    return { missionId: mission.id, cleanup };
  } catch (err) {
    callbacks.onError?.(err);
    return null;
  }
}
