import React from 'react';

export default function EvidenceCard({ evidence }) {
  if (!evidence) return null;

  const confidenceLevel =
    evidence.confidence >= 85 ? 'high' : evidence.confidence >= 65 ? 'medium' : 'low';

  const confidenceColor =
    evidence.confidence >= 85
      ? 'var(--accent-green)'
      : evidence.confidence >= 65
      ? 'var(--accent-amber)'
      : 'var(--accent-red)';

  return (
    <div className="evidence-card">
      <div className="evidence-header">
        <span className="evidence-icon">
          {evidence.type === 'change_detection' && '🔄'}
          {evidence.type === 'construction_detection' && '🏗️'}
          {evidence.type === 'vegetation_analysis' && '🌿'}
          {evidence.type === 'water_analysis' && '💧'}
          {evidence.type === 'disaster_assessment' && '⚠️'}
          {evidence.type === 'object_detection' && '🔍'}
          {evidence.type === 'scene_description' && '🛰️'}
        </span>
        <span>
          {evidence.type
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      </div>

      {/* Confidence Bar */}
      <div className="confidence-bar-container">
        <div className="confidence-label">
          <span>Confidence</span>
          <span style={{ color: confidenceColor }}>{evidence.confidence}%</span>
        </div>
        <div className="confidence-bar">
          <div
            className={`confidence-fill ${confidenceLevel}`}
            style={{ width: `${evidence.confidence}%` }}
          ></div>
        </div>
      </div>

      {/* Timeline visualization for change/construction */}
      {evidence.timeline && (
        <div className="evidence-timeline">
          {evidence.timeline.map((item) => (
            <div
              key={item.year}
              className={`timeline-year ${item.status}`}
              title={`${item.year}: ${item.status.replace('-', ' ')}`}
            >
              {item.year.toString().slice(-2)}
            </div>
          ))}
        </div>
      )}

      {/* Data sources */}
      {evidence.sources && (
        <div className="evidence-fusion">
          {evidence.sources.map((source, i) => (
            <span
              key={i}
              className={`fusion-badge ${
                source.includes('SAR') ? 'sar' : 'optical'
              }`}
            >
              {source.includes('SAR') ? '📡 SAR' : '🛰️ Optical'}
            </span>
          ))}
          {evidence.fusionUsed && (
            <span style={{ color: 'var(--accent-cyan)', fontSize: '10px' }}>
              ✓ Multi-sensor fusion
            </span>
          )}
        </div>
      )}
    </div>
  );
}
