import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  Viewer,
  Scene,
  Camera,
  ScreenSpaceEventHandler,
  ScreenSpaceEvent,
} from 'resium';
import {
  Cartesian3,
  Math as CesiumMath,
  ScreenSpaceEventType,
  Cartographic,
  defined,
  RequestScheduler,
  Color,
  Ion,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
  createOsmBuildingsAsync,
  NearFarScalar,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Cartesian2,
  ImageryLayer,
  GeoJsonDataSource,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useAthreix } from '../context/AthreixContext.jsx';

// ─── City Labels ───────────────────────────────────────────────────────────────
const CITY_LABELS = [
  // India — Maharashtra focus
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, level: 'mega' },
  { name: 'Panvel', lat: 18.9894, lon: 73.1175, level: 'city' },
  { name: 'Navi Mumbai', lat: 19.033, lon: 73.0297, level: 'city' },
  { name: 'Thane', lat: 19.2183, lon: 72.9781, level: 'city' },
  { name: 'Kalyan', lat: 19.2403, lon: 73.1305, level: 'city' },
  { name: 'Dombivli', lat: 19.2167, lon: 73.0833, level: 'town' },
  { name: 'Titwala', lat: 19.3, lon: 73.209, level: 'town' },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, level: 'mega' },
  { name: 'Nashik', lat: 19.9975, lon: 73.7898, level: 'city' },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882, level: 'city' },
  { name: 'Aurangabad', lat: 19.8762, lon: 75.3433, level: 'city' },
  // India — Major metros
  { name: 'New Delhi', lat: 28.6139, lon: 77.209, level: 'capital' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, level: 'mega' },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867, level: 'mega' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, level: 'mega' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, level: 'mega' },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, level: 'mega' },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, level: 'city' },
  { name: 'Surat', lat: 21.1702, lon: 72.8311, level: 'city' },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462, level: 'city' },
  { name: 'Chandigarh', lat: 30.7333, lon: 76.7794, level: 'city' },
  { name: 'Bhopal', lat: 23.2599, lon: 77.4126, level: 'city' },
  { name: 'Patna', lat: 25.5941, lon: 85.1376, level: 'city' },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673, level: 'city' },
  { name: 'Goa', lat: 15.2993, lon: 74.124, level: 'city' },
  { name: 'Indore', lat: 22.7196, lon: 75.8577, level: 'city' },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185, level: 'city' },
  { name: 'Varanasi', lat: 25.3176, lon: 82.9739, level: 'city' },
  { name: 'Amritsar', lat: 31.634, lon: 74.8723, level: 'city' },
  { name: 'Guwahati', lat: 26.1445, lon: 91.7362, level: 'city' },
  // International
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, level: 'mega' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, level: 'mega' },
  { name: 'London', lat: 51.5074, lon: -0.1278, level: 'mega' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, level: 'mega' },
  { name: 'New York', lat: 40.7128, lon: -74.006, level: 'mega' },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, level: 'mega' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, level: 'mega' },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, level: 'mega' },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173, level: 'mega' },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, level: 'mega' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, level: 'mega' },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784, level: 'mega' },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018, level: 'mega' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, level: 'mega' },
  { name: 'Seoul', lat: 37.5665, lon: 126.978, level: 'mega' },
  { name: 'Berlin', lat: 52.52, lon: 13.405, level: 'mega' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, level: 'mega' },
];

function getLabelStyle(level) {
  switch (level) {
    case 'capital':
      return { font: 'bold 16px "Space Grotesk", sans-serif', pointSize: 11, pointColor: '#ff5252', farScale: 5e7 };
    case 'mega':
      return { font: 'bold 15px "Space Grotesk", sans-serif', pointSize: 9, pointColor: '#00e5ff', farScale: 4e7 };
    case 'city':
      return { font: '600 13px "Inter", sans-serif', pointSize: 7, pointColor: '#69f0ae', farScale: 1.5e7 };
    case 'town':
    default:
      return { font: '500 11px "Inter", sans-serif', pointSize: 5, pointColor: '#b0bec5', farScale: 5e6 };
  }
}

// Sentinel-2 Cloudless yearly mosaics from EOX (2017-2024)
function getSentinelUrl(year) {
  const y = Math.min(Math.max(year, 2017), 2024);
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${y}_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`;
}

// Multi-Decade Satellite Imagery Provider (2005 - 2026)
// Correct WebMercatorTilingScheme ensures precise coordinate alignment at all zoom levels
function getHistoricalImageryProvider(year) {
  if (year >= 2017) {
    const y = Math.min(Math.max(year, 2017), 2024);
    return {
      provider: new UrlTemplateImageryProvider({
        url: getSentinelUrl(y),
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 13, // EOX global tiles are Level 0-13, Cesium upscales smoothly beyond Level 13
        credit: `ESA Sentinel-2 Cloudless ${y} (10m)`,
      }),
      title: `🛰️ Sentinel-2 Cloudless ${y} (10m Resolution)`,
    };
  } else {
    // NASA GIBS true-color global historical satellite archive (2005-2016)
    const y = Math.max(2005, Math.min(2016, year));
    const dateStr = `${y}-06-20`;
    return {
      provider: new UrlTemplateImageryProvider({
        url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 8,
        credit: `NASA GIBS Global Archive ${y} (250m)`,
      }),
      title: `🌍 NASA GIBS Earth Archive ${y} (2005 Era)`,
    };
  }
}

export default function GlobeViewer() {
  const viewerRef = useRef(null);
  const initDoneRef = useRef(false);
  const roadsLayerRef = useRef(null);
  const labelsLayerRef = useRef(null);
  const sentinelLayerRef = useRef(null);
  const baseLayerRef = useRef(null);
  const changeMaskDataSourceRef = useRef(null);

  const [imageryToast, setImageryToast] = useState(null);

  const { state, dispatch } = useAthreix();
  const { flyToTrigger, cameraAction, selectedYear, labelsEnabled, roadsEnabled, mapMode, activeChangeMaskGeoJSON, showChangeMask } = state;

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT: Set up the Cesium Viewer after component mounts
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const tryInit = () => {
      if (initDoneRef.current) return;
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer) return;

      initDoneRef.current = true;

      // Maximise tile streaming throughput & concurrency
      RequestScheduler.maximumRequests = 48;
      RequestScheduler.maximumRequestsPerServer = 24;
      if (RequestScheduler.requestsByServer) {
        RequestScheduler.requestsByServer['server.arcgisonline.com:443'] = 32;
        RequestScheduler.requestsByServer['tiles.maps.eox.at:443'] = 24;
        RequestScheduler.requestsByServer['a.basemaps.cartocdn.com:443'] = 24;
        RequestScheduler.requestsByServer['b.basemaps.cartocdn.com:443'] = 24;
        RequestScheduler.requestsByServer['c.basemaps.cartocdn.com:443'] = 24;
      }

      // Globe & atmosphere rendering optimizations for instant tile streaming
      const globe = viewer.scene.globe;
      globe.show = true;
      globe.enableLighting = false;
      globe.depthTestAgainstTerrain = false;
      globe.tileCacheSize = 2500; // Keep up to 2500 tiles in memory for instantaneous panning
      globe.preloadAncestors = true; // Show low-res parent tiles instantly while high-res stream in (no gray gaps!)
      globe.preloadSiblings = true; // Preload adjacent tiles for silky smooth flying
      globe.maximumScreenSpaceError = 2.0; // Optimal balance of crisp resolution & fast streaming
      globe.loadingDescendantLimit = 16;
      globe.backFaceCulling = true;

      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.00012;
      viewer.scene.fog.screenSpaceErrorFactor = 2.0;

      // ── Remove default Bing base layer ──────────────────────────────────
      viewer.imageryLayers.removeAll();

      // ── Layer 0: High-res satellite (Esri World Imagery) ────────────────
      const baseProvider = new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 19,
        credit: 'Esri World Imagery',
        enablePickFeatures: false,
      });
      const baseLayer = viewer.imageryLayers.addImageryProvider(baseProvider);
      baseLayerRef.current = baseLayer;

      // ── Layer 1: Roads & highways ───────────────────────────────────────
      const roadsProvider = new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 19,
        hasAlphaChannel: true,
        credit: 'Esri Transportation',
      });
      const roadsLayer = viewer.imageryLayers.addImageryProvider(roadsProvider);
      roadsLayer.alpha = 0.9;
      roadsLayerRef.current = roadsLayer;

      // ── Layer 2: City names & country borders (CartoDB) ─────────────────
      const labelsProvider = new UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        subdomains: ['a', 'b', 'c', 'd'],
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 19,
        hasAlphaChannel: true,
        credit: 'CartoDB / OSM',
      });
      const labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
      labelsLayer.alpha = 1.0;
      labelsLayerRef.current = labelsLayer;

      // ── Layer 3: Esri Reference Labels (world boundaries & places) ──────
      const refProvider = new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 19,
        hasAlphaChannel: true,
        credit: 'Esri Labels',
      });
      viewer.imageryLayers.addImageryProvider(refProvider);

      // ── 3D Buildings (try, but don't crash if Ion token is invalid) ─────
      (async () => {
        try {
          const buildings = await createOsmBuildingsAsync();
          viewer.scene.primitives.add(buildings);
        } catch (e) {
          console.warn('OSM 3D Buildings unavailable:', e.message);
        }
      })();

      // ── Entity labels for cities (always visible, independent of tiles) ─
      CITY_LABELS.forEach((loc) => {
        const s = getLabelStyle(loc.level);
        viewer.entities.add({
          position: Cartesian3.fromDegrees(loc.lon, loc.lat, 50),
          point: {
            pixelSize: s.pointSize,
            color: Color.fromCssColorString(s.pointColor),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new NearFarScalar(1e4, 1.2, s.farScale, 0.4),
          },
          label: {
            text: loc.name,
            font: s.font,
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new NearFarScalar(1e3, 1.0, s.farScale, 0.5),
            translucencyByDistance: new NearFarScalar(s.farScale, 1.0, s.farScale * 1.5, 0.0),
          },
        });
      });

      // ── Initial camera position: 3D orbit over India ────────────────────
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(78.9629, 20.5937, 12000000),
        duration: 0,
      });
    };

    // Try immediately, then retry briefly in case viewer isn't ready yet
    tryInit();
    const retryTimer = setTimeout(tryInit, 500);
    const retryTimer2 = setTimeout(tryInit, 1500);
    return () => {
      clearTimeout(retryTimer);
      clearTimeout(retryTimer2);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE: Swap imagery when selectedYear changes (2005 - 2026 Archive)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!initDoneRef.current) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    const currentYear = new Date().getFullYear();

    if (selectedYear >= currentYear) {
      // Current/future: show Esri live base, remove historical overlay
      if (sentinelLayerRef.current) {
        viewer.imageryLayers.remove(sentinelLayerRef.current, true);
        sentinelLayerRef.current = null;
      }
      if (baseLayerRef.current) {
        baseLayerRef.current.alpha = 1.0;
        baseLayerRef.current.show = true;
      }
      setImageryToast(`🛰️ Live High-Resolution Satellite (${selectedYear})`);
    } else {
      // Historical year selected (2005 - 2024)
      if (sentinelLayerRef.current) {
        viewer.imageryLayers.remove(sentinelLayerRef.current, true);
        sentinelLayerRef.current = null;
      }

      const { provider, title } = getHistoricalImageryProvider(selectedYear);
      // Insert at index 1 (above base, below roads/labels)
      const layer = viewer.imageryLayers.addImageryProvider(provider, 1);
      layer.alpha = 1.0;
      layer.show = true;
      sentinelLayerRef.current = layer;

      // Keep base layer as soft backdrop so globe never turns white
      if (baseLayerRef.current) {
        baseLayerRef.current.alpha = 0.2;
      }

      setImageryToast(title);
    }

    // Auto-hide toast
    const t = setTimeout(() => setImageryToast(null), 4000);
    dispatch({ type: 'SET_IMAGERY_LOADING', payload: false });
    return () => clearTimeout(t);
  }, [selectedYear, dispatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ORBITAL: Render Real GeoJSON Change Polygons on the 3D Globe
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!initDoneRef.current) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    // Clear previous change mask entities
    if (changeMaskDataSourceRef.current) {
      viewer.dataSources.remove(changeMaskDataSourceRef.current, true);
      changeMaskDataSourceRef.current = null;
    }

    if (!activeChangeMaskGeoJSON || !showChangeMask) return;

    (async () => {
      try {
        const dataSource = await GeoJsonDataSource.load(activeChangeMaskGeoJSON, {
          stroke: Color.fromCssColorString('#ff3d00'),
          fill: Color.fromCssColorString('rgba(255, 61, 0, 0.45)'),
          strokeWidth: 3,
          clampToGround: true,
        });

        // Style the polygon entities
        dataSource.entities.values.forEach(entity => {
          if (entity.polygon) {
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Color.fromCssColorString('#00e5ff');
            entity.polygon.outlineWidth = 2;
            entity.polygon.height = 10;
            entity.polygon.extrudedHeight = 35; // 3D Extrusions for detected change clusters
          }
        });

        viewer.dataSources.add(dataSource);
        changeMaskDataSourceRef.current = dataSource;

        // Fly camera to the change bounding box
        if (activeChangeMaskGeoJSON.bbox) {
          const [minLon, minLat, maxLon, maxLat] = activeChangeMaskGeoJSON.bbox;
          viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees((minLon + maxLon) / 2, (minLat + maxLat) / 2, 4500),
            duration: 1.8,
          });
        }
      } catch (err) {
        console.warn('GeoJSON Change Mask rendering error:', err);
      }
    })();
  }, [activeChangeMaskGeoJSON, showChangeMask]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA ACTIONS: Zoom, tilt, compass
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!cameraAction) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const cam = viewer.camera;

    switch (cameraAction.action) {
      case 'zoomIn': {
        const h = cam.positionCartographic.height;
        cam.zoomIn(Math.max(h * 0.4, 100));
        break;
      }
      case 'zoomOut': {
        const h = cam.positionCartographic.height;
        cam.zoomOut(Math.max(h * 0.4, 100));
        break;
      }
      case 'toggleTilt': {
        const pitch = CesiumMath.toDegrees(cam.pitch);
        cam.flyTo({
          destination: cam.position,
          orientation: {
            heading: cam.heading,
            pitch: pitch < -65 ? CesiumMath.toRadians(-40) : CesiumMath.toRadians(-89.9),
            roll: 0,
          },
          duration: 0.8,
        });
        break;
      }
      case 'resetNorth':
        cam.flyTo({
          destination: cam.position,
          orientation: { heading: 0, pitch: cam.pitch, roll: 0 },
          duration: 0.8,
        });
        break;
    }
  }, [cameraAction]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLY TO: Navigate to searched location
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!flyToTrigger) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const { lat, lon } = flyToTrigger;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(lon, lat, 3500),
      duration: 2.5,
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
    });
  }, [flyToTrigger]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER TOGGLES & MAP MODE
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (labelsLayerRef.current) labelsLayerRef.current.show = labelsEnabled;
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer) {
      viewer.entities.values.forEach(entity => {
        if (entity.label) {
          entity.show = labelsEnabled;
        }
      });
    }
  }, [labelsEnabled]);

  useEffect(() => {
    if (roadsLayerRef.current) roadsLayerRef.current.show = roadsEnabled;
  }, [roadsEnabled]);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    // Apply color filters to simulate SAR / NDVI on the base imagery
    if (baseLayerRef.current) {
      switch (mapMode) {
        case 'sar':
          baseLayerRef.current.saturation = 0.0;
          baseLayerRef.current.contrast = 1.8;
          baseLayerRef.current.brightness = 1.2;
          baseLayerRef.current.hue = 0.0;
          break;
        case 'ndvi':
          baseLayerRef.current.saturation = 2.5;
          baseLayerRef.current.contrast = 1.5;
          baseLayerRef.current.brightness = 1.0;
          baseLayerRef.current.hue = 2.0; 
          break;
        default:
          baseLayerRef.current.saturation = 1.0;
          baseLayerRef.current.contrast = 1.0;
          baseLayerRef.current.brightness = 1.0;
          baseLayerRef.current.hue = 0.0;
          break;
      }
    }
  }, [mapMode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HUD: Track camera position
  // ═══════════════════════════════════════════════════════════════════════════
  const handleCameraMove = useCallback(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const carto = Cartographic.fromCartesian(viewer.camera.position);
    if (carto) {
      const alt = carto.height;
      dispatch({
        type: 'SET_LOCATION',
        payload: {
          lat: CesiumMath.toDegrees(carto.latitude),
          lon: CesiumMath.toDegrees(carto.longitude),
          cameraAlt: alt,
        },
      });
    }
  }, [dispatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK: Pick coordinates on globe
  // ═══════════════════════════════════════════════════════════════════════════
  const handleClick = useCallback(
    (movement) => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer) return;
      const ray = viewer.camera.getPickRay(movement.position);
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (defined(cartesian)) {
        const carto = Cartographic.fromCartesian(cartesian);
        dispatch({
          type: 'SET_LOCATION',
          payload: {
            lat: CesiumMath.toDegrees(carto.latitude),
            lon: CesiumMath.toDegrees(carto.longitude),
            elevation: carto.height,
          },
        });
      }
    },
    [dispatch]
  );

  return (
    <div className="globe-container">
      {imageryToast && (
        <div className="imagery-toast glass-panel-subtle">
          <span className="toast-icon">🛰️</span>
          <span>{imageryToast}</span>
        </div>
      )}

      <Viewer
        ref={viewerRef}
        full
        animation={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        selectionIndicator={false}
        timeline={false}
        vrButton={false}
      >
        <Scene backgroundColor={Color.fromCssColorString('#06080f')} />
        <Camera onMoveEnd={handleCameraMove} />
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent action={handleClick} type={ScreenSpaceEventType.LEFT_CLICK} />
        </ScreenSpaceEventHandler>
      </Viewer>
    </div>
  );
}
