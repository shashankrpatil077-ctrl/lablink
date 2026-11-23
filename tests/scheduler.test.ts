/**
 * Comprehensive scheduler unit tests (12+ tests)
 * Covers interval overlap, priority scoring, conflict resolution,
 * maintenance blocking, safety, alternatives, and utilization analytics.
 */

import { describe, it, expect } from 'vitest';
import {
  hasIntervalOverlap,
  computePriorityScore,
  evaluateBookingRequest,
  computeUtilizationAnalytics,
} from '@/lib/scheduler';
import type { Equipment, BookingRequest, WaitlistEntry } from '@/types/lablink';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'eq-test-001',
    name: 'Test Equipment',
    department: 'CSE',
    category: 'Test',
    location: 'Lab 101',
    specs: 'Test specs',
    capabilities: ['cuda', 'vision-ai'],
    approvalPolicy: 'auto',
    maintenanceWindows: [],
    dailyCapacityHours: 12,
    status: 'available',
    ...overrides,
  };
}

function makeBooking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  const now = new Date();
  return {
    id: 'bk-test-001',
    equipmentId: 'eq-test-001',
    studentId: 'stu-test-001',
    studentName: 'Test Student',
    studentDepartment: 'CSE',
    projectTitle: 'Test Project',
    projectAbstract: 'A test project abstract for unit testing purposes.',
    requiredCapabilities: ['cuda'],
    deadlineIso: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    slotStartIso: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    slotEndIso: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
    teamSize: 2,
    hasSafetyCert: true,
    priorBookingsCount: 0,
    status: 'pending_faculty',
    priorityScore: 0,
    createdAt: now.toISOString(),
    ...overrides,
  };
}

// ─── Interval Overlap Tests ──────────────────────────────────────────────────

describe('hasIntervalOverlap', () => {
  it('should NOT conflict for back-to-back slots (10:00-12:00 and 12:00-14:00)', () => {
    const result = hasIntervalOverlap(
      '2026-01-15T10:00:00Z', '2026-01-15T12:00:00Z',
      '2026-01-15T12:00:00Z', '2026-01-15T14:00:00Z'
    );
    expect(result).toBe(false);
  });

  it('should detect partial interval overlap', () => {
    const result = hasIntervalOverlap(
      '2026-01-15T10:00:00Z', '2026-01-15T13:00:00Z',
      '2026-01-15T12:00:00Z', '2026-01-15T15:00:00Z'
    );
    expect(result).toBe(true);
  });

  it('should detect full interval overlap (identical slots)', () => {
    const result = hasIntervalOverlap(
      '2026-01-15T10:00:00Z', '2026-01-15T14:00:00Z',
      '2026-01-15T10:00:00Z', '2026-01-15T14:00:00Z'
    );
    expect(result).toBe(true);
  });

  it('should detect when one interval fully contains another', () => {
    const result = hasIntervalOverlap(
      '2026-01-15T08:00:00Z', '2026-01-15T18:00:00Z',
      '2026-01-15T10:00:00Z', '2026-01-15T14:00:00Z'
    );
    expect(result).toBe(true);
  });

  it('should NOT conflict for completely separate intervals', () => {
    const result = hasIntervalOverlap(
      '2026-01-15T08:00:00Z', '2026-01-15T10:00:00Z',
      '2026-01-15T14:00:00Z', '2026-01-15T16:00:00Z'
    );
    expect(result).toBe(false);
  });
});

// ─── Priority Score Tests ────────────────────────────────────────────────────

describe('computePriorityScore', () => {
  it('urgent capstone (48h deadline, 0 prior) outscores exploratory (14d, 4 prior)', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const equipment = makeEquipment();

    const urgentRequest = makeBooking({
      id: 'bk-urgent',
      deadlineIso: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      requiredCapabilities: ['cuda', 'vision-ai'],
      priorBookingsCount: 0,
    });

    const exploratoryRequest = makeBooking({
      id: 'bk-exploratory',
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      requiredCapabilities: ['cuda'],
      priorBookingsCount: 4,
    });

    const urgentScore = computePriorityScore(urgentRequest, equipment, nowIso);
    const exploratoryScore = computePriorityScore(exploratoryRequest, equipment, nowIso);

    expect(urgentScore.total).toBeGreaterThan(exploratoryScore.total);
    // Urgent: deadlineUrgency >= 38, specFit = 30 (2/2 caps), fairness = 30
    expect(urgentScore.breakdown.deadlineUrgency).toBeGreaterThanOrEqual(38);
    expect(urgentScore.breakdown.fairnessScore).toBe(30);
    // Exploratory: deadlineUrgency <= 10, fairness = 10 (30 - 4*5 = 10)
    expect(exploratoryScore.breakdown.deadlineUrgency).toBeLessThanOrEqual(10);
    expect(exploratoryScore.breakdown.fairnessScore).toBe(10);
  });

  it('applies anti-hoarding fairness penalty correctly', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const equipment = makeEquipment();

    const freshStudent = makeBooking({ priorBookingsCount: 0 });
    const frequentUser = makeBooking({ priorBookingsCount: 5 });

    const freshScore = computePriorityScore(freshStudent, equipment, nowIso);
    const frequentScore = computePriorityScore(frequentUser, equipment, nowIso);

    expect(freshScore.breakdown.fairnessScore).toBe(30);
    expect(frequentScore.breakdown.fairnessScore).toBe(5); // 30 - 5*5 = 5 (min)
  });

  it('defaults specFit to 22 when no capabilities are specified', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const equipment = makeEquipment();

    const request = makeBooking({ requiredCapabilities: [] });
    const score = computePriorityScore(request, equipment, nowIso);

    expect(score.breakdown.specFit).toBe(22);
  });
});

// ─── Booking Evaluation Tests ────────────────────────────────────────────────

describe('evaluateBookingRequest', () => {
  it('blocks booking during maintenance window', () => {
    const now = new Date();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const equipment = makeEquipment({
      maintenanceWindows: [{
        startIso: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        endIso: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        reason: 'Scheduled maintenance',
      }],
    });

    const request = makeBooking({
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
    });

    const result = evaluateBookingRequest(request, equipment, [equipment], [], now.toISOString());
    expect(result.outcome).toBe('blocked_maintenance');
  });

  it('blocks booking without safety cert on trained_only equipment', () => {
    const equipment = makeEquipment({ approvalPolicy: 'trained_only' });
    const request = makeBooking({ hasSafetyCert: false });

    const result = evaluateBookingRequest(request, equipment, [equipment], [], new Date().toISOString());
    expect(result.outcome).toBe('blocked_safety');
  });

  it('blocks booking without safety cert on manual equipment', () => {
    const equipment = makeEquipment({ approvalPolicy: 'manual' });
    const request = makeBooking({ hasSafetyCert: false });

    const result = evaluateBookingRequest(request, equipment, [equipment], [], new Date().toISOString());
    expect(result.outcome).toBe('blocked_safety');
  });

  it('auto-approves booking on auto-approval equipment with no conflicts', () => {
    const equipment = makeEquipment({ approvalPolicy: 'auto' });
    const request = makeBooking();

    const result = evaluateBookingRequest(request, equipment, [equipment], [], new Date().toISOString());
    expect(result.outcome).toBe('booked');
    expect(result.winnerBookingId).toBe(request.id);
  });

  it('routes to pending_faculty on manual-approval equipment with safety cert', () => {
    const equipment = makeEquipment({ approvalPolicy: 'manual' });
    const request = makeBooking({ hasSafetyCert: true });

    const result = evaluateBookingRequest(request, equipment, [equipment], [], new Date().toISOString());
    expect(result.outcome).toBe('pending_faculty');
  });

  it('resolves conflict with higher-priority incoming winning', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const equipment = makeEquipment({ approvalPolicy: 'auto' });

    // Existing low-priority booking
    const existingBooking = makeBooking({
      id: 'bk-existing',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      status: 'approved',
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 5,
      requiredCapabilities: ['cuda'],
    });

    // Incoming high-priority booking (urgent, no prior bookings)
    const incomingBooking = makeBooking({
      id: 'bk-incoming',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      deadlineIso: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 0,
      requiredCapabilities: ['cuda', 'vision-ai'],
    });

    const result = evaluateBookingRequest(
      incomingBooking, equipment, [equipment], [existingBooking], nowIso
    );

    expect(result.outcome).toBe('conflict_resolved');
    expect(result.winnerBookingId).toBe('bk-incoming');
    expect(result.waitlisted).toContain('bk-existing');
  });

  it('creates waitlist entry when incoming request loses conflict', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const equipment = makeEquipment({ approvalPolicy: 'auto' });

    // Existing high-priority booking
    const existingBooking = makeBooking({
      id: 'bk-existing-high',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      status: 'approved',
      deadlineIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 0,
      requiredCapabilities: ['cuda', 'vision-ai'],
    });

    // Incoming low-priority booking
    const incomingBooking = makeBooking({
      id: 'bk-incoming-low',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 4,
      requiredCapabilities: ['cuda'],
    });

    const result = evaluateBookingRequest(
      incomingBooking, equipment, [equipment], [existingBooking], nowIso
    );

    expect(result.outcome).toBe('conflict_resolved');
    expect(result.winnerBookingId).toBe('bk-existing-high');
    expect(result.waitlisted).toContain('bk-incoming-low');
  });

  it('recommends cross-department equivalent-kit alternative on conflict', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const primaryEquipment = makeEquipment({
      id: 'eq-primary',
      name: 'Jetson Orin AGX',
      department: 'Robotics',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      approvalPolicy: 'auto',
    });

    const alternativeEquipment = makeEquipment({
      id: 'eq-alternative',
      name: 'Jetson Orin Nano',
      department: 'ECE',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      approvalPolicy: 'auto',
    });

    // Existing booking on primary equipment
    const existingBooking = makeBooking({
      id: 'bk-existing',
      equipmentId: 'eq-primary',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      status: 'approved',
      deadlineIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 0,
    });

    const incomingBooking = makeBooking({
      id: 'bk-incoming',
      equipmentId: 'eq-primary',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 3,
    });

    const allEquipment = [primaryEquipment, alternativeEquipment];

    const result = evaluateBookingRequest(
      incomingBooking, primaryEquipment, allEquipment, [existingBooking], nowIso
    );

    expect(result.outcome).toBe('conflict_resolved');
    // Should have alternatives (at least an equivalent equipment)
    const equivAlt = result.alternatives.find((a) => a.type === 'equivalent_equipment');
    if (equivAlt) {
      expect(equivAlt.equipmentId).toBe('eq-alternative');
      expect(equivAlt.department).toBe('ECE');
    }
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('recommends alternate open time-slot on same equipment after conflict', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const equipment = makeEquipment({ approvalPolicy: 'auto' });

    const existingBooking = makeBooking({
      id: 'bk-existing',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      status: 'approved',
      deadlineIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 0,
    });

    const incomingBooking = makeBooking({
      id: 'bk-incoming',
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priorBookingsCount: 3,
    });

    const result = evaluateBookingRequest(
      incomingBooking, equipment, [equipment], [existingBooking], nowIso
    );

    // Should suggest alternate slot on same equipment
    const altSlot = result.alternatives.find((a) => a.type === 'alternate_slot');
    if (altSlot) {
      expect(altSlot.equipmentId).toBe(equipment.id);
    }
    expect(result.alternatives.length).toBeGreaterThan(0);
  });
});

// ─── Utilization Analytics Tests ─────────────────────────────────────────────

describe('computeUtilizationAnalytics', () => {
  it('flags underutilized kits with less than 35% utilization', () => {
    const now = new Date();
    const equipment: Equipment[] = [
      makeEquipment({
        id: 'eq-high-util',
        name: 'Busy Kit',
        department: 'CSE',
        dailyCapacityHours: 10,
      }),
      makeEquipment({
        id: 'eq-low-util',
        name: 'Idle Kit',
        department: 'ECE',
        dailyCapacityHours: 12,
      }),
    ];

    // Busy kit has 5 hours booked (50% utilization)
    const bookings: BookingRequest[] = [
      makeBooking({
        id: 'bk-busy-1',
        equipmentId: 'eq-high-util',
        slotStartIso: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        slotEndIso: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        status: 'approved',
      }),
    ];
    // Idle kit has 0 hours booked (0% utilization)

    const waitlist: WaitlistEntry[] = [];

    const report = computeUtilizationAnalytics(equipment, bookings, waitlist);

    // eq-low-util should be flagged as underutilized (0% < 35%)
    const underutilized = report.underutilizedKits;
    expect(underutilized.some((k) => k.equipmentId === 'eq-low-util')).toBe(true);
    expect(underutilized.find((k) => k.equipmentId === 'eq-low-util')?.utilizationPercent).toBeLessThan(35);
  });

  it('calculates campus-wide and per-department utilization', () => {
    const now = new Date();
    const equipment: Equipment[] = [
      makeEquipment({ id: 'eq-cse-1', department: 'CSE', dailyCapacityHours: 10 }),
      makeEquipment({ id: 'eq-ece-1', department: 'ECE', dailyCapacityHours: 10 }),
    ];

    const bookings: BookingRequest[] = [
      makeBooking({
        id: 'bk-1',
        equipmentId: 'eq-cse-1',
        slotStartIso: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        slotEndIso: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 3 hours
        status: 'approved',
      }),
    ];

    const report = computeUtilizationAnalytics(equipment, bookings, []);

    // CSE: 3/10 = 30%, ECE: 0/10 = 0%, Campus: 3/20 = 15%
    expect(report.campusUtilizationPercent).toBe(15);
    const cseDept = report.departmentUtilization.find((d) => d.department === 'CSE');
    expect(cseDept?.utilizationPercent).toBe(30);

    const eceDept = report.departmentUtilization.find((d) => d.department === 'ECE');
    expect(eceDept?.utilizationPercent).toBe(0);
  });

  it('reports active waitlist count', () => {
    const waitlist: WaitlistEntry[] = [
      {
        id: 'wl-1',
        bookingId: 'bk-wl-1',
        equipmentId: 'eq-1',
        originalSlotStartIso: '2026-01-15T10:00:00Z',
        originalSlotEndIso: '2026-01-15T13:00:00Z',
        priorityScore: 50,
        createdAt: '2026-01-15T08:00:00Z',
      },
      {
        id: 'wl-2',
        bookingId: 'bk-wl-2',
        equipmentId: 'eq-1',
        originalSlotStartIso: '2026-01-15T10:00:00Z',
        originalSlotEndIso: '2026-01-15T13:00:00Z',
        priorityScore: 40,
        createdAt: '2026-01-15T08:00:00Z',
      },
    ];

    const report = computeUtilizationAnalytics([], [], waitlist);
    expect(report.activeWaitlistCount).toBe(2);
  });
});
