import React, { useState } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

const POPULAR_HUBS = [
  { name: 'Titwala Station Road', lat: 19.2982, lon: 73.2064 },
  { name: 'Kalyan Station West', lat: 19.2437, lon: 73.1256 },
  { name: 'Marine Drive, Mumbai', lat: 18.9431, lon: 72.8230 },
  { name: 'Connaught Place, Delhi', lat: 28.6315, lon: 77.2167 },
  { name: 'Times Square, NYC', lat: 40.7580, lon: -73.9855 },
  { name: 'Shibuya Crossing, Tokyo', lat: 35.6595, lon: 139.7004 },
];

export default function StreetViewHUD() {
  const { state, dispatch, flyTo } = useAthreix();
  const { streetViewOpen, streetViewTarget, location } = state;

  const [isMaximized, setIsMaximized] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const targetLat = streetViewTarget?.lat ?? location.lat;
  const targetLon = streetViewTarget?.lon ?? location.lon;
  const targetName = streetViewTarget?.name || location.name || 'Target Coordinate';

  if (!streetViewOpen) return null;

  // Google Street View interactive 360 panorama URL
  // Uses Google's official svembed engine (no JS API activation block or auth alert)
  const embedUrl = `https://www.google.com/maps?layer=c&cbll=${targetLat},${targetLon}&cbp=12,165,,0,0&output=svembed`;

  return (
    <div className={`streetview-portal glass-panel ${isMaximized ? 'maximized' : ''}`}>
      {/* Header Bar */}
      <div className="streetview-header">
        <div className="streetview-title-group">
          <span className="streetview-badge">📸 360° Ground Truth</span>
          <span className="streetview-location-name">
            {targetName}
          </span>
        </div>

        <div className="streetview-controls-right">
          <a
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${targetLat},${targetLon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="streetview-action-btn"
            title="Open in Full Google Maps / Earth App"
          >
            ↗ External
          </a>
          <button
            className="streetview-action-btn"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore View' : 'Maximize Split View'}
          >
            {isMaximized ? '🗗' : '🗖'}
          </button>
          <button
            className="streetview-close-btn"
            onClick={() => dispatch({ type: 'CLOSE_STREET_VIEW' })}
            title="Close Street View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Street View 360 WebGL Container */}
      <div className="streetview-canvas-wrapper">
        <iframe
          key={`${targetLat}-${targetLon}`}
          title="Google Street View 360 Panorama"
          src={embedUrl}
          className="streetview-canvas"
          style={{ border: 'none', width: '100%', height: '100%' }}
          allowFullScreen
          loading="lazy"
          onLoad={() => setIframeLoading(false)}
        />

        {iframeLoading && (
          <div className="streetview-overlay">
            <div className="search-spinner" />
            <span>Scanning 360° ground telemetry...</span>
          </div>
        )}
      </div>

      {/* Telemetry & Quick-Jump Hubs Footer */}
      <div className="streetview-footer">
        <span>Lat: {targetLat.toFixed(4)}° • Lon: {targetLon.toFixed(4)}°</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {POPULAR_HUBS.slice(0, 3).map((hub, idx) => (
            <button
              key={idx}
              className="streetview-hub-chip"
              style={{ fontSize: '9px', padding: '2px 6px' }}
              onClick={() => {
                setIframeLoading(true);
                flyTo(hub.lat, hub.lon, hub.name);
                dispatch({ type: 'OPEN_STREET_VIEW', payload: hub });
              }}
            >
              📍 {hub.name.split(',')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
