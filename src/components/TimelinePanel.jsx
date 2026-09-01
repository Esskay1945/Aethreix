import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';
import { getDataAvailability } from '../services/EODataService.js';

export default function TimelinePanel() {
  const { state, dispatch } = useAthreix();
  const { availableYears, selectedYear, location } = state;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedYear);
  const pickerRef = useRef(null);

  // Fetch real data availability when location changes significantly
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
    const y = Math.max(2005, Math.min(2026, pickerYear));
    dispatch({ type: 'SET_SELECTED_YEAR', payload: y });
    setShowDatePicker(false);
  }, [pickerYear, dispatch]);

  const handlePickerKeyDown = (e) => {
    if (e.key === 'Enter') handlePickerSubmit();
    if (e.key === 'Escape') setShowDatePicker(false);
  };

  const ALL_YEARS = Array.from({ length: 2026 - 2005 + 1 }, (_, i) => 2005 + i);

  return (
    <div className="timeline-panel glass-panel">
      <div className="timeline-content">
        <div className="timeline-header">
          <span className="timeline-title">Temporal Archive (2005–2026)</span>
          <div className="timeline-header-right">
            <span className="timeline-selected-date">{selectedYear}</span>
            {/* Calendar Icon Button */}
            <div className="calendar-picker-container" ref={pickerRef}>
              <button
                className="calendar-btn"
                onClick={() => { setPickerYear(selectedYear); setShowDatePicker(!showDatePicker); }}
                title="Jump to specific year (2005 - 2026)"
                aria-label="Open year picker"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                  <path d="M8 14h.01" />
                  <path d="M12 14h.01" />
                  <path d="M16 14h.01" />
                  <path d="M8 18h.01" />
                  <path d="M12 18h.01" />
                </svg>
              </button>

              {showDatePicker && (
                <div className="year-picker-dropdown glass-panel extended-grid">
                  <div className="picker-title">Jump to Year (2005–2026)</div>
                  <div className="picker-input-row">
                    <button
                      className="picker-arrow-btn"
                      onClick={() => setPickerYear(y => Math.max(2005, y - 1))}
                    >
                      ‹
                    </button>
                    <input
                      type="number"
                      className="picker-year-input"
                      value={pickerYear}
                      onChange={(e) => setPickerYear(parseInt(e.target.value) || 2024)}
                      onKeyDown={handlePickerKeyDown}
                      min="2005"
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
                    {ALL_YEARS.map((y) => (
                      <button
                        key={y}
                        className={`picker-year-cell ${y === pickerYear ? 'selected' : ''} ${y === selectedYear ? 'current' : ''}`}
                        onClick={() => { setPickerYear(y); dispatch({ type: 'SET_SELECTED_YEAR', payload: y }); setShowDatePicker(false); }}
                      >
                        {y}
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
            {availableYears.map((item) => (
              <div
                key={item.year}
                className={`timeline-mark ${
                  item.year === selectedYear ? 'active' : ''
                } ${item.optical ? 'available' : ''} ${
                  item.sar ? 'sar-available' : ''
                }`}
                onClick={() => handleYearClick(item.year)}
                title={`${item.year}${item.optical ? ' | Optical ✓' : ''}${
                  item.sar ? ' | SAR ✓' : ''
                }`}
              >
                <div className="timeline-dot"></div>
                <span className="timeline-year-label">{item.year}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="timeline-legend">
          <div className="legend-item">
            <span className="legend-dot optical"></span>
            <span>Sentinel-2 Optical</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot sar"></span>
            <span>Sentinel-1 SAR</span>
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
