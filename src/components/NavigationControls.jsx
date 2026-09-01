import React, { useState } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

export default function NavigationControls() {
  const { state, dispatch, triggerCameraAction } = useAthreix();
  const { labelsEnabled, roadsEnabled, mapMode } = state;
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  return (
    <div className="nav-controls-container">
      {/* Layer Settings Menu Modal */}
      {showLayerMenu && (
        <div className="layer-menu glass-panel">
          <div className="layer-menu-header">
            <span>Map Layers & Labels</span>
            <button
              className="layer-close-btn"
              onClick={() => setShowLayerMenu(false)}
            >
              ✕
            </button>
          </div>

          <div className="layer-options">
            <div className="layer-option-group">
              <span className="layer-group-title">Display Mode</span>
              <div className="layer-mode-buttons">
                <button
                  className={`layer-mode-btn ${mapMode === 'hybrid' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_MAP_MODE', payload: 'hybrid' })}
                >
                  🛰️ Hybrid
                </button>
                <button
                  className={`layer-mode-btn ${mapMode === 'satellite' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_MAP_MODE', payload: 'satellite' })}
                >
                  🌍 Satellite
                </button>
                <button
                  className={`layer-mode-btn ${mapMode === 'sar' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_MAP_MODE', payload: 'sar' })}
                >
                  📡 SAR Sim
                </button>
                <button
                  className={`layer-mode-btn ${mapMode === 'ndvi' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_MAP_MODE', payload: 'ndvi' })}
                >
                  🌿 NDVI Infrared
                </button>
              </div>
            </div>

            <div className="layer-toggle-row">
              <label className="toggle-label">
                <span>🏙️ City & Town Names</span>
                <input
                  type="checkbox"
                  checked={labelsEnabled}
                  onChange={() => dispatch({ type: 'TOGGLE_LABELS' })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="layer-toggle-row">
              <label className="toggle-label">
                <span>🛣️ Roads & Highways</span>
                <input
                  type="checkbox"
                  checked={roadsEnabled}
                  onChange={() => dispatch({ type: 'TOGGLE_ROADS' })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="nav-btn-group glass-panel">
        {/* Layer Selector Button */}
        <button
          className={`nav-btn ${showLayerMenu ? 'active' : ''}`}
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Map Layers, Roads & City Labels"
          id="nav-layers-btn"
        >
          🗺️
        </button>

        {/* Street View 360° Ground Truth */}
        <button
          className={`nav-btn ${state.streetViewOpen ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_STREET_VIEW' })}
          title="Toggle 360° Street View Ground Truth"
          id="nav-streetview-btn"
        >
          📸
        </button>

        <div className="nav-divider" />

        {/* Compass / Reset North */}
        <button
          className="nav-btn"
          onClick={() => triggerCameraAction('resetNorth')}
          title="Reset Camera to True North"
          id="nav-compass-btn"
        >
          🧭
        </button>

        {/* 2D / 3D Tilt Toggle */}
        <button
          className="nav-btn"
          onClick={() => triggerCameraAction('toggleTilt')}
          title="Toggle 2D Overhead / 3D Perspective Tilt"
          id="nav-tilt-btn"
        >
          <span className="nav-btn-text">3D</span>
        </button>

        <div className="nav-divider" />

        {/* Zoom In */}
        <button
          className="nav-btn"
          onClick={() => triggerCameraAction('zoomIn')}
          title="Zoom In (+)"
          id="nav-zoomin-btn"
        >
          ➕
        </button>

        {/* Zoom Out */}
        <button
          className="nav-btn"
          onClick={() => triggerCameraAction('zoomOut')}
          title="Zoom Out (-)"
          id="nav-zoomout-btn"
        >
          ➖
        </button>
      </div>
    </div>
  );
}
