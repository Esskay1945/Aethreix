/**
 * MistralService — Connects to Mistral AI API for real-time GEOINT analysis.
 * Streams responses token-by-token for fluid UX.
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

const GEOINT_SYSTEM_PROMPT = `You are Aethrix GEOINT AI — an elite Earth Observation & Geospatial Intelligence analyst embedded in a satellite imagery exploration platform.

CRITICAL RULES:
1. You have DEEP knowledge of geography, urban development, infrastructure, terrain, climate patterns, and satellite remote sensing.
2. When given coordinates and a location name, provide HYPER-SPECIFIC, CONCRETE intelligence about that exact place — not generic textbook answers.
3. Include specific road names, landmarks, river names, district names, development projects, and real infrastructure details.
4. Reference actual satellite observation capabilities: Sentinel-2 (10m optical, 2017+), Landsat (30m, 2005+), MODIS (250m, 2000+).
5. For change detection queries, describe SPECIFIC physical changes: new highways, residential townships, deforestation patches, river course changes, industrial zones.
6. Always ground your analysis in observable satellite signatures: spectral changes, geometric patterns, albedo shifts, NDVI trends.
7. Format responses with markdown: use **bold** for key findings, bullet points for lists, and clear section headers.
8. Keep responses focused and actionable — under 400 words unless the query demands more detail.
9. If you don't know something specific about a location, say so honestly rather than fabricating details.`;

/**
 * Stream a response from Mistral API with geospatial context injection.
 * @param {string} userQuery - The user's question
 * @param {object} context - { location: { lat, lon, name, cameraAlt }, selectedYear }
 * @param {function} onToken - Callback fired for each streamed token chunk
 * @param {function} onDone - Callback fired when streaming completes
 * @param {function} onError - Callback fired on error
 */
export async function streamMistralResponse(userQuery, context, onToken, onDone, onError) {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  
  if (!apiKey) {
    onError(new Error('Mistral API key not configured. Add VITE_MISTRAL_API_KEY to .env'));
    return;
  }

  const { location, selectedYear } = context;
  const lat = location?.lat?.toFixed(4) || '0';
  const lon = location?.lon?.toFixed(4) || '0';
  const alt = Math.round(location?.cameraAlt || 0);
  const locName = location?.name || 'Unknown';

  // Inject live telemetry into context message
  const contextMessage = `[LIVE TELEMETRY]
- Target: ${locName} (${lat}°N, ${lon}°E)
- Camera Altitude: ${alt}m ${alt > 1000000 ? '(Continental scale)' : alt > 100000 ? '(Regional scale)' : alt > 10000 ? '(City scale)' : alt > 1000 ? '(Neighborhood scale)' : '(Street level)'}
- Timeline Year: ${selectedYear}
- Available Imagery: ${selectedYear >= 2017 ? 'Sentinel-2 10m Optical + Esri Hi-Res' : selectedYear >= 2013 ? 'Landsat-8 30m' : 'Landsat-7/MODIS 30-250m'}

[USER QUERY]
${userQuery}`;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: GEOINT_SYSTEM_PROMPT },
          { role: 'user', content: contextMessage },
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.4, // Low temperature for factual, grounded responses
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Mistral API error (${response.status}): ${errBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onToken(content, fullText);
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }

    onDone(fullText);
  } catch (err) {
    console.error('Mistral streaming error:', err);
    onError(err);
  }
}
