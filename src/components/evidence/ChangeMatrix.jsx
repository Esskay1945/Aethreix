import React from 'react';

/**
 * ChangeMatrix — Change Transition Matrix (Spec §95)
 * 
 * Shows a from→to classification table for land cover changes.
 * Rendered as a heatmap-style matrix.
 */
export default function ChangeMatrix({ matrix }) {
  if (!matrix) return null;

  const classes = matrix.classes || ['Built-up', 'Water', 'Vegetation', 'Bare Soil'];
  const data = matrix.data || [];
  const period = matrix.period || '';

  if (data.length === 0) return null;

  const getHeatColor = (value) => {
    if (value > 70) return 'rgba(105, 240, 174, 0.4)';
    if (value > 30) return 'rgba(255, 209, 102, 0.3)';
    if (value > 10) return 'rgba(255, 138, 101, 0.3)';
    if (value > 0) return 'rgba(255, 82, 82, 0.2)';
    return 'transparent';
  };

  return (
    <div className="change-matrix glass-panel-subtle">
      <div className="change-matrix-header">
        <span className="change-matrix-title">📊 Change Transition Matrix</span>
        {period && <span className="change-matrix-period">{period}</span>}
      </div>

      <div className="change-matrix-table-wrapper">
        <table className="change-matrix-table">
          <thead>
            <tr>
              <th className="matrix-corner">From ↓ / To →</th>
              {classes.map((cls, i) => (
                <th key={i} className="matrix-col-header">{cls}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri}>
                <td className="matrix-row-header">{classes[ri]}</td>
                {row.map((val, ci) => (
                  <td
                    key={ci}
                    className={`matrix-cell ${ri === ci ? 'diagonal' : ''}`}
                    style={{ background: getHeatColor(val) }}
                  >
                    {val}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="change-matrix-legend">
        <span className="matrix-legend-item">
          <span className="matrix-legend-dot" style={{ background: 'rgba(105, 240, 174, 0.6)' }} />
          Stable (&gt;70%)
        </span>
        <span className="matrix-legend-item">
          <span className="matrix-legend-dot" style={{ background: 'rgba(255, 209, 102, 0.6)' }} />
          Moderate
        </span>
        <span className="matrix-legend-item">
          <span className="matrix-legend-dot" style={{ background: 'rgba(255, 82, 82, 0.4)' }} />
          Significant Change
        </span>
      </div>
    </div>
  );
}
