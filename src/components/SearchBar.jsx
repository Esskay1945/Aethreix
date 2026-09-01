import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

const COORD_REGEX = /^[-+]?\d+\.?\d*\s*,\s*[-+]?\d+\.?\d*$/;

const QUICK_LOCATIONS = [
  { name: 'Panvel, Maharashtra', lat: 18.9894, lon: 73.1175, type: 'city' },
  { name: 'Titwala, Maharashtra', lat: 19.3, lon: 73.209, type: 'town' },
  { name: 'Mumbai, India', lat: 19.076, lon: 72.8777, type: 'metro' },
  { name: 'Navi Mumbai, Maharashtra', lat: 19.033, lon: 73.0297, type: 'city' },
  { name: 'Thane, Maharashtra', lat: 19.2183, lon: 72.9781, type: 'city' },
  { name: 'Kalyan, Maharashtra', lat: 19.2403, lon: 73.1305, type: 'city' },
  { name: 'Dombivli, Maharashtra', lat: 19.2167, lon: 73.0833, type: 'town' },
  { name: 'Pune, India', lat: 18.5204, lon: 73.8567, type: 'metro' },
  { name: 'New Delhi, India', lat: 28.6139, lon: 77.209, type: 'capital' },
  { name: 'Bengaluru, India', lat: 12.9716, lon: 77.5946, type: 'metro' },
  { name: 'Hyderabad, India', lat: 17.385, lon: 78.4867, type: 'metro' },
  { name: 'Chennai, India', lat: 13.0827, lon: 80.2707, type: 'metro' },
  { name: 'Kolkata, India', lat: 22.5726, lon: 88.3639, type: 'metro' },
  { name: 'Ahmedabad, India', lat: 23.0225, lon: 72.5714, type: 'metro' },
  { name: 'Jaipur, India', lat: 26.9124, lon: 75.7873, type: 'city' },
  { name: 'Surat, India', lat: 21.1702, lon: 72.8311, type: 'city' },
  { name: 'Nashik, India', lat: 19.9975, lon: 73.7898, type: 'city' },
  { name: 'Nagpur, India', lat: 21.1458, lon: 79.0882, type: 'city' },
  { name: 'Dubai, UAE', lat: 25.2048, lon: 55.2708, type: 'metro' },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278, type: 'metro' },
  { name: 'New York, USA', lat: 40.7128, lon: -74.006, type: 'metro' },
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, type: 'metro' },
  { name: 'Paris, France', lat: 48.8566, lon: 2.3522, type: 'metro' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, type: 'metro' },
  { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, type: 'metro' },
  { name: 'Los Angeles, USA', lat: 34.0522, lon: -118.2437, type: 'metro' },
  { name: 'Beijing, China', lat: 39.9042, lon: 116.4074, type: 'metro' },
  { name: 'Seoul, South Korea', lat: 37.5665, lon: 126.978, type: 'metro' },
];

const TYPE_ICONS = {
  capital: '🏛️',
  metro: '🏙️',
  city: '🌆',
  town: '📍',
  remote: '🌐',
  coord: '📐',
  recent: '🕐',
};

const TYPE_LABELS = {
  capital: 'Capital',
  metro: 'Metro City',
  city: 'City',
  town: 'Town',
  remote: 'Found Online',
  coord: 'Coordinates',
  recent: 'Recent',
};

function getRecentSearches() {
  try {
    return JSON.parse(sessionStorage.getItem('aethrix_recent') || '[]');
  } catch { return []; }
}

function saveRecentSearch(item) {
  try {
    const recent = getRecentSearches().filter(r => r.name !== item.name);
    recent.unshift({ name: item.name, lat: item.lat, lon: item.lon, type: 'recent' });
    sessionStorage.setItem('aethrix_recent', JSON.stringify(recent.slice(0, 6)));
  } catch { /* ignore */ }
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [nominatimResults, setNominatimResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const { flyTo } = useAthreix();

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Merged suggestions
  const allSuggestions = [
    ...suggestions,
    ...nominatimResults.filter(
      (nr) => !suggestions.some((s) => Math.abs(s.lat - nr.lat) < 0.01 && Math.abs(s.lon - nr.lon) < 0.01)
    ),
  ];

  // Live autocomplete
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);
    setActiveIndex(-1);

    if (value.length > 1) {
      const q = value.toLowerCase();
      const filtered = QUICK_LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(q)
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else if (value.length === 0) {
      // Show recent searches on empty
      const recent = getRecentSearches();
      setSuggestions(recent.length > 0 ? recent : []);
      setNominatimResults([]);
      setShowSuggestions(recent.length > 0);
    } else {
      setSuggestions([]);
      setNominatimResults([]);
      setShowSuggestions(false);
    }

    // Debounced Nominatim
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length > 2 && !COORD_REGEX.test(value.trim())) {
      setIsFetching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`,
            { headers: { 'User-Agent': 'Aethrix/1.0' } }
          );
          const data = await res.json();
          if (data.length > 0) {
            const mapped = data.map((r) => ({
              name: r.display_name.split(',').slice(0, 3).join(', ').trim(),
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon),
              type: 'remote',
              osmType: r.type,
            }));
            setNominatimResults(mapped);
            setShowSuggestions(true);
          }
        } catch {
          // Fail silently
        } finally {
          setIsFetching(false);
        }
      }, 350);
    } else {
      setIsFetching(false);
    }
  }, []);

  const navigateTo = useCallback((item) => {
    setQuery(item.name);
    setShowSuggestions(false);
    setActiveIndex(-1);
    saveRecentSearch(item);
    flyTo(item.lat, item.lon, item.name.split(',')[0]);
  }, [flyTo]);

  // Search on Enter or button click
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // If an item is highlighted, use it
    if (activeIndex >= 0 && activeIndex < allSuggestions.length) {
      navigateTo(allSuggestions[activeIndex]);
      return;
    }

    setIsLoading(true);
    setShowSuggestions(false);

    try {
      if (COORD_REGEX.test(trimmed)) {
        const [lat, lon] = trimmed.split(',').map((s) => parseFloat(s.trim()));
        saveRecentSearch({ name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon });
        flyTo(lat, lon, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        return;
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
        { headers: { 'User-Agent': 'Aethrix/1.0' } }
      );
      const results = await response.json();

      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const item = { name: display_name.split(',').slice(0, 2).join(',').trim(), lat: parseFloat(lat), lon: parseFloat(lon) };
        saveRecentSearch(item);
        flyTo(item.lat, item.lon, display_name.split(',')[0]);
      } else {
        const local = QUICK_LOCATIONS.find((l) =>
          l.name.toLowerCase().includes(trimmed.toLowerCase())
        );
        if (local) navigateTo(local);
      }
    } catch {
      const local = QUICK_LOCATIONS.find((l) =>
        l.name.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (local) navigateTo(local);
    } finally {
      setIsLoading(false);
    }
  }, [query, flyTo, activeIndex, allSuggestions, navigateTo]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveIndex(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, -1));
      }
    },
    [handleSearch, allSuggestions.length]
  );

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length === 0) {
      const recent = getRecentSearches();
      if (recent.length > 0) {
        setSuggestions(recent);
        setShowSuggestions(true);
      }
    } else if (allSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="search-container" ref={wrapperRef}>
      <div className={`search-wrapper ${isFocused ? 'focused' : ''}`}>
        <div className="search-icon-wrapper">
          {isLoading ? (
            <div className="search-spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search any place, city, or paste coordinates..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          id="search-input"
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={() => { setQuery(''); setSuggestions([]); setNominatimResults([]); setShowSuggestions(false); inputRef.current?.focus(); }}
            aria-label="Clear"
          >
            ✕
          </button>
        )}
        <button
          className="search-btn"
          onClick={handleSearch}
          disabled={isLoading}
          id="search-btn"
          aria-label="Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {showSuggestions && (allSuggestions.length > 0 || isFetching) && (
        <div className="search-dropdown">
          {isFetching && allSuggestions.length === 0 && (
            <div className="search-loading">
              <div className="shimmer-line" />
              <div className="shimmer-line short" />
              <div className="shimmer-line" />
            </div>
          )}
          {allSuggestions.length > 0 && (
            <ul className="search-results-list" role="listbox">
              {allSuggestions.map((s, i) => (
                <li
                  key={`${s.lat}-${s.lon}-${i}`}
                  className={`search-result-item ${i === activeIndex ? 'active' : ''}`}
                  onClick={() => navigateTo(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                >
                  <span className="result-icon">{TYPE_ICONS[s.type] || '📍'}</span>
                  <div className="result-info">
                    <span className="result-name">{s.name}</span>
                    <span className="result-meta">
                      {TYPE_LABELS[s.type] || 'Location'} • {s.lat.toFixed(4)}°, {s.lon.toFixed(4)}°
                    </span>
                  </div>
                  <svg className="result-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </li>
              ))}
            </ul>
          )}
          {isFetching && allSuggestions.length > 0 && (
            <div className="search-fetching-indicator">
              <div className="search-spinner small" />
              <span>Searching globally...</span>
            </div>
          )}
          <div className="search-footer">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      )}
    </div>
  );
}
