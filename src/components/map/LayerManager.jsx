import React from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * LayerManager — Controls map layers, analysis overlays, and base map selection.
 */
export default function LayerManager() {
  const { state, dispatch } = useAthreix();
  const { mapType, activeLayers, analysisLayers, layerOpacities } = state;

  const baseMaps = [
    { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
    { id: 'satellite', label: 'Satellite', icon: '🛰️' },
    { id: 'hybrid', label: 'Hybrid', icon: '🌐' },
    { id: 'terrain', label: 'Terrain', icon: '⛰️' },
  ];

  const contextLayers = [
    { id: 'roads', label: 'Roads & Highways', icon: '🛣️' },
    { id: 'labels', label: 'Place Labels', icon: '🏷️' },
    { id: 'boundaries', label: 'Admin Boundaries', icon: '📐' },
    { id: 'transit', label: 'Transit Lines', icon: '🚇' },
    { id: 'traffic', label: 'Traffic', icon: '🚗' },
    { id: 'buildings', label: '3D Buildings', icon: '🏢' },
  ];

  const analysisLayerList = [
    { id: 'ndvi', label: 'NDVI (Vegetation)', icon: '🌿', color: '#4caf50' },
    { id: 'ndwi', label: 'NDWI (Water)', icon: '💧', color: '#2196f3' },
    { id: 'ndbi', label: 'NDBI (Built-up)', icon: '🏗️', color: '#ff5722' },
    { id: 'change', label: 'Change Detection', icon: '🔄', color: '#ff9800' },
    { id: 'water', label: 'Water Mask', icon: '🌊', color: '#0288d1' },
    { id: 'vegetation', label: 'Vegetation Mask', icon: '🌳', color: '#388e3c' },
    { id: 'builtup', label: 'Built-up Mask', icon: '🏙️', color: '#e64a19' },
    { id: 'sar', label: 'SAR Backscatter', icon: '📡', color: '#9c27b0' },
    { id: 'evidence', label: 'Evidence Polygons', icon: '🔍', color: '#00e5ff' },
  ];

  return (
    <div className="layer-manager">
      {/* Base Map Selector */}
      <div className="layer-section">
        <div className="layer-section-title">Base Map</div>
        <div className="basemap-grid">
          {baseMaps.map((bm) => (
            <button
              key={bm.id}
              className={`basemap-btn ${mapType === bm.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MAP_TYPE', payload: bm.id })}
              title={bm.label}
            >
              <span className="basemap-icon">{bm.icon}</span>
              <span className="basemap-label">{bm.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Context Layers */}
      <div className="layer-section">
        <div className="layer-section-title">Context Layers</div>
        {contextLayers.map((layer) => (
          <div key={layer.id} className="layer-item">
            <label className="layer-toggle">
              <input
                type="checkbox"
                checked={activeLayers[layer.id] || false}
                onChange={() =>
                  dispatch({
                    type: 'TOGGLE_LAYER',
                    payload: { category: 'context', layer: layer.id },
                  })
                }
              />
              <span className="layer-icon">{layer.icon}</span>
              <span className="layer-label">{layer.label}</span>
            </label>
          </div>
        ))}
      </div>

      {/* Analysis Overlays */}
      <div className="layer-section">
        <div className="layer-section-title">Analysis Overlays</div>
        {analysisLayerList.map((layer) => (
          <div key={layer.id} className="layer-item">
            <label className="layer-toggle">
              <input
                type="checkbox"
                checked={analysisLayers[layer.id] || false}
                onChange={() =>
                  dispatch({
                    type: 'TOGGLE_LAYER',
                    payload: { category: 'analysis', layer: layer.id },
                  })
                }
              />
              <span
                className="layer-color-dot"
                style={{ background: layer.color }}
              />
              <span className="layer-icon">{layer.icon}</span>
              <span className="layer-label">{layer.label}</span>
            </label>
            {analysisLayers[layer.id] && (
              <input
                type="range"
                className="layer-opacity-slider"
                min="0"
                max="100"
                value={(layerOpacities[layer.id] ?? 1) * 100}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_LAYER_OPACITY',
                    payload: {
                      layer: layer.id,
                      opacity: parseInt(e.target.value) / 100,
                    },
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
