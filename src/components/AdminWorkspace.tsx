'use client';

import type { UIAnalytics } from '@/lib/frontendApi';

interface Props {
  analytics: UIAnalytics | null;
}

export function AdminWorkspace({ analytics }: Props) {
  if (!analytics) {
    return (
      <section className="panel" aria-label="Lab admin analytics">
        <p role="status">Loading live campus utilization analytics...</p>
      </section>
    );
  }

  const barColors = ['#be123c', '#6d28d9', '#d9480f', '#0f766e', '#1d4ed8'];

  return (
    <section aria-labelledby="admin-dashboard-heading">
      <div className="kpi-grid">
        <div className="kpi-box">
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Campus Utilization</div>
          <div className="font-dot" style={{ fontSize: 34, color: 'var(--rose-accent)', marginTop: 6 }}>
            {analytics.campusUtilizationPct}%
          </div>
        </div>
        <div className="kpi-box">
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Active Bookings</div>
          <div className="font-dot" style={{ fontSize: 34, color: 'var(--violet-accent)', marginTop: 6 }}>
            {analytics.activeBookings}
          </div>
        </div>
        <div className="kpi-box">
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Waitlist Pressure</div>
          <div className="font-dot" style={{ fontSize: 34, color: 'var(--coral-accent)', marginTop: 6 }}>
            {analytics.activeWaitlist}
          </div>
        </div>
        <div className="kpi-box">
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Idle Kits to Share</div>
          <div className="font-dot" style={{ fontSize: 34, color: 'var(--ink)', marginTop: 6 }}>
            {analytics.underutilizedCount}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <h2 id="admin-dashboard-heading" className="section-title" style={{ marginBottom: 14 }}>
          Department Resource Utilization
        </h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {analytics.departmentUtilization.map((row, idx) => (
            <div key={row.department}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <strong>{row.department}</strong>
                <span className="font-mono">{row.utilizationPct}%</span>
              </div>
              <div style={{ height: 12, background: '#e4e4e7', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, row.utilizationPct)}%`,
                    background: barColors[idx % barColors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
          Underutilized Kits Flagged for Cross-Department Sharing (&lt;35%)
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Home Department</th>
                <th>Utilization</th>
                <th>Shareable Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {analytics.underutilizedKits.map((kit) => (
                <tr key={kit.id}>
                  <td><strong>{kit.name}</strong></td>
                  <td>{kit.department}</td>
                  <td className="font-mono">{kit.utilizationPct}%</td>
                  <td>
                    <div className="chip-row" style={{ marginTop: 0 }}>
                      {kit.capabilities.map((c) => (
                        <span key={c} className="badge badge-dept font-mono" style={{ fontSize: 11.5 }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
