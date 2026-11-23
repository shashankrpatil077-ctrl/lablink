'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAnalytics,
  fetchBookings,
  fetchEquipment,
  runConflictSimulation,
  switchDemoRole,
  type UIAnalytics,
  type UIBooking,
  type UIEquipment,
  type UIRoleKey,
  type UISimulationResult,
} from '@/lib/frontendApi';
import { StudentWorkspace } from '@/components/StudentWorkspace';
import { FacultyWorkspace } from '@/components/FacultyWorkspace';
import { AdminWorkspace } from '@/components/AdminWorkspace';
import { ConflictSimulatorModal } from '@/components/ConflictSimulatorModal';

export default function LabLinkHome() {
  const [activeRole, setActiveRole] = useState<UIRoleKey>('student');
  const [equipment, setEquipment] = useState<UIEquipment[]>([]);
  const [bookings, setBookings] = useState<UIBooking[]>([]);
  const [analytics, setAnalytics] = useState<UIAnalytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [simOpen, setSimOpen] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simData, setSimData] = useState<UISimulationResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      setLoadError(null);
      const [eq, bk, an] = await Promise.all([
        fetchEquipment(),
        fetchBookings(),
        fetchAnalytics(),
      ]);
      setEquipment(eq);
      setBookings(bk);
      setAnalytics(an);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach LabLink API');
    }
  }, []);

  useEffect(() => {
    (async () => { await refreshAll(); })();
  }, [refreshAll]);

  async function handleRoleSwitch(role: UIRoleKey) {
    setActiveRole(role);
    await switchDemoRole(role).catch(() => undefined);
    void refreshAll();
  }

  async function handleOpenSimulator() {
    setSimOpen(true);
    setSimLoading(true);
    setSimError(null);
    try {
      const data = await runConflictSimulation();
      setSimData(data);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <>
      <header className="top-header">
        <div className="container">
          <nav className="top-nav" aria-label="Primary navigation">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">LL</span>
              <span className="brand-name">LabLink</span>
              <span className="tz-pill font-mono">IST · Asia/Kolkata</span>
            </div>

            <div className="role-switcher" role="group" aria-label="Switch campus role">
              <button
                type="button"
                className="role-btn"
                aria-pressed={activeRole === 'student'}
                onClick={() => void handleRoleSwitch('student')}
              >
                Student
              </button>
              <button
                type="button"
                className="role-btn"
                aria-pressed={activeRole === 'faculty_robotics'}
                onClick={() => void handleRoleSwitch('faculty_robotics')}
              >
                Faculty · Robotics
              </button>
              <button
                type="button"
                className="role-btn"
                aria-pressed={activeRole === 'faculty_ece'}
                onClick={() => void handleRoleSwitch('faculty_ece')}
              >
                Faculty · ECE
              </button>
              <button
                type="button"
                className="role-btn"
                aria-pressed={activeRole === 'lab_admin'}
                onClick={() => void handleRoleSwitch('lab_admin')}
              >
                Lab Admin
              </button>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleOpenSimulator()}
            >
              Simulate Conflict
            </button>
          </nav>
        </div>
      </header>

      <main id="main-content" className="container">
        {/* Editorial Hero matching the uploaded screenshot aesthetic */}
        <section className="hero-section" aria-labelledby="hero-headline">
          <div className="hero-header">
            <h1 id="hero-headline" className="hero-title">
              Built for <span className="font-dot hero-title-accent">Intelligent</span>
              <br />
              Campus Labs
            </h1>
            <p className="hero-desc">
              Every laboratory workstation, robotics bench, and development kit across five
              departments unified with GenAI discovery, faculty-verified access, and fair
              deterministic conflict resolution.
            </p>
          </div>

          {/* 3 Luminous Telemetry Cards (Rose, Violet, Coral) wired to live backend metrics */}
          <div className="telemetry-grid">
            <article className="telemetry-card telemetry-card--rose">
              <svg className="telemetry-svg" viewBox="0 0 320 300" aria-hidden="true">
                <path
                  d="M 55 185 A 105 105 0 0 1 265 185"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 75 185 A 85 85 0 0 1 245 185"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeDasharray="3 7"
                  strokeWidth="3"
                />
              </svg>
              <div className="telemetry-top">
                <p className="telemetry-kicker">
                  Equipment Discovery
                  <br />
                  Cross-Department Pool
                </p>
              </div>
              <div className="telemetry-value font-dot">
                {equipment.length || 12}
                <span className="telemetry-unit">kits</span>
              </div>
              <p className="telemetry-sub">
                Specialised benches across Robotics, ECE, CSE, Mech &amp; Biotech
              </p>
              <button
                type="button"
                className="telemetry-pill"
                onClick={() => void handleRoleSwitch('student')}
              >
                Explore Catalog
              </button>
            </article>

            <article className="telemetry-card telemetry-card--violet">
              <svg className="telemetry-svg" viewBox="0 0 320 300" aria-hidden="true">
                <rect
                  x="24"
                  y="24"
                  width="272"
                  height="252"
                  rx="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                />
              </svg>
              <div className="telemetry-top">
                <p className="telemetry-kicker">
                  Fairness Engine
                  <br />
                  Deterministic Conflict Solver
                </p>
              </div>
              <div className="telemetry-glass-box">
                <div
                  className="telemetry-value font-dot"
                  style={{ margin: '0 0 4px', fontSize: 'clamp(28px, 3.2vw, 38px)' }}
                >
                  40/30
                  <span className="telemetry-unit" style={{ fontSize: '18px' }}>/30</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    width: '100%',
                    maxWidth: '170px',
                    height: 4,
                    borderRadius: 999,
                    overflow: 'hidden',
                    margin: '6px 0 10px',
                    background: 'rgba(255, 255, 255, 0.25)',
                  }}
                  aria-hidden="true"
                >
                  <div style={{ width: '40%', background: '#fb7185' }} />
                  <div style={{ width: '30%', background: '#c084fc' }} />
                  <div style={{ width: '30%', background: '#fdba74' }} />
                </div>
                <p
                  className="telemetry-sub"
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: 1.4,
                    maxWidth: '24ch',
                    color: 'rgba(255, 255, 255, 0.95)',
                  }}
                >
                  Urgency, spec fit &amp; anti-hoarding priority scoring
                </p>
              </div>
              <button
                type="button"
                className="telemetry-pill"
                onClick={() => void handleOpenSimulator()}
              >
                Simulate Conflict
              </button>
            </article>

            <article className="telemetry-card telemetry-card--coral">
              <svg className="telemetry-svg" viewBox="0 0 320 300" aria-hidden="true">
                <path
                  d="M 0 115 L 80 115 L 105 95 L 210 95 L 235 125 L 320 125"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 0 165 L 115 165 L 145 140 L 245 140 L 270 165 L 320 165"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.2"
                />
                <circle cx="105" cy="95" r="4" fill="#ffffff" />
                <circle cx="235" cy="125" r="4" fill="#ffffff" />
                <circle cx="145" cy="140" r="4" fill="#ffffff" />
              </svg>
              <div className="telemetry-top">
                <p className="telemetry-kicker">
                  Resource Utilisation
                  <br />
                  Live Campus Telemetry
                </p>
              </div>
              <div className="telemetry-value font-dot">
                {analytics?.campusUtilizationPct ?? 68}
                <span className="telemetry-unit">%</span>
              </div>
              <p className="telemetry-sub">
                Real-time load balancing &amp; idle-kit sharing alerts
              </p>
              <button
                type="button"
                className="telemetry-pill"
                onClick={() => void handleRoleSwitch('lab_admin')}
              >
                View Analytics
              </button>
            </article>
          </div>
        </section>

        {loadError && (
          <p role="alert" className="badge badge-err" style={{ marginBottom: 16 }}>
            {loadError}
          </p>
        )}

        <div className="workspace-section">
          {activeRole === 'student' && (
            <StudentWorkspace
              equipment={equipment}
              bookings={bookings}
              onRefresh={() => void refreshAll()}
            />
          )}
          {activeRole === 'faculty_robotics' && (
            <FacultyWorkspace
              facultyDepartment="Robotics"
              bookings={bookings}
              equipment={equipment}
              onRefresh={() => void refreshAll()}
            />
          )}
          {activeRole === 'faculty_ece' && (
            <FacultyWorkspace
              facultyDepartment="ECE"
              bookings={bookings}
              equipment={equipment}
              onRefresh={() => void refreshAll()}
            />
          )}
          {activeRole === 'lab_admin' && <AdminWorkspace analytics={analytics} />}
        </div>
      </main>

      <ConflictSimulatorModal
        open={simOpen}
        loading={simLoading}
        data={simData}
        error={simError}
        onClose={() => setSimOpen(false)}
      />
    </>
  );
}
