import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AthreixContext = createContext(null);

const GENERATED_YEARS = Array.from({ length: 2026 - 2005 + 1 }, (_, i) => {
  const year = 2005 + i;
  return {
    year,
    optical: true,
    sar: year >= 2014, // Sentinel-1 active from 2014
    source: year >= 2017 ? 'Sentinel-2 (10m)' : year >= 2013 ? 'Landsat-8 (30m)' : 'Landsat-7 / NASA GIBS (30m)',
  };
});

const initialState = {
  // Location
  location: {
    lat: 20.5937,
    lon: 78.9629,
    name: 'India',
    elevation: 0,
    cameraAlt: 15000000,
  },

  // Timeline & Imagery (2005 - 2026 full historical archive)
  selectedYear: 2024,
  availableYears: GENERATED_YEARS,
  imageryLoading: false,

  // Map Display & Layers
  labelsEnabled: true,
  roadsEnabled: true,
  mapMode: 'hybrid', // 'satellite' | 'hybrid' | 'sar' | 'ndvi'

  // ORBITAL GeoJSON Change Masks & Visual Evidence
  activeChangeMaskGeoJSON: null,
  showChangeMask: true,
  activeAuditTrail: null,

  // Street View 360° Ground-Level Panorama
  streetViewOpen: false,
  streetViewTarget: null, // { lat, lon, heading, name }

  // Chat & AI Engine
  chatOpen: false,
  messages: [],
  isAnalyzing: false,

  // UI
  searchQuery: '',
  flyToTrigger: null,
  cameraAction: null, // { type: 'zoomIn' | 'zoomOut' | 'tilt' | 'resetNorth' }
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: { ...state.location, ...action.payload } };

    case 'SET_SELECTED_YEAR':
      return { ...state, selectedYear: action.payload, imageryLoading: true };

    case 'SET_IMAGERY_LOADING':
      return { ...state, imageryLoading: action.payload };

    case 'TOGGLE_LABELS':
      return { ...state, labelsEnabled: !state.labelsEnabled };

    case 'TOGGLE_ROADS':
      return { ...state, roadsEnabled: !state.roadsEnabled };

    case 'SET_MAP_MODE': {
      const mode = action.payload;
      let newLabels = state.labelsEnabled;
      let newRoads = state.roadsEnabled;
      if (mode === 'satellite') {
        newLabels = false;
        newRoads = false;
      } else if (mode === 'hybrid') {
        newLabels = true;
        newRoads = true;
      }
      return { ...state, mapMode: mode, labelsEnabled: newLabels, roadsEnabled: newRoads };
    }

    case 'SET_CHANGE_MASK':
      return {
        ...state,
        activeChangeMaskGeoJSON: action.payload,
        showChangeMask: true
      };

    case 'TOGGLE_CHANGE_MASK':
      return { ...state, showChangeMask: !state.showChangeMask };

    case 'CLEAR_CHANGE_MASK':
      return { ...state, activeChangeMaskGeoJSON: null };

    case 'SET_AUDIT_TRAIL':
      return { ...state, activeAuditTrail: action.payload };

    case 'TOGGLE_STREET_VIEW': {
      const willOpen = !state.streetViewOpen;
      return {
        ...state,
        streetViewOpen: willOpen,
        streetViewTarget: willOpen
          ? (action.payload || { lat: state.location.lat, lon: state.location.lon, name: state.location.name })
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

    case 'SET_CAMERA_ACTION':
      return { ...state, cameraAction: action.payload };

    case 'TOGGLE_CHAT':
      return { ...state, chatOpen: !state.chatOpen };

    case 'OPEN_CHAT':
      return { ...state, chatOpen: true };

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

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

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

    case 'SET_AVAILABLE_DATA':
      return { ...state, availableYears: action.payload };

    default:
      return state;
  }
}

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
