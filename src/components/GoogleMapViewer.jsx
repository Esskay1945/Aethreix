import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

/**
 * GoogleMapViewer — Primary Map Renderer
 * 
 * This is the main navigation/context layer. All hard-coded fake analysis zones
 * have been removed. Real analysis overlays come from the backend as GeoJSON.
 */
export default function GoogleMapViewer() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletMapRef = useRef(null);
  const overlaysRef = useRef([]); // Real GeoJSON overlays from backend
  const drawingManagerRef = useRef(null);
  const drawnShapesRef = useRef([]);
  const measureMarkersRef = useRef([]);
  const measurePolylineRef = useRef(null);
  const aoiShapeRef = useRef(null);

  const [engineType, setEngineType] = useState('google');
  const [activeFeatureInfo, setActiveFeatureInfo] = useState(null);
  const [currentTilt, setCurrentTilt] = useState(45);
  const [contextMenu, setContextMenu] = useState(null);

  const { state, dispatch, setAOI, clearAOI } = useAthreix();
  const {
    flyToTrigger,
    cameraAction,
    mapType,
    activeLayers,
    analysisLayers,
    location,
    activeChangeMaskGeoJSON,
    showChangeMask,
    drawingMode,
    aoi,
  } = state;

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT: Google Maps with Leaflet fallback
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initGoogleMap = () => {
      try {
        if (!window.google || !window.google.maps) {
          throw new Error('Google Maps script not ready');
        }

        const initialCenter = { lat: 20.5937, lng: 78.9629 }; // India

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 5,
          tilt: 0,
          heading: 0,
          mapTypeId: 'hybrid',
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          ],
        });

        mapInstanceRef.current = map;
        setEngineType('google');

        // Track camera position
        map.addListener('center_changed', () => {
          const center = map.getCenter();
          if (center) {
            const zoom = map.getZoom();
            const alt = Math.round(40000000 / Math.pow(2, zoom));
            dispatch({
              type: 'SET_LOCATION',
              payload: {
                lat: center.lat(),
                lon: center.lng(),
                cameraAlt: alt,
              },
            });
          }
        });

        // Left click — set location
        map.addListener('click', (e) => {
          setContextMenu(null);
          if (e.latLng) {
            dispatch({
              type: 'SET_LOCATION',
              payload: {
                lat: e.latLng.lat(),
                lon: e.latLng.lng(),
              },
            });
          }
        });

        // Right click — context menu with reverse geocode
        map.addListener('rightclick', (e) => {
          if (e.latLng) {
            setContextMenu({
              x: e.domEvent.clientX,
              y: e.domEvent.clientY,
              lat: e.latLng.lat(),
              lon: e.latLng.lng(),
            });
          }
        });

      } catch (err) {
        console.warn('Google Maps fallback to Leaflet:', err);
        initLeafletFallback();
      }
    };

    const initLeafletFallback = () => {
      if (!window.L || !mapContainerRef.current) return;

      mapContainerRef.current.innerHTML = '';

      const lmap = window.L.map(mapContainerRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
      });

      const satelliteLayer = window.L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(lmap);

      const labelsLayer = window.L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        { subdomains: 'abcd', maxZoom: 19, opacity: 0.95 }
      ).addTo(lmap);

      const roadsLayer = window.L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(lmap);

      leafletMapRef.current = {
        map: lmap,
        satelliteLayer,
        labelsLayer,
        roadsLayer,
        vectorLayers: [],
      };

      setEngineType('leaflet');

      lmap.on('move', () => {
        const center = lmap.getCenter();
        const zoom = lmap.getZoom();
        const alt = Math.round(40000000 / Math.pow(2, zoom));
        dispatch({
          type: 'SET_LOCATION',
          payload: {
            lat: center.lat,
            lon: center.lng,
            cameraAlt: alt,
          },
        });
      });
    };

    window.gm_authFailure = () => {
      initLeafletFallback();
    };

    if (window.google?.maps) {
      initGoogleMap();
    } else {
      const timer = setTimeout(() => {
        if (window.google?.maps) {
          initGoogleMap();
        } else {
          initLeafletFallback();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dispatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!cameraAction) return;

    if (engineType === 'google' && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      switch (cameraAction.action) {
        case 'zoomIn':
          map.setZoom(map.getZoom() + 1);
          break;
        case 'zoomOut':
          map.setZoom(map.getZoom() - 1);
          break;
        case 'toggleTilt': {
          const nextTilt = currentTilt === 45 ? 0 : 45;
          map.setTilt(nextTilt);
          setCurrentTilt(nextTilt);
          break;
        }
        case 'resetNorth':
          map.setHeading(0);
          break;
        case 'fullscreen': {
          const el = mapContainerRef.current;
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            el?.requestFullscreen();
          }
          break;
        }
        default:
          break;
      }
    } else if (engineType === 'leaflet' && leafletMapRef.current) {
      const lmap = leafletMapRef.current.map;
      switch (cameraAction.action) {
        case 'zoomIn':
          lmap.zoomIn();
          break;
        case 'zoomOut':
          lmap.zoomOut();
          break;
        default:
          break;
      }
    }
  }, [cameraAction, engineType, currentTilt]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLY TO
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!flyToTrigger) return;
    const { lat, lon } = flyToTrigger;

    if (engineType === 'google' && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.panTo({ lat, lng: lon });
      map.setZoom(16);
      map.setTilt(45);
    } else if (engineType === 'leaflet' && leafletMapRef.current) {
      const lmap = leafletMapRef.current.map;
      lmap.flyTo([lat, lon], 16, { duration: 1.5 });
    }
  }, [flyToTrigger, engineType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP TYPE
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineType === 'google' && mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType, engineType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER REAL GeoJSON FROM BACKEND (replaces hard-coded fake zones)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineType !== 'google' || !mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;

    // Clear previous overlays
    overlaysRef.current.forEach((item) => {
      if (item.setMap) item.setMap(null);
    });
    overlaysRef.current = [];

    if (!activeChangeMaskGeoJSON || !showChangeMask) return;

    // Render real GeoJSON features from the backend
    const features = activeChangeMaskGeoJSON.features || [];
    features.forEach((feature) => {
      const props = feature.properties || {};
      const geometry = feature.geometry;
      if (!geometry) return;

      const changeColor = getChangeColor(props.change_type);

      if (geometry.type === 'Polygon') {
        const paths = geometry.coordinates[0].map(
          (coord) => ({ lat: coord[1], lng: coord[0] })
        );

        const polygon = new window.google.maps.Polygon({
          paths,
          strokeColor: changeColor,
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          fillColor: changeColor,
          fillOpacity: 0.25,
          map,
        });

        polygon.addListener('click', () => {
          setActiveFeatureInfo({
            ...props,
            color: changeColor,
          });
        });

        overlaysRef.current.push(polygon);
      }
    });

    // Fit map to the GeoJSON extent
    if (activeChangeMaskGeoJSON.bbox) {
      const [minLon, minLat, maxLon, maxLat] = activeChangeMaskGeoJSON.bbox;
      const bounds = new window.google.maps.LatLngBounds(
        { lat: minLat, lng: minLon },
        { lat: maxLat, lng: maxLon }
      );
      map.fitBounds(bounds, { padding: 80 });
    }
  }, [activeChangeMaskGeoJSON, showChangeMask, engineType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EARTH ENGINE TILE OVERLAYS (NDVI, NDWI, NDBI, SAR)
  // ═══════════════════════════════════════════════════════════════════════════
  const eeTileOverlayRef = useRef(null);
  const eeTileLayerNameRef = useRef(null);

  useEffect(() => {
    if (engineType !== 'google' || !mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;

    // Remove previous EE tile overlay
    if (eeTileOverlayRef.current) {
      const idx = map.overlayMapTypes.indexOf(eeTileOverlayRef.current);
      if (idx >= 0) map.overlayMapTypes.removeAt(idx);
      eeTileOverlayRef.current = null;
      eeTileLayerNameRef.current = null;
    }

    // Determine which analysis layer is active
    const layerMapping = {
      ndvi: 'ndvi',
      ndwi: 'ndwi',
      ndbi: 'ndbi',
      sar: 'sar_vv',
      vegetation: 'ndvi',
      water: 'ndwi',
      builtup: 'ndbi',
    };

    let activeEELayer = null;
    for (const [key, eeType] of Object.entries(layerMapping)) {
      if (analysisLayers[key]) {
        activeEELayer = eeType;
        break;
      }
    }

    if (!activeEELayer) return;

    // Fetch tile URL from backend
    const fetchAndApplyTiles = async () => {
      try {
        const resp = await fetch('http://127.0.0.1:8000/api/ee/tiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: location.lat,
            lon: location.lon,
            year: state.selectedYear || 2024,
            layer_type: activeEELayer,
          }),
        });

        if (!resp.ok) return;
        const data = await resp.json();
        if (data.status !== 'success' || !data.tile_url) return;

        // Create ImageMapType from EE tile URL
        const tileUrl = data.tile_url;
        const eeMapType = new window.google.maps.ImageMapType({
          getTileUrl: (coord, zoom) => {
            return tileUrl.replace('{z}', zoom).replace('{x}', coord.x).replace('{y}', coord.y);
          },
          tileSize: new window.google.maps.Size(256, 256),
          opacity: state.layerOpacities[activeEELayer] ?? 0.7,
          name: `EE_${activeEELayer}`,
        });

        map.overlayMapTypes.push(eeMapType);
        eeTileOverlayRef.current = eeMapType;
        eeTileLayerNameRef.current = activeEELayer;
      } catch (err) {
        console.warn('Failed to load EE tiles:', err);
      }
    };

    fetchAndApplyTiles();
  }, [analysisLayers, engineType, location.lat, location.lon, state.selectedYear, state.layerOpacities]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AOI DRAWING
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineType !== 'google' || !mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;
    const google = window.google;

    // Clear existing AOI shape
    if (aoiShapeRef.current) {
      aoiShapeRef.current.setMap(null);
      aoiShapeRef.current = null;
    }

    if (!drawingMode || drawingMode.startsWith('measure_')) return;

    // Set up drawing based on mode
    const drawingListener = map.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lon = e.latLng.lng();

      if (drawingMode === 'point') {
        const marker = new google.maps.Marker({
          position: e.latLng,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#00e5ff',
            fillOpacity: 0.8,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        });
        aoiShapeRef.current = marker;
        setAOI({
          type: 'point',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          center: { lat, lon },
          area: 0,
          perimeter: 0,
        });
        dispatch({ type: 'SET_DRAWING_MODE', payload: null });
      } else if (drawingMode === 'radius') {
        const radiusM = 1000; // Default 1 km
        const circle = new google.maps.Circle({
          center: e.latLng,
          radius: radiusM,
          strokeColor: '#00e5ff',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#00e5ff',
          fillOpacity: 0.15,
          map,
          editable: true,
        });
        aoiShapeRef.current = circle;

        const updateAOI = () => {
          const c = circle.getCenter();
          const r = circle.getRadius();
          setAOI({
            type: 'radius',
            geometry: {
              type: 'Point',
              coordinates: [c.lng(), c.lat()],
              radius: r,
            },
            center: { lat: c.lat(), lon: c.lng() },
            area: Math.PI * r * r,
            perimeter: 2 * Math.PI * r,
          });
        };

        circle.addListener('radius_changed', updateAOI);
        circle.addListener('center_changed', updateAOI);
        updateAOI();
        dispatch({ type: 'SET_DRAWING_MODE', payload: null });
      }
    });

    // Rectangle drawing
    if (drawingMode === 'rectangle') {
      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
        drawingControl: false,
        rectangleOptions: {
          strokeColor: '#00e5ff',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#00e5ff',
          fillOpacity: 0.15,
          editable: true,
        },
      });
      dm.setMap(map);
      drawingManagerRef.current = dm;

      google.maps.event.addListener(dm, 'rectanglecomplete', (rect) => {
        dm.setMap(null);
        aoiShapeRef.current = rect;
        const bounds = rect.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        setAOI({
          type: 'rectangle',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [sw.lng(), sw.lat()],
              [ne.lng(), sw.lat()],
              [ne.lng(), ne.lat()],
              [sw.lng(), ne.lat()],
              [sw.lng(), sw.lat()],
            ]],
          },
          center: {
            lat: (ne.lat() + sw.lat()) / 2,
            lon: (ne.lng() + sw.lng()) / 2,
          },
          area: google.maps.geometry?.spherical?.computeArea(
            [ne, { lat: ne.lat(), lng: sw.lng() }, sw, { lat: sw.lat(), lng: ne.lng() }]
          ) || 0,
        });
        dispatch({ type: 'SET_DRAWING_MODE', payload: null });
      });

      return () => {
        dm.setMap(null);
        google.maps.event.removeListener(drawingListener);
      };
    }

    // Polygon drawing
    if (drawingMode === 'polygon') {
      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: false,
        polygonOptions: {
          strokeColor: '#00e5ff',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#00e5ff',
          fillOpacity: 0.15,
          editable: true,
        },
      });
      dm.setMap(map);
      drawingManagerRef.current = dm;

      google.maps.event.addListener(dm, 'polygoncomplete', (poly) => {
        dm.setMap(null);
        aoiShapeRef.current = poly;
        const path = poly.getPath().getArray();
        const coords = path.map((p) => [p.lng(), p.lat()]);
        coords.push(coords[0]); // close ring

        setAOI({
          type: 'polygon',
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
          center: {
            lat: path.reduce((s, p) => s + p.lat(), 0) / path.length,
            lon: path.reduce((s, p) => s + p.lng(), 0) / path.length,
          },
          area: google.maps.geometry?.spherical?.computeArea(path) || 0,
        });
        dispatch({ type: 'SET_DRAWING_MODE', payload: null });
      });

      return () => {
        dm.setMap(null);
        google.maps.event.removeListener(drawingListener);
      };
    }

    return () => {
      google.maps.event.removeListener(drawingListener);
    };
  }, [drawingMode, engineType, dispatch, setAOI]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER AOI SHAPE FROM STATE
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineType !== 'google' || !mapInstanceRef.current || !window.google) return;
    if (aoiShapeRef.current) return; // Already rendered by drawing

    if (!aoi.geometry) return;

    const map = mapInstanceRef.current;
    const google = window.google;

    if (aoi.type === 'radius' && aoi.geometry.radius) {
      const circle = new google.maps.Circle({
        center: { lat: aoi.geometry.coordinates[1], lng: aoi.geometry.coordinates[0] },
        radius: aoi.geometry.radius,
        strokeColor: '#00e5ff',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#00e5ff',
        fillOpacity: 0.15,
        map,
      });
      aoiShapeRef.current = circle;
    } else if (aoi.geometry.type === 'Polygon') {
      const paths = aoi.geometry.coordinates[0].map(
        (coord) => ({ lat: coord[1], lng: coord[0] })
      );
      const polygon = new google.maps.Polygon({
        paths,
        strokeColor: '#00e5ff',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#00e5ff',
        fillOpacity: 0.15,
        map,
      });
      aoiShapeRef.current = polygon;
    }
  }, [aoi, engineType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT MENU ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleContextAction = useCallback(async (action) => {
    const { lat, lon } = contextMenu;
    setContextMenu(null);

    switch (action) {
      case 'reverse_geocode': {
        dispatch({ type: 'SET_LOCATION', payload: { lat, lon } });
        // Reverse geocode via Nominatim
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`,
            { headers: { 'User-Agent': 'Aethreix/2.0' } }
          );
          const data = await resp.json();
          dispatch({
            type: 'SET_REVERSE_GEOCODE',
            payload: {
              displayName: data.display_name,
              ...data.address,
            },
          });
          dispatch({ type: 'SET_LOCATION', payload: { name: data.display_name?.split(',')?.slice(0, 2)?.join(', ') } });
        } catch {
          /* silently fail */
        }
        break;
      }
      case 'set_aoi_point':
        setAOI({
          type: 'point',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          center: { lat, lon },
          area: 0,
          perimeter: 0,
        });
        break;
      case 'set_aoi_radius':
        setAOI({
          type: 'radius',
          geometry: { type: 'Point', coordinates: [lon, lat], radius: 1000 },
          center: { lat, lon },
          area: Math.PI * 1000 * 1000,
          perimeter: 2 * Math.PI * 1000,
        });
        break;
      case 'what_changed':
        dispatch({ type: 'OPEN_CHAT' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: Date.now(),
            role: 'user',
            text: `What changed at ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E since 2020?`,
            timestamp: new Date(),
          },
        });
        break;
      case 'copy_coords':
        navigator.clipboard?.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        break;
      default:
        break;
    }
  }, [contextMenu, dispatch, setAOI]);

  // Close context menu on click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  return (
    <div className="globe-container">
      {/* Map Viewport */}
      <div
        ref={mapContainerRef}
        id="athreix-map-viewport"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          background: '#06080f',
        }}
      />

      {/* Real Evidence Feature Inspector (replaces fake zone inspector) */}
      {activeFeatureInfo && (
        <div className="vector-inspector glass-panel">
          <div className="inspector-header">
            <span className="inspector-title">
              {activeFeatureInfo.change_type
                ? formatChangeType(activeFeatureInfo.change_type)
                : activeFeatureInfo.id || 'Change Detected'}
            </span>
            <button
              className="inspector-close"
              onClick={() => setActiveFeatureInfo(null)}
            >
              ✕
            </button>
          </div>

          {activeFeatureInfo.change_type && (
            <div className="inspector-badge" style={{ color: activeFeatureInfo.color }}>
              {formatChangeType(activeFeatureInfo.change_type)}
            </div>
          )}

          <div className="inspector-details-grid">
            {activeFeatureInfo.area_sq_km && (
              <div className="inspector-detail">
                <span className="detail-label">Area</span>
                <span className="detail-value">{formatArea(activeFeatureInfo.area_sq_km)}</span>
              </div>
            )}
            {activeFeatureInfo.area_ha && (
              <div className="inspector-detail">
                <span className="detail-label">Area</span>
                <span className="detail-value">{activeFeatureInfo.area_ha} ha</span>
              </div>
            )}
            {activeFeatureInfo.confidence && (
              <div className="inspector-detail">
                <span className="detail-label">Confidence</span>
                <span className="detail-value">{Math.round(activeFeatureInfo.confidence * 100)}%</span>
              </div>
            )}
          </div>

          <div className="inspector-footer">
            <span>Source: Backend Analysis</span>
            <span>Real Data</span>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="map-context-menu glass-panel"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-coords">
            {contextMenu.lat.toFixed(6)}°N, {contextMenu.lon.toFixed(6)}°E
          </div>
          <button onClick={() => handleContextAction('reverse_geocode')}>
            📍 What is this place?
          </button>
          <button onClick={() => handleContextAction('set_aoi_point')}>
            🎯 Set as AOI point
          </button>
          <button onClick={() => handleContextAction('set_aoi_radius')}>
            ⭕ Analyze 1 km radius
          </button>
          <button onClick={() => handleContextAction('what_changed')}>
            🔍 What changed here?
          </button>
          <button onClick={() => handleContextAction('copy_coords')}>
            📋 Copy coordinates
          </button>
        </div>
      )}

      {/* Drawing Mode Indicator */}
      {drawingMode && (
        <div className="drawing-mode-indicator glass-panel-subtle">
          <span className="drawing-mode-icon">
            {drawingMode === 'point' ? '📍' :
             drawingMode === 'radius' ? '⭕' :
             drawingMode === 'rectangle' ? '⬜' :
             drawingMode === 'polygon' ? '🔷' :
             drawingMode === 'measure_distance' ? '📏' :
             drawingMode === 'measure_area' ? '📐' : '✏️'}
          </span>
          <span>Drawing: {drawingMode.replace('_', ' ')}</span>
          <button
            className="cancel-drawing-btn"
            onClick={() => {
              dispatch({ type: 'SET_DRAWING_MODE', payload: null });
              if (aoiShapeRef.current) {
                aoiShapeRef.current.setMap?.(null);
                aoiShapeRef.current = null;
              }
            }}
          >
            ✕ Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function getChangeColor(changeType) {
  const colors = {
    built_up_expansion: '#ff5252',
    vegetation_to_builtup: '#ff5252',
    vegetation_loss: '#ff9100',
    vegetation_transition: '#ffab40',
    water_to_land: '#ff6e40',
    land_to_water: '#448aff',
    bare_to_builtup: '#e040fb',
    deforestation: '#ff3d00',
    urban_expansion: '#f50057',
    flood: '#2979ff',
    default: '#ff5252',
  };
  return colors[changeType] || colors.default;
}

function formatChangeType(type) {
  if (!type) return 'Change Detected';
  return type
    .replace(/_/g, ' → ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatArea(sqKm) {
  if (sqKm < 0.01) return `${Math.round(sqKm * 1e6)} m²`;
  if (sqKm < 1) return `${(sqKm * 100).toFixed(1)} ha`;
  return `${sqKm.toFixed(2)} km²`;
}
