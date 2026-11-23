'use client';

import { useState } from 'react';
import {
  decideBooking,
  formatIST,
  type UIBooking,
  type UIEquipment,
} from '@/lib/frontendApi';

interface Props {
  facultyDepartment: 'Robotics' | 'ECE';
  bookings: UIBooking[];
  equipment: UIEquipment[];
  onRefresh: () => void;
}

export function FacultyWorkspace({ facultyDepartment, bookings, equipment, onRefresh }: Props) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const eqById = new Map(equipment.map((e) => [e.id, e]));

  async function handleDecision(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    setFeedback(null);
    try {
      const note =
        reasons[id]?.trim() ||
        (action === 'approve'
          ? 'Verified safety certification and capstone alignment.'
          : 'Requested slot conflicts with scheduled lab session.');
      await decideBooking(id, action, note);
      setFeedback(`Request ${id} marked as ${action}d.`);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="faculty-queue-heading">
      <div className="section-head">
        <div>
          <h2 id="faculty-queue-heading" className="section-title">
            Faculty Project-Access Approval Queue
          </h2>
          <p className="section-sub">
            Signed in as <strong>Faculty · {facultyDepartment}</strong> — Server-enforced department isolation (RBAC).
          </p>
        </div>
        <span className="badge badge-warn">Scope: {facultyDepartment} Lab Equipment</span>
      </div>

      <div aria-live="polite" style={{ marginBottom: 14 }}>
        {feedback && <span className="badge badge-ok">{feedback}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project &amp; Student</th>
              <th>Equipment &amp; Slot (IST)</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Faculty Decision</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b, idx) => {
              const eq = eqById.get(b.equipmentId);
              const dept = b.equipmentDepartment ?? eq?.department ?? 'Robotics';
              const inScope = dept === facultyDepartment;
              return (
                <tr key={b.id || `booking-${idx}`}>
                  <td>
                    <strong>{b.projectTitle}</strong>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                      {b.studentName} ({b.studentDepartment}) · Safety Cert:{' '}
                      {b.hasSafetyCert ? 'Verified' : 'Missing'}
                    </div>
                  </td>
                  <td>
                    <div>{b.equipmentName ?? eq?.name ?? b.equipmentId}</div>
                    <div className="font-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {formatIST(b.slotStartIso)} · {dept}
                    </div>
                  </td>
                  <td className="font-dot" style={{ fontSize: 18 }}>
                    {b.priorityScore}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        b.status === 'approved'
                          ? 'badge-ok'
                          : b.status === 'rejected'
                            ? 'badge-err'
                            : 'badge-warn'
                      }`}
                    >
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {inScope ? (
                      <div style={{ display: 'grid', gap: 6, minWidth: 210 }}>
                        <label htmlFor={`reason-${b.id}`} className="skip-link">
                          Decision reason for {b.projectTitle}
                        </label>
                        <input
                          id={`reason-${b.id}`}
                          type="text"
                          className="text-input"
                          style={{ padding: '6px 10px', fontSize: 12.5 }}
                          placeholder="Optional decision note..."
                          value={reasons[b.id] ?? ''}
                          onChange={(e) =>
                            setReasons((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            disabled={busyId === b.id}
                            onClick={() => void handleDecision(b.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            disabled={busyId === b.id}
                            onClick={() => void handleDecision(b.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="badge badge-dept">Read-Only ({dept} Dept)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
