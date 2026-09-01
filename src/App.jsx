import React from 'react';
import GlobeViewer from './components/GlobeViewer.jsx';
import SearchBar from './components/SearchBar.jsx';
import LocationHUD from './components/LocationHUD.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import NavigationControls from './components/NavigationControls.jsx';
import StreetViewHUD from './components/StreetViewHUD.jsx';

export default function App() {
  return (
    <div className="app-container">
      {/* 3D Round Spherical Globe with Atmosphere, 3D Buildings, City & Road Text Labels */}
      <GlobeViewer />

      {/* Dynamic Search & Fly-to Navigation */}
      <SearchBar />

      {/* Live Heads-Up Display for Position & Elevation */}
      <LocationHUD />

      {/* Interactive Navigation Controls: Zoom +, Zoom -, Tilt 3D, Compass, Map Layers, Street View 360 */}
      <NavigationControls />

      {/* 360° Ground-Truth Street View Panoramic Portal */}
      <StreetViewHUD />

      {/* Historical Temporal Observation Navigator */}
      <TimelinePanel />

      {/* Athreix AI Multimodal Assistant */}
      <ChatPanel />

      {/* Brand Watermark / Identifier */}
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
          <span className="brand-name">AETHRIX</span>
          <span className="brand-version" style={{ marginLeft: '6px' }}>v1.0-EO</span>
        </div>
      </div>
    </div>
  );
}
