import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';
import { getDataAvailability } from '../services/EODataService.js';

/**
 * TimelinePanel — Data-driven temporal navigation.
 * 
 * Shows actual sensor availability per year. Never claims data exists
 * when it doesn't. Sentinel-2 starts 2015, Sentinel-1 starts 2014,
 * Landsat-8 starts 2013.
 */
export default function TimelinePanel() {
  const { state, dispatch } = useAthreix();
  const { availableData, selectedYear, location } = state;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedYear);
  const pickerRef = useRef(null);

  // Fetch real data availability when location changes
  useEffect(() => {
    const fetchAvailability = async () => {
      if (location.cameraAlt < 500000) {
        const data = await getDataAvailability(location.lat, location.lon);
        dispatch({ type: 'SET_AVAILABLE_DATA', payload: data });
      }
    };

    const debounce = setTimeout(fetchAvailability, 1500);
    return () => clearTimeout(debounce);
  }, [location.lat, location.lon, location.cameraAlt, dispatch]);

  // Close date picker on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleYearClick = useCallback(
    (year) => {
      dispatch({ type: 'SET_SELECTED_YEAR', payload: year });
    },
    [dispatch]
  );

  const handlePickerSubmit = useCallback(() => {
    const y = Math.max(2013, Math.min(2026, pickerYear));
    dispatch({ type: 'SET_SELECTED_YEAR', payload: y });
    setShowDatePicker(false);
  }, [pickerYear, dispatch]);

  const handlePickerKeyDown = (e) => {
    if (e.key === 'Enter') handlePickerSubmit();
    if (e.key === 'Escape') setShowDatePicker(false);
  };

  // Build year range from available data or known sensor dates
  const years = availableData.length > 0
    ? availableData
    : getDefaultYears();

  return (
    <div className="timeline-panel glass-panel">
      <div className="timeline-content">
        <div className="timeline-header">
          <span className="timeline-title">Temporal Navigator</span>
          <div className="timeline-header-right">
            <span className="timeline-selected-date">{selectedYear}</span>
            <div className="calendar-picker-container" ref={pickerRef}>
              <button
                className="calendar-btn"
                onClick={() => { setPickerYear(selectedYear); setShowDatePicker(!showDatePicker); }}
                title="Jump to specific year"
                aria-label="Open year picker"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                </svg>
              </button>

              {showDatePicker && (
                <div className="year-picker-dropdown glass-panel extended-grid">
                  <div className="picker-title">Jump to Year</div>
                  <div className="picker-input-row">
                    <button
                      className="picker-arrow-btn"
                      onClick={() => setPickerYear(y => Math.max(2013, y - 1))}
                    >
                      ‹
                    </button>
                    <input
                      type="number"
                      className="picker-year-input"
                      value={pickerYear}
                      onChange={(e) => setPickerYear(parseInt(e.target.value) || 2024)}
                      onKeyDown={handlePickerKeyDown}
                      min="2013"
                      max="2026"
                      autoFocus
                    />
                    <button
                      className="picker-arrow-btn"
                      onClick={() => setPickerYear(y => Math.min(2026, y + 1))}
                    >
                      ›
                    </button>
                  </div>
                  <div className="picker-year-grid compact">
                    {years.map((item) => (
                      <button
                        key={item.year}
                        className={`picker-year-cell ${item.year === pickerYear ? 'selected' : ''} ${item.year === selectedYear ? 'current' : ''}`}
                        onClick={() => {
                          setPickerYear(item.year);
                          dispatch({ type: 'SET_SELECTED_YEAR', payload: item.year });
                          setShowDatePicker(false);
                        }}
                      >
                        {item.year}
                      </button>
                    ))}
                  </div>
                  <button
                    className="picker-go-btn"
                    onClick={handlePickerSubmit}
                  >
                    Go to {pickerYear}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="timeline-track">
          <div className="timeline-line"></div>
          <div className="timeline-marks">
            {years.map((item) => {
              const hasSentinel2 = item.sensors?.some(s => s.name === 'Sentinel-2');
              const hasSentinel1 = item.sensors?.some(s => s.name === 'Sentinel-1 SAR');
              const hasLandsat = item.sensors?.some(s => s.name === 'Landsat-8');
              const hasRealData = item.hasData === true;

              return (
                <div
                  key={item.year}
                  className={`timeline-mark ${
                    item.year === selectedYear ? 'active' : ''
                  } ${hasRealData ? 'has-data' : ''} ${
                    hasSentinel2 ? 'available' : ''
                  } ${hasSentinel1 ? 'sar-available' : ''}`}
                  onClick={() => handleYearClick(item.year)}
                  title={buildTooltip(item)}
                >
                  <div className="timeline-dot"></div>
                  <span className="timeline-year-label">{item.year}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="timeline-legend">
          <div className="legend-item">
            <span className="legend-dot optical"></span>
            <span>Sentinel-2 (2015+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot sar"></span>
            <span>Sentinel-1 SAR (2014+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot landsat"></span>
            <span>Landsat-8 (2013+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot active"></span>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultYears() {
  const result = [];
  for (let y = 2013; y <= 2026; y++) {
    const sensors = [];
    if (y >= 2013) sensors.push({ name: 'Landsat-8', count: null, avgCloudCover: null });
    if (y >= 2014) sensors.push({ name: 'Sentinel-1 SAR', count: null, avgCloudCover: null });
    if (y >= 2015) sensors.push({ name: 'Sentinel-2', count: null, avgCloudCover: null });
    result.push({ year: y, sensors, hasData: null });
  }
  return result;
}

function buildTooltip(item) {
  const parts = [`${item.year}`];
  if (item.sensors) {
    for (const s of item.sensors) {
      const countStr = s.count !== null ? ` (${s.count} scenes)` : '';
      const ccStr = s.avgCloudCover !== null ? ` | Cloud: ${Math.round(s.avgCloudCover)}%` : '';
      parts.push(`${s.name}${countStr}${ccStr}`);
    }
  }
  if (item.hasData === null) {
    parts.push('Data availability: checking...');
  }
  return parts.join('\n');
}
