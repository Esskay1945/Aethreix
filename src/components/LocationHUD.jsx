import React from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';
import { formatCoords } from '../services/EODataService.js';

export default function LocationHUD() {
  const { state } = useAthreix();
  const { lat, lon, elevation, cameraAlt, name } = state.location;

  const formatAltitude = (alt) => {
    if (alt > 1000000) return `${(alt / 1000000).toFixed(1)}M m`;
    if (alt > 1000) return `${(alt / 1000).toFixed(1)} km`;
    return `${alt.toFixed(0)} m`;
  };

  return (
    <div className="location-hud glass-panel-subtle">
      <div className="hud-content">
        <div className="hud-title">
          <span className="status-dot"></span>
          {name || 'Exploring'}
        </div>

        <div className="hud-row">
          <span className="hud-label">LAT</span>
          <span className="hud-value">{lat.toFixed(4)}°</span>
        </div>

        <div className="hud-row">
          <span className="hud-label">LON</span>
          <span className="hud-value">{lon.toFixed(4)}°</span>
        </div>

        <div className="hud-row">
          <span className="hud-label">ALT</span>
          <span className="hud-value">{formatAltitude(cameraAlt)}</span>
        </div>

        {elevation > 0 && (
          <div className="hud-row">
            <span className="hud-label">ELEV</span>
            <span className="hud-value">{elevation.toFixed(0)} m</span>
          </div>
        )}
      </div>
    </div>
  );
}
