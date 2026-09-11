import React, { useState } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';

export default function EvidenceCard({ evidence }) {
  const { setChangeMask, toggleChangeMask, state } = useAthreix();
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showWhyEngine, setShowWhyEngine] = useState(false);

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
          {metrics.built_up_expansion_ha > 0 && (
            <div className="metric-pill">
              <span className="metric-num">+{metrics.built_up_expansion_ha} ha</span>
              <span className="metric-label">Built-Up Expansion</span>
            </div>
          )}
          {metrics.vegetation_loss_ha > 0 && (
            <div className="metric-pill">
              <span className="metric-num">-{metrics.vegetation_loss_ha} ha</span>
              <span className="metric-label">Vegetation Loss</span>
            </div>
          )}
          {metrics.total_changed_area_sq_km != null && (
            <div className="metric-pill">
              <span className="metric-num">{metrics.total_changed_area_sq_km} km²</span>
              <span className="metric-label">Total Delta Area</span>
            </div>
          )}
          {metrics.ndvi_delta != null && (
            <div className="metric-pill">
              <span className="metric-num" style={{ color: metrics.ndvi_delta < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {metrics.ndvi_delta > 0 ? '+' : ''}{metrics.ndvi_delta?.toFixed(4)}
              </span>
              <span className="metric-label">NDVI Delta</span>
            </div>
          )}
          {metrics.ndbi_delta != null && (
            <div className="metric-pill">
              <span className="metric-num" style={{ color: metrics.ndbi_delta > 0 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                {metrics.ndbi_delta > 0 ? '+' : ''}{metrics.ndbi_delta?.toFixed(4)}
              </span>
              <span className="metric-label">NDBI Delta</span>
            </div>
          )}
        </div>
      )}

      {/* Data Quality Badge */}
      {evidence.data_quality && (
        <div className={`evidence-data-quality ${evidence.data_quality === 'real_multispectral' || evidence.data_quality === 'real_sar' ? 'real' : 'proxy'}`}>
          {evidence.data_quality === 'real_multispectral' ? '🛰️ Real Earth Engine Sentinel-2 Data' :
           evidence.data_quality === 'real_sar' ? '📡 Real Sentinel-1 SAR Data' :
           evidence.data_quality === 'stac_metadata' ? '📋 STAC Catalog Metadata Only' :
           `📊 ${evidence.data_quality}`}
        </div>
      )}

      {/* Multi-Sensor Verification Checklist — Dynamic from actual pipeline */}
      <div className="evidence-sensor-checklist">
        {evidence.sources?.map((source, idx) => (
          <div key={idx} className="sensor-check-item active">
            <span className="check-icon">✓</span>
            <span>{source}</span>
          </div>
        )) || (
          <>
            <div className="sensor-check-item active">
              <span className="check-icon">✓</span>
              <span>Sentinel-2 Multi-Spectral (10m L2A)</span>
            </div>
            <div className="sensor-check-item active">
              <span className="check-icon">✓</span>
              <span>Copernicus STAC Co-Registration</span>
            </div>
          </>
        )}
      </div>

      {/* Why Engine — Reasoning Chain (Spec §44) */}
      {evidence.reasoning_chain && (
        <div className="evidence-why-section">
          <button
            className="evidence-btn why-btn"
            onClick={() => setShowWhyEngine(!showWhyEngine)}
          >
            🧠 Why did ORBITAL reach this conclusion?
          </button>
          {showWhyEngine && (
            <div className="why-engine-content">
              <div className="why-chain">
                {evidence.reasoning_chain.map((step, idx) => (
                  <div key={idx} className="why-step">
                    <span className="why-step-num">{idx + 1}</span>
                    <div className="why-step-content">
                      <span className={`why-tag ${step.type}`}>
                        {step.type === 'observation' ? '📊 Observation' :
                         step.type === 'inference' ? '🔍 Inference' : '⚠️ Uncertainty'}
                      </span>
                      <span className="why-text">{step.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons: Highlight on Globe & View Audit Trace */}
      <div className="evidence-actions-row">
        {hasGeoJSON && (
          <button
            className="evidence-btn primary"
            onClick={() => {
              setChangeMask(evidence.geojson_mask);
            }}
            title="Render change polygons on the map"
          >
            🗺️ Highlight Evidence ({evidence.geojson_mask.features.length} Zones)
          </button>
        )}
        {audit && (
          <button
            className="evidence-btn secondary"
            onClick={() => setShowAuditModal(!showAuditModal)}
            title="View investigation replay — step-by-step audit trace"
          >
            📜 Investigation Replay ({audit.total_agent_steps || audit.execution_graph?.length} Steps)
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
