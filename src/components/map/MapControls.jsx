import React from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * MapControls — Unified map control panel.
 * Zoom, compass, tilt, fullscreen, 2D/3D, drawing tools, measurement.
 */
export default function MapControls() {
  const { state, dispatch, triggerCameraAction, clearAOI } = useAthreix();
  const { drawingMode, mapEngine, aoi } = state;

  const drawingTools = [
    { id: 'point', icon: '📍', label: 'Point AOI' },
    { id: 'radius', icon: '⭕', label: 'Radius AOI' },
    { id: 'rectangle', icon: '⬜', label: 'Rectangle AOI' },
    { id: 'polygon', icon: '🔷', label: 'Polygon AOI' },
  ];

  const measureTools = [
    { id: 'measure_distance', icon: '📏', label: 'Measure Distance' },
    { id: 'measure_area', icon: '📐', label: 'Measure Area' },
  ];

  return (
    <div className="map-controls-panel">
      {/* Navigation Controls */}
      <div className="controls-group">
        <button
          className="control-btn"
          onClick={() => triggerCameraAction('zoomIn')}
          title="Zoom In"
          id="zoom-in-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => triggerCameraAction('zoomOut')}
          title="Zoom Out"
          id="zoom-out-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => triggerCameraAction('resetNorth')}
          title="Reset North"
          id="compass-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="12 2 19 21 12 17 5 21" fill="none" />
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => triggerCameraAction('toggleTilt')}
          title="Toggle 3D Tilt"
          id="tilt-btn"
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>3D</span>
        </button>

        <button
          className="control-btn"
          onClick={() => triggerCameraAction('fullscreen')}
          title="Fullscreen"
          id="fullscreen-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div className="controls-separator" />

      {/* Drawing Tools */}
      <div className="controls-group">
        {drawingTools.map((tool) => (
          <button
            key={tool.id}
            className={`control-btn ${drawingMode === tool.id ? 'active' : ''}`}
            onClick={() => {
              dispatch({
                type: 'SET_DRAWING_MODE',
                payload: drawingMode === tool.id ? null : tool.id,
              });
            }}
            title={tool.label}
          >
            <span style={{ fontSize: '14px' }}>{tool.icon}</span>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="controls-separator" />

      {/* Measurement Tools */}
      <div className="controls-group">
        {measureTools.map((tool) => (
          <button
            key={tool.id}
            className={`control-btn ${drawingMode === tool.id ? 'active' : ''}`}
            onClick={() => {
              dispatch({
                type: 'SET_DRAWING_MODE',
                payload: drawingMode === tool.id ? null : tool.id,
              });
            }}
            title={tool.label}
          >
            <span style={{ fontSize: '14px' }}>{tool.icon}</span>
          </button>
        ))}
      </div>

      {/* Clear Actions */}
      {(aoi.geometry || drawingMode) && (
        <>
          <div className="controls-separator" />
          <div className="controls-group">
            <button
              className="control-btn danger"
              onClick={() => {
                clearAOI();
                dispatch({ type: 'CLEAR_MEASUREMENTS' });
              }}
              title="Clear All Drawings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* AOI Info Badge */}
      {aoi.geometry && (
        <div className="aoi-info-badge">
          <span className="aoi-badge-type">{aoi.type?.toUpperCase()}</span>
          {aoi.area > 0 && (
            <span className="aoi-badge-area">
              {formatAreaBadge(aoi.area)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatAreaBadge(sqMeters) {
  if (sqMeters < 10000) return `${Math.round(sqMeters)} m²`;
  if (sqMeters < 1000000) return `${(sqMeters / 10000).toFixed(1)} ha`;
  return `${(sqMeters / 1000000).toFixed(2)} km²`;
}
