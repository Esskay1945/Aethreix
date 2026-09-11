import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AthreixContext = createContext(null);

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE — No hard-coded fake data
// ═══════════════════════════════════════════════════════════════════════════
const initialState = {
  // Location
  location: {
    lat: 20.5937,
    lon: 78.9629,
    name: 'India',
    elevation: 0,
    cameraAlt: 15000000,
    address: null, // Full reverse geocode result
  },

  // AOI (Area of Interest)
  aoi: {
    type: null, // 'point' | 'radius' | 'rectangle' | 'polygon' | 'admin'
    geometry: null, // GeoJSON geometry
    area: null, // square meters
    perimeter: null, // meters
    center: null, // { lat, lon }
  },
  drawingMode: null, // null | 'point' | 'radius' | 'rectangle' | 'polygon' | 'measure_distance' | 'measure_area'

  // Timeline — data-driven, NOT hard-coded
  selectedYear: 2024,
  selectedDateRange: null, // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  availableData: [], // Populated from backend: [{ year, sensors: [{name, count, cloudCover}] }]
  imageryLoading: false,

  // Map Display & Layers
  mapEngine: 'google', // 'google' | 'cesium'
  mapType: 'hybrid', // 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
  activeLayers: {
    roads: true,
    labels: true,
    boundaries: false,
    transit: false,
    traffic: false,
    buildings: false,
    places: false,
  },
  analysisLayers: {
    ndvi: false,
    ndwi: false,
    ndbi: false,
    change: false,
    water: false,
    vegetation: false,
    builtup: false,
    sar: false,
    anomaly: false,
    evidence: true,
  },
  layerOpacities: {}, // layerId -> 0-1

  // Analysis Results
  analysisResults: null, // { geojson, metrics, evidence, transitions }
  activeChangeMaskGeoJSON: null,
  showChangeMask: true,
  changePolygons: [], // Individual change features with metadata

  // Mission System
  activeMission: null, // { id, query, status, progress, steps[], results }
  missionHistory: [],

  // Street View
  streetViewOpen: false,
  streetViewTarget: null,

  // Chat & AI
  chatOpen: false,
  messages: [],
  isAnalyzing: false,

  // UI
  searchQuery: '',
  flyToTrigger: null,
  cameraAction: null,
  leftPanelTab: 'layers', // 'layers' | 'aoi' | 'imagery' | 'analysis'
  rightPanelTab: 'chat', // 'chat' | 'evidence' | 'mission' | 'report'
  leftPanelOpen: false,
  rightPanelOpen: false,
  measurements: [], // [{ type, points, value, unit }]

  // Temporal Comparison (Spec §19)
  temporalCompare: {
    active: false,
    beforeYear: null,
    afterYear: null,
    beforeTileUrl: null,
    afterTileUrl: null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════
function reducer(state, action) {
  switch (action.type) {
    // ── Location ──
    case 'SET_LOCATION':
      return { ...state, location: { ...state.location, ...action.payload } };

    case 'SET_REVERSE_GEOCODE':
      return { ...state, location: { ...state.location, address: action.payload } };

    // ── AOI ──
    case 'SET_AOI':
      return { ...state, aoi: { ...state.aoi, ...action.payload } };

    case 'CLEAR_AOI':
      return {
        ...state,
        aoi: { type: null, geometry: null, area: null, perimeter: null, center: null },
        drawingMode: null,
      };

    case 'SET_DRAWING_MODE':
      return { ...state, drawingMode: action.payload };

    // ── Timeline ──
    case 'SET_SELECTED_YEAR':
      return { ...state, selectedYear: action.payload, imageryLoading: true };

    case 'SET_TEMPORAL_COMPARE':
      return { ...state, temporalCompare: { ...state.temporalCompare, ...action.payload } };

    case 'SET_DATE_RANGE':
      return { ...state, selectedDateRange: action.payload };

    case 'SET_AVAILABLE_DATA':
      return { ...state, availableData: action.payload };

    case 'SET_IMAGERY_LOADING':
      return { ...state, imageryLoading: action.payload };

    // ── Map Engine ──
    case 'SET_MAP_ENGINE':
      return { ...state, mapEngine: action.payload };

    case 'SET_MAP_TYPE':
      return { ...state, mapType: action.payload };

    // ── Layers ──
    case 'TOGGLE_LAYER': {
      const { category, layer } = action.payload;
      if (category === 'analysis') {
        return {
          ...state,
          analysisLayers: {
            ...state.analysisLayers,
            [layer]: !state.analysisLayers[layer],
          },
        };
      }
      return {
        ...state,
        activeLayers: {
          ...state.activeLayers,
          [layer]: !state.activeLayers[layer],
        },
      };
    }

    case 'SET_LAYER_OPACITY':
      return {
        ...state,
        layerOpacities: {
          ...state.layerOpacities,
          [action.payload.layer]: action.payload.opacity,
        },
      };

    // ── Analysis Results ──
    case 'SET_ANALYSIS_RESULTS':
      return { ...state, analysisResults: action.payload };

    case 'SET_CHANGE_MASK':
      return {
        ...state,
        activeChangeMaskGeoJSON: action.payload,
        showChangeMask: true,
      };

    case 'TOGGLE_CHANGE_MASK':
      return { ...state, showChangeMask: !state.showChangeMask };

    case 'CLEAR_CHANGE_MASK':
      return { ...state, activeChangeMaskGeoJSON: null, changePolygons: [] };

    case 'SET_CHANGE_POLYGONS':
      return { ...state, changePolygons: action.payload };

    // ── Mission ──
    case 'SET_ACTIVE_MISSION':
      return { ...state, activeMission: action.payload };

    case 'UPDATE_MISSION_PROGRESS':
      if (!state.activeMission) return state;
      return {
        ...state,
        activeMission: {
          ...state.activeMission,
          ...action.payload,
        },
      };

    case 'ADD_MISSION_STEP':
      if (!state.activeMission) return state;
      return {
        ...state,
        activeMission: {
          ...state.activeMission,
          steps: [...(state.activeMission.steps || []), action.payload],
        },
      };

    case 'COMPLETE_MISSION':
      return {
        ...state,
        activeMission: {
          ...state.activeMission,
          status: 'complete',
          progress: 100,
          results: action.payload,
        },
        missionHistory: [state.activeMission, ...state.missionHistory].slice(0, 50),
      };

    case 'CLEAR_MISSION':
      return { ...state, activeMission: null };

    // ── Street View ──
    case 'TOGGLE_STREET_VIEW': {
      const willOpen = !state.streetViewOpen;
      return {
        ...state,
        streetViewOpen: willOpen,
        streetViewTarget: willOpen
          ? action.payload || { lat: state.location.lat, lon: state.location.lon, name: state.location.name }
          : null,
      };
    }

    case 'OPEN_STREET_VIEW':
      return {
        ...state,
        streetViewOpen: true,
        streetViewTarget: action.payload || { lat: state.location.lat, lon: state.location.lon, name: state.location.name },
      };

    case 'CLOSE_STREET_VIEW':
      return { ...state, streetViewOpen: false, streetViewTarget: null };

    // ── Camera ──
    case 'SET_CAMERA_ACTION':
      return { ...state, cameraAction: action.payload };

    case 'FLY_TO':
      return {
        ...state,
        flyToTrigger: action.payload,
        location: { ...state.location, ...action.payload },
      };

    case 'UPDATE_CAMERA':
      return {
        ...state,
        location: { ...state.location, cameraAlt: action.payload.altitude },
      };

    // ── Chat ──
    case 'TOGGLE_CHAT':
      return { ...state, chatOpen: !state.chatOpen, rightPanelOpen: !state.chatOpen, rightPanelTab: 'chat' };

    case 'OPEN_CHAT':
      return { ...state, chatOpen: true, rightPanelOpen: true, rightPanelTab: 'chat' };

    case 'CLOSE_CHAT':
      return { ...state, chatOpen: false };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'UPDATE_LAST_MESSAGE': {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const lastIndex = updated.length - 1;
      updated[lastIndex] = { ...updated[lastIndex], ...action.payload };
      return { ...state, messages: updated };
    }

    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.payload };

    // ── UI Panels ──
    case 'SET_LEFT_PANEL_TAB':
      return { ...state, leftPanelTab: action.payload, leftPanelOpen: true };

    case 'SET_RIGHT_PANEL_TAB':
      return { ...state, rightPanelTab: action.payload, rightPanelOpen: true };

    case 'TOGGLE_LEFT_PANEL':
      return { ...state, leftPanelOpen: !state.leftPanelOpen };

    case 'TOGGLE_RIGHT_PANEL':
      return { ...state, rightPanelOpen: !state.rightPanelOpen };

    // ── Search ──
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    // ── Measurements ──
    case 'ADD_MEASUREMENT':
      return { ...state, measurements: [...state.measurements, action.payload] };

    case 'CLEAR_MEASUREMENTS':
      return { ...state, measurements: [], drawingMode: null };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
export function AthreixProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const flyTo = useCallback((lat, lon, name) => {
    dispatch({ type: 'FLY_TO', payload: { lat, lon, name } });
  }, []);

  const triggerCameraAction = useCallback((actionName) => {
    dispatch({
      type: 'SET_CAMERA_ACTION',
      payload: { action: actionName, timestamp: Date.now() },
    });
  }, []);

  const sendMessage = useCallback((text) => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: Date.now(), role: 'user', text, timestamp: new Date() },
    });
    dispatch({ type: 'OPEN_CHAT' });
  }, []);

  const addAIMessage = useCallback((text, evidence = null) => {
    const id = Date.now();
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id,
        role: 'ai',
        text,
        evidence,
        timestamp: new Date(),
        isStreaming: false,
      },
    });
    return id;
  }, []);

  const toggleStreetView = useCallback((customTarget = null) => {
    dispatch({ type: 'TOGGLE_STREET_VIEW', payload: customTarget });
  }, []);

  const toggleChangeMask = useCallback(() => {
    dispatch({ type: 'TOGGLE_CHANGE_MASK' });
  }, []);

  const setChangeMask = useCallback((geojson) => {
    dispatch({ type: 'SET_CHANGE_MASK', payload: geojson });
  }, []);

  // Mission helpers
  const startMission = useCallback((query, aoi) => {
    const mission = {
      id: `mission_${Date.now()}`,
      query,
      aoi,
      status: 'running',
      progress: 0,
      steps: [],
      results: null,
      startedAt: new Date(),
    };
    dispatch({ type: 'SET_ACTIVE_MISSION', payload: mission });
    return mission.id;
  }, []);

  const updateMissionStep = useCallback((stepData) => {
    dispatch({ type: 'ADD_MISSION_STEP', payload: stepData });
  }, []);

  const completeMission = useCallback((results) => {
    dispatch({ type: 'COMPLETE_MISSION', payload: results });
  }, []);

  // AOI helpers
  const setAOI = useCallback((aoiData) => {
    dispatch({ type: 'SET_AOI', payload: aoiData });
  }, []);

  const clearAOI = useCallback(() => {
    dispatch({ type: 'CLEAR_AOI' });
  }, []);

  const setDrawingMode = useCallback((mode) => {
    dispatch({ type: 'SET_DRAWING_MODE', payload: mode });
  }, []);

  const value = {
    state,
    dispatch,
    flyTo,
    triggerCameraAction,
    sendMessage,
    addAIMessage,
    toggleStreetView,
    toggleChangeMask,
    setChangeMask,
    startMission,
    updateMissionStep,
    completeMission,
    setAOI,
    clearAOI,
    setDrawingMode,
  };

  return (
    <AthreixContext.Provider value={value}>{children}</AthreixContext.Provider>
  );
}

export function useAthreix() {
  const context = useContext(AthreixContext);
  if (!context) {
    throw new Error('useAthreix must be used within AthreixProvider');
  }
  return context;
}
