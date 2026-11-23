'use client';

import { useRef, useState } from 'react';
import {
  discoverEquipment,
  type UIBooking,
  type UIDiscoverResult,
  type UIEquipment,
} from '@/lib/frontendApi';
import { BookingPanel } from './BookingPanel';

const DEPARTMENTS = ['All', 'Robotics', 'ECE', 'CSE', 'Mechanical', 'Biotech'] as const;
const POLICIES = ['All', 'auto', 'trained_only', 'manual'] as const;
const QUICK_PROMPTS = [
  'Edge GPU kit for YOLOv8 robotics vision by Friday',
  'High-speed oscilloscope for PCB signal debugging',
  'Resin 3D printer for biomech prototype',
];

interface Props {
  equipment: UIEquipment[];
  bookings: UIBooking[];
  onRefresh: () => void;
}

export function StudentWorkspace({ equipment, bookings, onRefresh }: Props) {
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [policyFilter, setPolicyFilter] = useState<string>('All');
  const [searching, setSearching] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<UIDiscoverResult | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(equipment[0]?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runDiscovery(searchText: string) {
    if (searchText.trim().length < 2) return;
    setSearching(true);
    setDiscoverError(null);
    try {
      const res = await discoverEquipment(searchText.trim());
      setDiscoverResult(res);
      if (res.items[0]?.id) setSelectedId(res.items[0].id);
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  const baseList = discoverResult && discoverResult.items.length > 0 ? discoverResult.items : equipment;
  const filtered = baseList.filter((item) => {
    if (deptFilter !== 'All' && item.department !== deptFilter) return false;
    if (policyFilter !== 'All' && item.approvalPolicy !== policyFilter) return false;
    return true;
  });

  const selectedEquipment =
    filtered.find((e) => e.id === selectedId) ??
    equipment.find((e) => e.id === selectedId) ??
    filtered[0] ??
    null;

  return (
    <section aria-labelledby="student-workspace-heading">
      <div className="panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 id="student-workspace-heading" className="section-title">
              GenAI Cross-Department Equipment Discovery
            </h2>
            <p className="section-sub">
              Describe your project goal in plain English—Gemini extracts hardware constraints and ranks matching kits across all 5 departments.
            </p>
          </div>
          <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            {query.length}/500 chars
          </span>
        </div>

        <form
          className="discover-form"
          onSubmit={(e) => {
            e.preventDefault();
            void runDiscovery(query);
          }}
        >
          <label htmlFor="nl-discovery-input" className="skip-link">
            Describe your laboratory hardware requirements
          </label>
          <input
            ref={inputRef}
            id="nl-discovery-input"
            type="search"
            maxLength={500}
            className="text-input"
            placeholder="e.g., Need an edge GPU dev kit for real-time drone obstacle detection due Friday..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={searching}>
            {searching ? 'Matching...' : 'Match Kits'}
          </button>
          {discoverResult && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDiscoverResult(null);
                setQuery('');
              }}
            >
              Reset
            </button>
          )}
        </form>

        <div className="chip-row" aria-label="Example project searches">
          {QUICK_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="chip-btn"
              onClick={() => {
                setQuery(sample);
                void runDiscovery(sample);
              }}
            >
              {sample}
            </button>
          ))}
        </div>

        <div aria-live="polite" style={{ marginTop: 12 }}>
          {discoverError && (
            <p role="alert" className="badge badge-err">
              {discoverError}
            </p>
          )}
          {discoverResult && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <span className="badge badge-ok">
                {discoverResult.items.length} cross-department matches
              </span>
              {discoverResult.extractedCapabilities.map((cap) => (
                <span key={cap} className="badge badge-dept font-mono">
                  #{cap}
                </span>
              ))}
              <span style={{ color: 'var(--ink-muted)' }}>
                Urgency: <strong>{discoverResult.urgencyLevel}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginTop: 18 }}>
        <div className="chip-row" role="group" aria-label="Filter by department" style={{ marginTop: 0 }}>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              type="button"
              className="chip-btn"
              aria-pressed={deptFilter === dept}
              onClick={() => setDeptFilter(dept)}
            >
              {dept}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Filter by approval policy" style={{ marginTop: 0 }}>
          {POLICIES.map((pol) => (
            <button
              key={pol}
              type="button"
              className="chip-btn"
              aria-pressed={policyFilter === pol}
              onClick={() => setPolicyFilter(pol)}
            >
              Policy: {pol.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-layout">
        <div className="kit-grid" aria-label="Laboratory equipment catalog">
          {filtered.map((kit) => {
            const isSelected = selectedEquipment?.id === kit.id;
            return (
              <article
                key={kit.id}
                className={`kit-card ${isSelected ? 'kit-card--selected' : ''}`}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-dept">{kit.department}</span>
                    <span
                      className={`badge ${
                        kit.approvalPolicy === 'auto'
                          ? 'badge-ok'
                          : kit.approvalPolicy === 'trained_only'
                            ? 'badge-warn'
                            : 'badge-err'
                      }`}
                    >
                      {kit.approvalPolicy === 'auto'
                        ? 'Auto-Approve'
                        : kit.approvalPolicy === 'trained_only'
                          ? 'Trained Only'
                          : 'Faculty Approval'}
                    </span>
                  </div>
                  <h3 style={{ margin: '10px 0 4px', fontSize: 16.5 }}>{kit.name}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                    {kit.location} · {kit.category}
                  </p>
                  {kit.matchReason && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--rose-accent)', fontWeight: 500 }}>
                      {kit.matchReason}
                    </p>
                  )}
                  <div className="chip-row" style={{ marginTop: 10 }}>
                    {kit.capabilities.slice(0, 4).map((c) => (
                      <span key={c} className="badge badge-dept font-mono" style={{ fontSize: 11 }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
                    <span>Utilization</span>
                    <span className="font-mono">{kit.utilizationPct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e4e4e7', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, kit.utilizationPct)}%`,
                        background: kit.utilizationPct > 75 ? '#be123c' : '#6d28d9',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={isSelected ? 'btn-primary' : 'btn-secondary'}
                    style={{ width: '100%' }}
                    onClick={() => setSelectedId(kit.id)}
                  >
                    {isSelected ? 'Selected for Booking' : 'Inspect Slots & Book'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <BookingPanel
          equipment={selectedEquipment}
          bookings={bookings}
          onBooked={onRefresh}
        />
      </div>
    </section>
  );
}
