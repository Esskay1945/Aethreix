import React, { useEffect, useRef, useState } from 'react';
import { useAthreix } from '../../context/AthreixContext.jsx';

/**
 * MissionTracker — Shows live mission progress with step-by-step updates.
 * 
 * Displays a vertical pipeline of specialist steps with animated status
 * indicators (✓ done, ◉ running, ○ pending). Auto-opens when a mission
 * starts and shows results when complete.
 */
export default function MissionTracker() {
  const { state, dispatch } = useAthreix();
  const { activeMission } = state;
  const scrollRef = useRef(null);
  const [minimized, setMinimized] = useState(false);

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMission?.steps?.length]);

  if (!activeMission) return null;

  const { query, status, progress, steps } = activeMission;
  const isComplete = status === 'complete';
  const isRunning = status === 'running';

  return (
    <div className={`mission-tracker glass-panel ${minimized ? 'minimized' : ''}`}>
      {/* Header */}
      <div className="mission-tracker-header">
        <div className="mission-tracker-title">
          <div className={`mission-status-dot ${isComplete ? 'complete' : isRunning ? 'running' : 'idle'}`} />
          <span className="mission-label">
            {isComplete ? 'Mission Complete' : isRunning ? 'Mission Active' : 'Mission'}
          </span>
        </div>
        <div className="mission-tracker-actions">
          <button
            className="mission-minimize-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '△' : '▽'}
          </button>
          {isComplete && (
            <button
              className="mission-close-btn"
              onClick={() => dispatch({ type: 'CLEAR_MISSION' })}
              title="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!minimized && (
        <>
          {/* Query display */}
          <div className="mission-query">
            <span className="mission-query-text">{query}</span>
          </div>

          {/* Progress bar */}
          <div className="mission-progress-track">
            <div
              className="mission-progress-fill"
              style={{ width: `${progress || 0}%` }}
            />
            <span className="mission-progress-label">{progress || 0}%</span>
          </div>

          {/* Steps pipeline */}
          <div className="mission-steps" ref={scrollRef}>
            {steps && steps.map((step, i) => (
              <div
                key={i}
                className={`mission-step ${step.status === 'done' ? 'done' : step.status === 'running' ? 'running' : 'pending'}`}
              >
                <div className="mission-step-indicator">
                  {step.status === 'done' ? (
                    <span className="step-icon done">✓</span>
                  ) : step.status === 'running' ? (
                    <span className="step-icon running">◉</span>
                  ) : (
                    <span className="step-icon pending">○</span>
                  )}
                  {i < steps.length - 1 && <div className="step-connector" />}
                </div>
                <div className="mission-step-content">
                  <span className="step-name">{step.name}</span>
                  {step.data_quality && (
                    <span className={`step-badge ${step.data_quality === 'real_multispectral' || step.data_quality === 'real_sar' ? 'real' : 'proxy'}`}>
                      {step.data_quality === 'real_multispectral' ? 'EE Real Data' :
                       step.data_quality === 'real_sar' ? 'SAR Real Data' :
                       step.data_quality}
                    </span>
                  )}
                  {step.data_status && (
                    <span className={`step-badge ${step.data_status === 'real_multispectral' ? 'real' : 'proxy'}`}>
                      {step.data_status === 'real_multispectral' ? 'EE Real Data' : step.data_status}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Running indicator */}
            {isRunning && (
              <div className="mission-step running">
                <div className="mission-step-indicator">
                  <span className="step-icon running pulse">◉</span>
                </div>
                <div className="mission-step-content">
                  <span className="step-name thinking">Processing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Confidence badge on completion */}
          {isComplete && activeMission.results && (
            <div className="mission-result-summary">
              <div className="confidence-badge">
                <span className="confidence-label">Confidence</span>
                <span className="confidence-value">{activeMission.results.confidence || 0}%</span>
              </div>
              <div className="data-quality-badge">
                {activeMission.results.agent_metadata?.data_quality === 'real_multispectral'
                  ? '🛰️ Real Earth Engine Data'
                  : '📊 Analysis Complete'}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
