import React, { lazy, Suspense } from 'react';
import GoogleMapViewer from './components/GoogleMapViewer.jsx';
import SearchBar from './components/SearchBar.jsx';
import LocationHUD from './components/LocationHUD.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import MapControls from './components/map/MapControls.jsx';
import LayerManager from './components/map/LayerManager.jsx';
import MissionTracker from './components/mission/MissionTracker.jsx';
import StreetViewHUD from './components/StreetViewHUD.jsx';
import DrawAnalyze from './components/analysis/DrawAnalyze.jsx';
import AnomalyScanner from './components/analysis/AnomalyScanner.jsx';
import ReportGenerator from './components/reports/ReportGenerator.jsx';
import TemporalCompare from './components/temporal/TemporalCompare.jsx';
import { useAthreix } from './context/AthreixContext.jsx';

// Cesium is lazy-loaded — only when user explicitly requests 3D
const GlobeViewer = lazy(() => import('./components/GlobeViewer.jsx'));

export default function App() {
  const { state, dispatch } = useAthreix();
  const { mapEngine, leftPanelOpen, rightPanelOpen, leftPanelTab, rightPanelTab, activeMission } = state;

  return (
    <div className="app-container">
      {/* ═══════════════════════════════════════════════════════════════════
          PRIMARY MAP RENDERER
          Google Maps = fast 2D navigation + context
          Cesium = on-demand 3D (lazy loaded)
      ═══════════════════════════════════════════════════════════════════ */}
      {mapEngine === 'cesium' ? (
        <Suspense fallback={<div className="globe-loading">Loading 3D Globe...</div>}>
          <GlobeViewer />
        </Suspense>
      ) : (
        <GoogleMapViewer />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TOP: Search / Mission Bar
      ═══════════════════════════════════════════════════════════════════ */}
      <SearchBar />

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT: Location / Layers / AOI Panel
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={`left-panel glass-panel ${leftPanelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-tabs">
          <button
            className={`panel-tab ${leftPanelTab === 'layers' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', payload: 'layers' })}
            title="Map Layers"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Layers</span>
          </button>
          <button
            className={`panel-tab ${leftPanelTab === 'aoi' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LEFT_PANEL_TAB', payload: 'aoi' })}
            title="Area of Interest"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="22" y1="12" x2="18" y2="12" />
              <line x1="6" y1="12" x2="2" y2="12" />
              <line x1="12" y1="6" x2="12" y2="2" />
              <line x1="12" y1="22" x2="12" y2="18" />
            </svg>
            <span>AOI</span>
          </button>
        </div>

        <div className="panel-content">
          {leftPanelTab === 'layers' && <LayerManager />}
          {leftPanelTab === 'aoi' && <AOIPanel />}
        </div>
      </div>

      {/* Left panel toggle */}
      <button
        className={`panel-toggle left-toggle ${leftPanelOpen ? 'open' : ''}`}
        onClick={() => dispatch({ type: 'TOGGLE_LEFT_PANEL' })}
        title={leftPanelOpen ? 'Hide Panel' : 'Show Layers'}
      >
        {leftPanelOpen ? '‹' : '›'}
      </button>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT: Map Controls (always visible)
      ═══════════════════════════════════════════════════════════════════ */}
      <MapControls />

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT: Chat / Evidence / Mission Panel
      ═══════════════════════════════════════════════════════════════════ */}
      <ChatPanel />

      {/* ═══════════════════════════════════════════════════════════════════
          MISSION TRACKER (shown when a mission is active)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeMission && <MissionTracker />}

      {/* ═══════════════════════════════════════════════════════════════════
          DRAW-TO-ANALYZE (shown when AOI is drawn)
      ═══════════════════════════════════════════════════════════════════ */}
      <DrawAnalyze />

      {/* ═══════════════════════════════════════════════════════════════════
          HUD & Street View
      ═══════════════════════════════════════════════════════════════════ */}
      <LocationHUD />
      <StreetViewHUD />

      {/* ═══════════════════════════════════════════════════════════════════
          REPORT EXPORT (shown when analysis results are available)
      ═══════════════════════════════════════════════════════════════════ */}
      <ReportGenerator />

      {/* ═══════════════════════════════════════════════════════════════════
          TEMPORAL COMPARISON (swipe/flicker/side-by-side)
      ═══════════════════════════════════════════════════════════════════ */}
      <TemporalCompare />

      {/* ═══════════════════════════════════════════════════════════════════
          ANOMALY SCANNER
      ═══════════════════════════════════════════════════════════════════ */}
      <AnomalyScanner />

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM: Timeline
      ═══════════════════════════════════════════════════════════════════ */}
      <TimelinePanel />

      {/* ═══════════════════════════════════════════════════════════════════
          BRAND WATERMARK
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="brand-mark glass-panel-subtle">
        <svg
          className="brand-logo"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="13" stroke="url(#brandGrad)" strokeWidth="2" />
          <ellipse
            cx="16"
            cy="16"
            rx="13"
            ry="5.5"
            stroke="url(#brandGrad)"
            strokeWidth="1.5"
            transform="rotate(-25 16 16)"
          />
          <circle cx="16" cy="16" r="3" fill="url(#brandGrad)" />
          <defs>
            <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00e5ff" />
              <stop offset="1" stopColor="#7c4dff" />
            </linearGradient>
          </defs>
        </svg>
        <div>
          <span className="brand-name">AETHREIX</span>
          <span className="brand-version" style={{ marginLeft: '6px' }}>ORBITAL</span>
        </div>
      </div>
    </div>
  );
}

/**
 * AOI Panel — Shows current AOI info and drawing controls.
 */
function AOIPanel() {
  const { state, dispatch, clearAOI, setDrawingMode } = useAthreix();
  const { aoi, drawingMode } = state;

  return (
    <div className="aoi-panel">
      <div className="aoi-panel-header">
        <h4>Area of Interest</h4>
        {aoi.geometry && (
          <button className="aoi-clear-btn" onClick={clearAOI} title="Clear AOI">
            ✕
          </button>
        )}
      </div>

      {!aoi.geometry ? (
        <div className="aoi-empty-state">
          <p>Define an area to analyze. Draw on the map or right-click for quick AOI options.</p>
          <div className="aoi-draw-buttons">
            <button
              className={`aoi-draw-btn ${drawingMode === 'point' ? 'active' : ''}`}
              onClick={() => setDrawingMode(drawingMode === 'point' ? null : 'point')}
            >
              📍 Point
            </button>
            <button
              className={`aoi-draw-btn ${drawingMode === 'radius' ? 'active' : ''}`}
              onClick={() => setDrawingMode(drawingMode === 'radius' ? null : 'radius')}
            >
              ⭕ Radius
            </button>
            <button
              className={`aoi-draw-btn ${drawingMode === 'rectangle' ? 'active' : ''}`}
              onClick={() => setDrawingMode(drawingMode === 'rectangle' ? null : 'rectangle')}
            >
              ⬜ Rectangle
            </button>
            <button
              className={`aoi-draw-btn ${drawingMode === 'polygon' ? 'active' : ''}`}
              onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
            >
              🔷 Polygon
            </button>
          </div>
        </div>
      ) : (
        <div className="aoi-info">
          <div className="aoi-info-row">
            <span className="aoi-info-label">Type</span>
            <span className="aoi-info-value">{aoi.type?.toUpperCase()}</span>
          </div>
          {aoi.center && (
            <div className="aoi-info-row">
              <span className="aoi-info-label">Center</span>
              <span className="aoi-info-value">
                {aoi.center.lat?.toFixed(4)}°N, {aoi.center.lon?.toFixed(4)}°E
              </span>
            </div>
          )}
          {aoi.area > 0 && (
            <div className="aoi-info-row">
              <span className="aoi-info-label">Area</span>
              <span className="aoi-info-value">{formatArea(aoi.area)}</span>
            </div>
          )}
          {aoi.perimeter > 0 && (
            <div className="aoi-info-row">
              <span className="aoi-info-label">Perimeter</span>
              <span className="aoi-info-value">{formatLength(aoi.perimeter)}</span>
            </div>
          )}

          <button
            className="aoi-analyze-btn"
            onClick={() => {
              dispatch({ type: 'OPEN_CHAT' });
              dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                  id: Date.now(),
                  role: 'user',
                  text: 'What changed in this area since 2020?',
                  timestamp: new Date(),
                },
              });
            }}
          >
            🔍 Analyze This Area
          </button>
        </div>
      )}
    </div>
  );
}

function formatArea(sqMeters) {
  if (sqMeters < 10000) return `${Math.round(sqMeters)} m²`;
  if (sqMeters < 1000000) return `${(sqMeters / 10000).toFixed(1)} ha`;
  return `${(sqMeters / 1000000).toFixed(2)} km²`;
}

function formatLength(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
