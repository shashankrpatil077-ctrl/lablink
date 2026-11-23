'use client';

import { useEffect, useRef } from 'react';
import type { UISimulationResult } from '@/lib/frontendApi';

interface Props {
  open: boolean;
  loading: boolean;
  data: UISimulationResult | null;
  error: string | null;
  onClose: () => void;
}

export function ConflictSimulatorModal({ open, loading, data, error, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <div>
            <h2 id="sim-dialog-title" className="section-title">
              Peak Contention <span className="font-dot" style={{ color: 'var(--rose-accent)' }}>Conflict</span> Solver
            </h2>
            <p className="section-sub">
              Deterministic 40% Deadline Urgency · 30% Spec Fit · 30% Anti-Hoarding Fairness
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn-secondary"
            onClick={onClose}
            aria-label="Close peak contention simulator"
          >
            Close (Esc)
          </button>
        </div>

        {loading && <p role="status">Running 3-way peak contention simulation...</p>}
        {error && (
          <p role="alert" className="badge badge-err">
            {error}
          </p>
        )}

        {data && !loading && (
          <div>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-secondary)' }}>
              <strong>Contested Resource:</strong> {data.equipmentName} ({data.department}) ·{' '}
              <span className="font-mono">{data.slotLabel}</span>
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              {data.entries.map((entry, idx) => (
                <div
                  key={`${entry.studentName}-${entry.projectTitle}-${idx}`}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 16,
                    background: entry.status === 'Winner' ? '#fff1f2' : '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <span
                        className={`badge ${entry.status === 'Winner' ? 'badge-ok' : 'badge-warn'}`}
                      >
                        {entry.status}
                      </span>
                      <h3 style={{ margin: '6px 0 2px', fontSize: 16 }}>{entry.projectTitle}</h3>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                        {entry.studentName} · {entry.deadlineLabel}
                      </p>
                    </div>
                    <div className="font-dot" style={{ fontSize: 28, color: 'var(--ink)' }}>
                      {entry.priorityScore}
                      <span className="font-mono" style={{ fontSize: 12, marginLeft: 4 }}>
                        /100
                      </span>
                    </div>
                  </div>

                  <div className="score-bar" aria-hidden="true">
                    <div
                      className="score-seg-urgency"
                      style={{ width: `${entry.scoreBreakdown.deadlineUrgency}%` }}
                    />
                    <div
                      className="score-seg-fit"
                      style={{ width: `${entry.scoreBreakdown.specFit}%` }}
                    />
                    <div
                      className="score-seg-fairness"
                      style={{ width: `${entry.scoreBreakdown.fairnessScore}%` }}
                    />
                  </div>

                  <div className="font-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>Urgency: {entry.scoreBreakdown.deadlineUrgency}/40</span>
                    <span>Spec Fit: {entry.scoreBreakdown.specFit}/30</span>
                    <span>Fairness: {entry.scoreBreakdown.fairnessScore}/30</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px solid var(--border)',
              }}
            >
              <strong style={{ fontSize: 13.5 }}>Gemini Fairness Explanation</strong>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-secondary)' }}>
                {data.aiExplanation}
              </p>
            </div>

            {data.alternatives.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Recommended Feasible Alternatives</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.alternatives.map((alt, i) => (
                    <div
                      key={`${alt.equipmentId}-${i}`}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 13.5,
                      }}
                    >
                      <strong>{alt.equipmentName}</strong> ({alt.department}) — {alt.matchReason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
