'use client';

import { useMemo, useState } from 'react';
import {
  buildUpcomingSlots,
  formatIST,
  submitBooking,
  type UIAllocationResult,
  type UIBooking,
  type UIEquipment,
} from '@/lib/frontendApi';

interface Props {
  equipment: UIEquipment | null;
  bookings: UIBooking[];
  onBooked: () => void;
}

export function BookingPanel({ equipment, bookings, onBooked }: Props) {
  const slots = useMemo(() => buildUpcomingSlots(), []);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectAbstract, setProjectAbstract] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.now() + 48 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [teamSize, setTeamSize] = useState(2);
  const [hasSafetyCert, setHasSafetyCert] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<UIAllocationResult | null>(null);

  if (!equipment) {
    return (
      <aside className="panel" aria-label="Booking panel">
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Select a Lab Resource</h3>
        <p className="section-sub">
          Choose any equipment card on the left to inspect open IST slots, submit a project-based access request, or test live conflict resolution.
        </p>
      </aside>
    );
  }

  const eqBookings = bookings.filter(
    (b) => b.equipmentId === equipment.id && (b.status === 'approved' || b.status === 'pending_faculty')
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipment) return;
    if (projectTitle.trim().length < 3) {
      setFormError('Please enter a project title (at least 3 characters).');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const slot = slots[selectedSlotIdx];
      const allocation = await submitBooking({
        equipmentId: equipment.id,
        studentId: 'stu-arjun-01',
        studentName: 'Arjun Mehta',
        studentDepartment: 'Robotics',
        projectTitle: projectTitle.trim(),
        projectAbstract:
          projectAbstract.trim() || 'Cross-department prototype validation and benchmarking.',
        requiredCapabilities: equipment.capabilities.slice(0, 2),
        deadlineIso: new Date(deadline).toISOString(),
        slotStartIso: slot.startIso,
        slotEndIso: slot.endIso,
        teamSize,
        hasSafetyCert,
        priorBookingsCount: 1,
        recentBookedHours: 2,
      });
      setResult(allocation);
      onBooked();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function bookAlternative(altEquipmentId: string, startIso: string, endIso: string) {
    setSubmitting(true);
    setFormError(null);
    try {
      const allocation = await submitBooking({
        equipmentId: altEquipmentId,
        studentId: 'stu-arjun-01',
        studentName: 'Arjun Mehta',
        studentDepartment: 'Robotics',
        projectTitle: projectTitle.trim() || 'Cross-Department Alternative Booking',
        projectAbstract:
          projectAbstract.trim() || 'Accepted AI-recommended alternative allocation.',
        requiredCapabilities: equipment?.capabilities.slice(0, 2) ?? [],
        deadlineIso: new Date(deadline).toISOString(),
        slotStartIso: startIso,
        slotEndIso: endIso,
        teamSize,
        hasSafetyCert,
        priorBookingsCount: 1,
        recentBookedHours: 2,
      });
      setResult(allocation);
      onBooked();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Alternative booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="panel" aria-label={`Book ${equipment.name}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <span className="badge badge-dept">{equipment.department}</span>
          <h3 style={{ margin: '8px 0 4px', fontSize: 19 }}>{equipment.name}</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>{equipment.location}</p>
        </div>
        <span className="badge badge-warn">{equipment.approvalPolicy.replace('_', ' ')}</span>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 18, display: 'grid', gap: 14 }} noValidate>
        <div>
          <span id="slot-group-label" style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>
            1. Select Time Slot (IST · Asia/Kolkata)
          </span>
          <div className="slot-grid" role="radiogroup" aria-labelledby="slot-group-label">
            {slots.map((slot, idx) => {
              const isBooked = eqBookings.some(
                (b) => b.slotStartIso < slot.endIso && b.slotEndIso > slot.startIso
              );
              const isMaint = equipment.maintenanceWindows.some(
                (m) => m.startIso < slot.endIso && m.endIso > slot.startIso
              );
              const statusText = isMaint
                ? 'Maintenance'
                : isBooked
                  ? 'Booked (Test Conflict)'
                  : 'Open';
              return (
                <button
                  key={slot.startIso}
                  type="button"
                  role="radio"
                  aria-checked={selectedSlotIdx === idx}
                  aria-label={`${slot.label}, ${statusText}`}
                  disabled={isMaint}
                  className="slot-btn"
                  onClick={() => setSelectedSlotIdx(idx)}
                >
                  <div className="font-mono" style={{ fontSize: 11.5 }}>
                    {slot.label}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11.5,
                      color: isMaint ? '#991b1b' : isBooked ? '#92400e' : '#065f46',
                    }}
                  >
                    {statusText}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="project-title" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
            2. Project Title
          </label>
          <input
            id="project-title"
            type="text"
            className="text-input"
            placeholder="e.g., Autonomous Drone Vision Capstone"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            aria-describedby={formError ? 'booking-form-error' : undefined}
            required
          />
        </div>

        <div>
          <label htmlFor="project-abstract" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
            Project Requirements &amp; Abstract
          </label>
          <textarea
            id="project-abstract"
            rows={2}
            className="textarea-input"
            placeholder="Briefly describe hardware requirements and experimental goal..."
            value={projectAbstract}
            onChange={(e) => setProjectAbstract(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
          <div>
            <label htmlFor="project-deadline" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
              Project Deadline
            </label>
            <input
              id="project-deadline"
              type="datetime-local"
              className="text-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="team-size" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
              Team Size
            </label>
            <input
              id="team-size"
              type="number"
              min={1}
              max={10}
              className="text-input"
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          <input
            type="checkbox"
            checked={hasSafetyCert}
            onChange={(e) => setHasSafetyCert(e.target.checked)}
          />
          I hold valid campus lab safety certification for this hardware tier
        </label>

        {formError && (
          <p id="booking-form-error" role="alert" className="badge badge-err" style={{ margin: 0 }}>
            {formError}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Evaluating Allocation...' : 'Submit Project Access Request'}
        </button>
      </form>

      <div aria-live="polite" style={{ marginTop: 18 }}>
        {result && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 16,
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                className={`badge ${
                  result.outcome === 'booked'
                    ? 'badge-ok'
                    : result.outcome.includes('blocked')
                      ? 'badge-err'
                      : 'badge-warn'
                }`}
              >
                {result.outcome.replace(/_/g, ' ')}
              </span>
              <span className="font-dot" style={{ fontSize: 22 }}>
                {result.priorityScore} PTS
              </span>
            </div>

            <div className="score-bar" aria-hidden="true">
              <div
                className="score-seg-urgency"
                style={{ width: `${result.scoreBreakdown.deadlineUrgency}%` }}
              />
              <div
                className="score-seg-fit"
                style={{ width: `${result.scoreBreakdown.specFit}%` }}
              />
              <div
                className="score-seg-fairness"
                style={{ width: `${result.scoreBreakdown.fairnessScore}%` }}
              />
            </div>

            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-secondary)' }}>
              {result.aiExplanation}
            </p>

            {result.alternatives.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>Feasible Alternatives:</strong>
                {result.alternatives.map((alt, i) => (
                  <div
                    key={`${alt.equipmentId}-${i}`}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12.5 }}>
                      <strong>{alt.equipmentName}</strong> ({alt.department})
                      <div className="font-mono" style={{ color: 'var(--ink-muted)' }}>
                        {formatIST(alt.slotStartIso)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        bookAlternative(alt.equipmentId, alt.slotStartIso, alt.slotEndIso)
                      }
                    >
                      Book Alternative
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
