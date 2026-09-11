import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * TemporalCompare — Before/After comparison modes (Spec §19)
 * 
 * Modes:
 * - Swipe: draggable vertical divider between two years
 * - Flicker: rapidly alternating between dates
 * - Side-by-side: two synchronized map views
 */
export default function TemporalCompare() {
  const { state, dispatch } = useAthreix();
  const { temporalCompare } = state;
  const [mode, setMode] = useState('swipe'); // swipe | flicker | sidebyside
  const [swipePosition, setSwipePosition] = useState(50);
  const [flickerState, setFlickerState] = useState('before');
  const [flickerSpeed, setFlickerSpeed] = useState(800);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const flickerInterval = useRef(null);

  if (!temporalCompare?.active) return null;

  const { beforeYear, afterYear, beforeTileUrl, afterTileUrl } = temporalCompare;

  // Swipe drag handling
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSwipePosition(Math.max(5, Math.min(95, x)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Flicker auto-toggle
  useEffect(() => {
    if (mode === 'flicker') {
      flickerInterval.current = setInterval(() => {
        setFlickerState(prev => prev === 'before' ? 'after' : 'before');
      }, flickerSpeed);
      return () => clearInterval(flickerInterval.current);
    }
    return () => {};
  }, [mode, flickerSpeed]);

  const handleClose = () => {
    dispatch({ type: 'SET_TEMPORAL_COMPARE', payload: { active: false } });
  };

  return (
    <div className="temporal-compare glass-panel" ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="temporal-header">
        <div className="temporal-title">
          <span className="temporal-icon">⏱️</span>
          <span>Temporal Comparison</span>
        </div>
        <div className="temporal-modes">
          <button
            className={`temporal-mode-btn ${mode === 'swipe' ? 'active' : ''}`}
            onClick={() => setMode('swipe')}
            title="Swipe between dates"
          >
            ↔️ Swipe
          </button>
          <button
            className={`temporal-mode-btn ${mode === 'flicker' ? 'active' : ''}`}
            onClick={() => setMode('flicker')}
            title="Rapidly alternate between dates"
          >
            ⚡ Flicker
          </button>
          <button
            className={`temporal-mode-btn ${mode === 'sidebyside' ? 'active' : ''}`}
            onClick={() => setMode('sidebyside')}
            title="Side-by-side comparison"
          >
            ◻️◻️ Side by Side
          </button>
          <button className="temporal-close-btn" onClick={handleClose}>✕</button>
        </div>
      </div>

      {/* Comparison Area */}
      <div className="temporal-comparison-area">
        {mode === 'swipe' && (
          <div className="temporal-swipe">
            <div className="swipe-before" style={{ clipPath: `inset(0 ${100 - swipePosition}% 0 0)` }}>
              <div className="swipe-label before-label">{beforeYear}</div>
              {beforeTileUrl ? (
                <img src={beforeTileUrl} alt={`${beforeYear}`} className="swipe-img" />
              ) : (
                <div className="swipe-placeholder">
                  <span>{beforeYear} Imagery</span>
                  <span className="swipe-hint">Sentinel-2 Composite</span>
                </div>
              )}
            </div>
            <div className="swipe-after">
              <div className="swipe-label after-label">{afterYear}</div>
              {afterTileUrl ? (
                <img src={afterTileUrl} alt={`${afterYear}`} className="swipe-img" />
              ) : (
                <div className="swipe-placeholder after">
                  <span>{afterYear} Imagery</span>
                  <span className="swipe-hint">Sentinel-2 Composite</span>
                </div>
              )}
            </div>
            <div
              className="swipe-handle"
              style={{ left: `${swipePosition}%` }}
              onMouseDown={handleMouseDown}
            >
              <div className="swipe-handle-grip">
                <span>◀</span>
                <div className="swipe-handle-line" />
                <span>▶</span>
              </div>
            </div>
          </div>
        )}

        {mode === 'flicker' && (
          <div className="temporal-flicker">
            <div className={`flicker-panel ${flickerState === 'before' ? 'visible' : ''}`}>
              <div className="swipe-label before-label">{beforeYear}</div>
              <div className="swipe-placeholder">
                <span>{beforeYear} — Flicker Mode</span>
              </div>
            </div>
            <div className={`flicker-panel ${flickerState === 'after' ? 'visible' : ''}`}>
              <div className="swipe-label after-label">{afterYear}</div>
              <div className="swipe-placeholder after">
                <span>{afterYear} — Flicker Mode</span>
              </div>
            </div>
            <div className="flicker-controls">
              <span>Speed:</span>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={flickerSpeed}
                onChange={(e) => setFlickerSpeed(parseInt(e.target.value))}
              />
              <span>{flickerSpeed}ms</span>
            </div>
          </div>
        )}

        {mode === 'sidebyside' && (
          <div className="temporal-sidebyside">
            <div className="sidebyside-panel">
              <div className="swipe-label before-label">{beforeYear}</div>
              <div className="swipe-placeholder">
                <span>{beforeYear}</span>
                <span className="swipe-hint">Sentinel-2 Composite</span>
              </div>
            </div>
            <div className="sidebyside-divider" />
            <div className="sidebyside-panel">
              <div className="swipe-label after-label">{afterYear}</div>
              <div className="swipe-placeholder after">
                <span>{afterYear}</span>
                <span className="swipe-hint">Sentinel-2 Composite</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Year Labels Footer */}
      <div className="temporal-footer">
        <span className="temporal-year before">{beforeYear}</span>
        <span className="temporal-vs">vs</span>
        <span className="temporal-year after">{afterYear}</span>
      </div>
    </div>
  );
}
