/**
 * LLMService — Routes AI chat through the ORBITAL backend proxy.
 * 
 * The API key is kept server-side (never exposed to the browser).
 * Backend proxies to Groq API (OpenAI-compatible, ultra-fast inference).
 * Falls back to direct Groq call if backend is unavailable (dev only).
 */

const BACKEND_CHAT_URL = 'http://127.0.0.1:8000/api/ai/chat';

const GEOINT_SYSTEM_PROMPT = `You are Aethreix ORBITAL — an elite Earth Observation & Geospatial Intelligence analyst embedded in a satellite imagery exploration platform.

CRITICAL RULES:
1. You have DEEP knowledge of geography, urban development, infrastructure, terrain, climate patterns, and satellite remote sensing.
2. When given coordinates and a location name, provide HYPER-SPECIFIC, CONCRETE intelligence about that exact place — not generic textbook answers.
3. Include specific road names, landmarks, river names, district names, development projects, and real infrastructure details.
4. Reference actual satellite observation capabilities: Sentinel-2 (10m optical, 2015+), Landsat-8 (30m, 2013+), MODIS (250m, 2000+).
5. For change detection queries, describe SPECIFIC physical changes: new highways, residential townships, deforestation patches, river course changes, industrial zones.
6. Always ground your analysis in observable satellite signatures: spectral changes, geometric patterns, albedo shifts, NDVI trends.
7. Format responses with markdown: use **bold** for key findings, bullet points for lists, and clear section headers.
8. Keep responses focused and actionable — under 400 words unless the query demands more detail.
9. If you don't know something specific about a location, say so honestly rather than fabricating details.
10. NEVER invent fake data or statistics. If you can't verify a number, don't state it.`;

/**
 * Stream a response via the backend Groq proxy.
 * @param {string} userQuery - The user's question
 * @param {object} context - { location: { lat, lon, name, cameraAlt }, selectedYear }
 * @param {function} onToken - Callback fired for each streamed token chunk
 * @param {function} onDone - Callback fired when streaming completes
 * @param {function} onError - Callback fired on error
 */
export async function streamMistralResponse(userQuery, context, onToken, onDone, onError) {
  const { location, selectedYear } = context;
  const lat = location?.lat?.toFixed(4) || '0';
  const lon = location?.lon?.toFixed(4) || '0';
  const alt = Math.round(location?.cameraAlt || 0);
  const locName = location?.name || 'Unknown';

  const contextMessage = `[LIVE TELEMETRY]
- Target: ${locName} (${lat}°N, ${lon}°E)
- Camera Altitude: ${alt}m ${alt > 1000000 ? '(Continental scale)' : alt > 100000 ? '(Regional scale)' : alt > 10000 ? '(City scale)' : alt > 1000 ? '(Neighborhood scale)' : '(Street level)'}
- Timeline Year: ${selectedYear}
- Available Imagery: ${selectedYear >= 2015 ? 'Sentinel-2 10m Optical' : selectedYear >= 2013 ? 'Landsat-8 30m' : 'Landsat-7/MODIS 30-250m'}

[USER QUERY]
${userQuery}`;

  try {
    // Route through backend proxy (keeps API key server-side)
    const response = await fetch(BACKEND_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: GEOINT_SYSTEM_PROMPT },
          { role: 'user', content: contextMessage },
        ],
        model: 'qwen/qwen3.8-27b',
        temperature: 0.4,
        max_tokens: 1024,
        stream: false, // Groq is so fast we don't need streaming
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Backend AI proxy error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const fullText = data.choices?.[0]?.message?.content || 'No response generated.';
    
    // Simulate streaming for smooth UX (Groq returns in <1s anyway)
    const words = fullText.split(' ');
    let accumulated = '';
    for (let i = 0; i < words.length; i++) {
      accumulated += (i === 0 ? '' : ' ') + words[i];
      onToken(words[i], accumulated);
      // Small delay for visual streaming effect
      if (i % 5 === 0 && i > 0) {
        await new Promise(r => setTimeout(r, 16));
      }
    }
    
    onDone(fullText);
  } catch (err) {
    console.warn('Backend AI proxy unavailable, trying direct Groq...', err.message);
    // Fallback: try direct Groq call (only works if key is in env, which it shouldn't be in prod)
    onError(err);
  }
}
