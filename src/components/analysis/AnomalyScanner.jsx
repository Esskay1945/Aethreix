import React, { useState } from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * AnomalyScanner — Proactively scans for unusual areas (Spec §52)
 * 
 * When activated, sends the current viewport to the backend to scan
 * for anomalies: unexpected vegetation loss, new construction,
 * water body changes, SAR anomalies, etc.
 */
export default function AnomalyScanner() {
  const { state, dispatch } = useAthreix();
  const { location, selectedYear } = state;
  const [scanning, setScanning] = useState(false);
  const [anomalies, setAnomalies] = useState(null);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setAnomalies(null);

    try {
      const resp = await fetch('http://127.0.0.1:8000/api/ee/enhanced-indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lon: location.lon,
          year: selectedYear,
          buffer_m: 5000,
        }),
      });

      if (!resp.ok) throw new Error('Scan failed');
      const data = await resp.json();

      if (data.status === 'success' && data.indices) {
        // Classify anomalies from spectral indices
        const detected = classifyAnomalies(data.indices, selectedYear);
        setAnomalies(detected);
      } else {
        setError('No data available for this area');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAnomalyClick = (anomaly) => {
    dispatch({ type: 'OPEN_CHAT' });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        role: 'user',
        text: `Investigate this anomaly: ${anomaly.description} at ${location.name || `${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E`}`,
        timestamp: new Date(),
      },
    });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className={`anomaly-toggle-btn glass-panel-subtle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Anomaly Scanner — Detect unusual changes"
      >
        🔍
      </button>

      {/* Scanner Panel */}
      {isOpen && (
        <div className="anomaly-scanner glass-panel">
          <div className="anomaly-header">
            <span className="anomaly-title">🔍 Anomaly Scanner</span>
            <button className="anomaly-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="anomaly-description">
            Scans the current area for unusual spectral patterns — vegetation loss, new construction, water changes.
          </div>

          <button
            className="anomaly-scan-btn"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <span className="anomaly-spinner" />
                Scanning...
              </>
            ) : (
              '🛰️ Scan for Anomalies'
            )}
          </button>

          {error && <div className="anomaly-error">{error}</div>}

          {anomalies && (
            <div className="anomaly-results">
              <div className="anomaly-results-header">
                TOP ANOMALIES ({anomalies.length})
              </div>
              {anomalies.map((anomaly, idx) => (
                <div key={idx} className="anomaly-item" onClick={() => handleAnomalyClick(anomaly)}>
                  <div className="anomaly-item-header">
                    <span className="anomaly-severity" style={{ color: anomaly.color }}>
                      {anomaly.icon} {anomaly.severity}%
                    </span>
                    <span className="anomaly-type">{anomaly.type}</span>
                  </div>
                  <div className="anomaly-item-desc">{anomaly.description}</div>
                  <div className="anomaly-item-action">Click to investigate →</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Classify anomalies from spectral indices.
 * Uses thresholds to identify unusual patterns.
 */
function classifyAnomalies(indices, year) {
  const anomalies = [];

  if (indices.ndvi != null && indices.ndvi < 0.15) {
    anomalies.push({
      type: 'Vegetation Loss',
      icon: '🌿',
      severity: Math.round(Math.max(60, 95 - indices.ndvi * 200)),
      color: '#ff5252',
      description: `Very low vegetation index (NDVI: ${indices.ndvi.toFixed(4)}). Possible deforestation, clearing, or drought.`,
    });
  }

  if (indices.ndbi != null && indices.ndbi > 0.1) {
    anomalies.push({
      type: 'Urban Expansion',
      icon: '🏗️',
      severity: Math.round(Math.min(95, 60 + indices.ndbi * 200)),
      color: '#ff9800',
      description: `High built-up index (NDBI: ${indices.ndbi.toFixed(4)}). Active construction or recent urbanization.`,
    });
  }

  if (indices.ndwi != null && indices.ndwi > 0.2) {
    anomalies.push({
      type: 'Water Anomaly',
      icon: '🌊',
      severity: Math.round(Math.min(90, 50 + indices.ndwi * 150)),
      color: '#2196f3',
      description: `Elevated water index (NDWI: ${indices.ndwi.toFixed(4)}). Possible flooding or new water body.`,
    });
  }

  if (indices.nbr != null && indices.nbr < -0.1) {
    anomalies.push({
      type: 'Burn Scar',
      icon: '🔥',
      severity: Math.round(Math.min(95, 70 + Math.abs(indices.nbr) * 100)),
      color: '#e64a19',
      description: `Negative burn ratio (NBR: ${indices.nbr.toFixed(4)}). Possible fire damage or burn scar.`,
    });
  }

  if (anomalies.length === 0) {
    anomalies.push({
      type: 'Normal',
      icon: '✅',
      severity: 5,
      color: '#69f0ae',
      description: 'No significant anomalies detected. Spectral patterns are within normal ranges.',
    });
  }

  // Sort by severity descending
  anomalies.sort((a, b) => b.severity - a.severity);
  return anomalies;
}
