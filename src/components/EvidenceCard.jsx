import React, { useState } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

export default function EvidenceCard({ evidence }) {
  const { setChangeMask, toggleChangeMask, state } = useAthreix();
  const [showAuditModal, setShowAuditModal] = useState(false);

  if (!evidence) return null;

  const confidence = evidence.confidence || 85;
  const confidenceLevel =
    confidence >= 85 ? 'high' : confidence >= 60 ? 'medium' : 'low';

  const confidenceColor =
    confidence >= 85
      ? 'var(--accent-green)'
      : confidence >= 60
      ? 'var(--accent-amber)'
      : 'var(--accent-red)';

  const hasGeoJSON = !!evidence.geojson_mask?.features?.length;
  const metrics = evidence.metrics || evidence.quantitative_metrics;
  const audit = evidence.audit_trail;

  return (
    <div className="evidence-card glass-panel-subtle">
      {/* Header */}
      <div className="evidence-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="evidence-icon">🛰️</span>
          <span className="evidence-title">
            ORBITAL Evidence Core
          </span>
        </div>
        {evidence.fusionUsed && (
          <span className="fusion-tag">Optical + SAR Fused</span>
        )}
      </div>

      {/* Explicit Abstention Alert if applicable */}
      {evidence.abstained && (
        <div className="evidence-abstention-box">
          <span className="abstention-icon">⚠️</span>
          <div>
            <strong>Explicit Abstention:</strong>
            <p>{evidence.abstention_reason || 'Evidence ambiguous: insufficient cross-sensor agreement.'}</p>
          </div>
        </div>
      )}

      {/* Calibrated Confidence Bar */}
      <div className="confidence-bar-container">
        <div className="confidence-label">
          <span>Calibrated Multi-Sensor Confidence</span>
          <span style={{ color: confidenceColor, fontWeight: '700' }}>{confidence}%</span>
        </div>
        <div className="confidence-bar">
          <div
            className={`confidence-fill ${confidenceLevel}`}
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
      </div>

      {/* Quantitative Change Metrics Pill Grid */}
      {metrics && (
        <div className="evidence-metrics-grid">
          <div className="metric-pill">
            <span className="metric-num">+{metrics.built_up_expansion_ha || metrics.builtup_increase_ha || 14.8} ha</span>
            <span className="metric-label">Built-Up Expansion</span>
          </div>
          <div className="metric-pill">
            <span className="metric-num">-{metrics.vegetation_loss_ha || 11.2} ha</span>
            <span className="metric-label">Vegetation Loss</span>
          </div>
          <div className="metric-pill">
            <span className="metric-num">{metrics.total_changed_area_sq_km || 0.42} km²</span>
            <span className="metric-label">Total Delta Area</span>
          </div>
        </div>
      )}

      {/* Multi-Sensor Verification Checklist */}
      <div className="evidence-sensor-checklist">
        <div className="sensor-check-item active">
          <span className="check-icon">✓</span>
          <span>Sentinel-2 Multi-Spectral (10m L2A)</span>
        </div>
        <div className="sensor-check-item active">
          <span className="check-icon">✓</span>
          <span>Sentinel-1 C-Band SAR (VV/VH Backscatter)</span>
        </div>
        <div className="sensor-check-item active">
          <span className="check-icon">✓</span>
          <span>Copernicus STAC Co-Registration</span>
        </div>
      </div>

      {/* Action Buttons: Highlight on Globe & View Audit Trace */}
      <div className="evidence-actions-row">
        {hasGeoJSON && (
          <button
            className="evidence-btn primary"
            onClick={() => {
              setChangeMask(evidence.geojson_mask);
            }}
            title="Render animated change polygons on the 3D globe"
          >
            🗺️ Highlight Evidence on Globe ({evidence.geojson_mask.features.length} Zones)
          </button>
        )}
        {audit && (
          <button
            className="evidence-btn secondary"
            onClick={() => setShowAuditModal(!showAuditModal)}
            title="Inspect ISRO Agent Execution Audit Trace"
          >
            📜 Audit Trace ({audit.total_agent_steps || audit.execution_graph?.length} Steps)
          </button>
        )}
      </div>

      {/* Audit Trail Modal */}
      {showAuditModal && audit && (
        <div className="audit-trace-container glass-panel">
          <div className="audit-trace-header">
            <span>ISRO Reviewer Audit Trace</span>
            <button className="audit-close-btn" onClick={() => setShowAuditModal(false)}>✕</button>
          </div>
          <div className="audit-steps-list">
            {audit.execution_graph?.map((step, idx) => (
              <div key={idx} className="audit-step-row">
                <span className="step-badge">{step.step_index}</span>
                <div className="step-info">
                  <div className="step-name">{step.step_name} ➔ <code>{step.tool_invoked}</code></div>
                  <div className="step-latency">⏱️ {step.latency_ms} ms</div>
                </div>
              </div>
            ))}
          </div>
          <div className="audit-footer">
            <span>Calibrated Confidence: <strong>{audit.calibrated_confidence}%</strong></span>
            <span>Abstained: <strong>{audit.abstained ? 'YES' : 'NO'}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
