import React, { useState } from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * DrawAnalyze — Draw an AOI on the map and get instant spectral statistics.
 * 
 * When the user has drawn an AOI (point/radius/rectangle/polygon), this
 * component appears with a "Quick Analyze" button that fetches real
 * Earth Engine indices for the selected area.
 */
export default function DrawAnalyze() {
  const { state, dispatch } = useAthreix();
  const { aoi, selectedYear, location } = state;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  if (!aoi.geometry) return null;

  const handleQuickAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    const lat = aoi.center?.lat || location.lat;
    const lon = aoi.center?.lon || location.lon;

    try {
      // Fetch enhanced indices from Earth Engine
      const resp = await fetch('http://127.0.0.1:8000/api/ee/enhanced-indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, year: selectedYear, buffer_m: 3000 }),
      });

      if (!resp.ok) throw new Error('Server error');
      const data = await resp.json();

      if (data.status === 'success') {
        setResults(data);
      } else {
        setError(data.error || 'No data available');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAskOrbital = () => {
    dispatch({ type: 'OPEN_CHAT' });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        role: 'user',
        text: `Analyze changes in this area since 2020. Location: ${location.name || `${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E`}`,
        timestamp: new Date(),
      },
    });
  };

  return (
    <div className="draw-analyze glass-panel-subtle">
      <div className="draw-analyze-header">
        <span className="draw-analyze-title">Quick Analysis</span>
        <span className="draw-analyze-year">{selectedYear}</span>
      </div>

      {!results && !loading && (
        <div className="draw-analyze-actions">
          <button className="draw-analyze-btn primary" onClick={handleQuickAnalyze}>
            📊 Quick Spectral Stats
          </button>
          <button className="draw-analyze-btn secondary" onClick={handleAskOrbital}>
            🛰️ Full ORBITAL Analysis
          </button>
        </div>
      )}

      {loading && (
        <div className="draw-analyze-loading">
          <div className="analyze-spinner" />
          <span>Fetching Earth Engine data...</span>
        </div>
      )}

      {error && (
        <div className="draw-analyze-error">
          {error}
        </div>
      )}

      {results && results.indices && (
        <div className="draw-analyze-results">
          <div className="spectral-grid">
            {Object.entries(results.indices).map(([key, value]) => (
              <div key={key} className="spectral-pill">
                <span className="spectral-name">{key.toUpperCase()}</span>
                <span className={`spectral-value ${getIndexClass(key, value)}`}>
                  {typeof value === 'number' ? value.toFixed(4) : value}
                </span>
              </div>
            ))}
          </div>
          <div className="draw-analyze-meta">
            <span>{results.scene_count} scenes composited</span>
            <span className="draw-analyze-ee-badge">Earth Engine</span>
          </div>
          <button className="draw-analyze-btn secondary" onClick={handleAskOrbital} style={{ marginTop: '8px' }}>
            🛰️ Deep Analysis with ORBITAL
          </button>
        </div>
      )}
    </div>
  );
}

function getIndexClass(key, value) {
  if (key === 'ndvi' || key === 'evi' || key === 'savi') {
    return value > 0.4 ? 'high-veg' : value > 0.2 ? 'mid-veg' : 'low-veg';
  }
  if (key === 'ndwi' || key === 'mndwi') {
    return value > 0.1 ? 'water' : 'dry';
  }
  if (key === 'ndbi') {
    return value > 0.1 ? 'urban' : 'natural';
  }
  return '';
}
