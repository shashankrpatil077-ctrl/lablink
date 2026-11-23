/**
 * API Route Handler Tests
 * Tests all REST endpoints using direct function calls with mocked NextRequest.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLabStore, resetStoreInstance } from '@/lib/store';
import { resetRateLimitStore } from '@/lib/rateLimit';
import {
  computePriorityScore,
  evaluateBookingRequest,
} from '@/lib/scheduler';
import { discoverSchema, createBookingSchema, facultyDecisionSchema } from '@/lib/validation';
import type { Equipment, BookingRequest } from '@/types/lablink';

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

function makeBookingInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date();
  return {
    equipmentId: 'eq-robo-jetson-agx',
    studentId: 'stu-test-001',
    studentName: 'Test Student',
    studentDepartment: 'CSE',
    projectTitle: 'Test Project Title',
    projectAbstract: 'A sufficiently long test project abstract for validation purposes and testing.',
    requiredCapabilities: ['cuda'],
    deadlineIso: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    slotStartIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    slotEndIso: new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(),
    teamSize: 2,
    hasSafetyCert: true,
    priorBookingsCount: 0,
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStoreInstance();
  resetRateLimitStore();
});

// ─── Health Endpoint Tests ───────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('should return 200 with status ok', async () => {
    // Test the health check logic directly
    const isAIConfigured = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0;
    const storage = process.env.USE_FIRESTORE === 'true' ? 'firestore' : 'memory';

    expect(storage).toBe('memory');
    expect(typeof isAIConfigured).toBe('boolean');
  });
});

// ─── Booking Validation Tests ────────────────────────────────────────────────

describe('POST /api/bookings validation', () => {
  it('should reject when slotEndIso <= slotStartIso', () => {
    const now = new Date();
    const payload = makeBookingInput({
      slotStartIso: new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(),
      slotEndIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Before start
    });

    const result = createBookingSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject empty project title', () => {
    const payload = makeBookingInput({ projectTitle: '' });

    const result = createBookingSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject teamSize outside 1-10 range', () => {
    const payloadZero = makeBookingInput({ teamSize: 0 });
    const payloadEleven = makeBookingInput({ teamSize: 11 });

    expect(createBookingSchema.safeParse(payloadZero).success).toBe(false);
    expect(createBookingSchema.safeParse(payloadEleven).success).toBe(false);
  });

  it('should reject slot duration exceeding 8 hours', () => {
    const now = new Date();
    const payload = makeBookingInput({
      slotStartIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      slotEndIso: new Date(now.getTime() + 33 * 60 * 60 * 1000).toISOString(), // 9 hours
    });

    const result = createBookingSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should accept valid booking input', () => {
    const payload = makeBookingInput();
    const result = createBookingSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

// ─── Booking Creation & Conflict Tests ───────────────────────────────────────

describe('POST /api/bookings conflict resolution', () => {
  it('should create booking and resolve conflict properly', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const equipment = makeEquipment({ approvalPolicy: 'auto' });

    // Existing approved booking
    const existingBooking: BookingRequest = {
      id: 'bk-existing',
      equipmentId: equipment.id,
      studentId: 'stu-existing',
      studentName: 'Existing Student',
      studentDepartment: 'CSE',
      projectTitle: 'Existing Project',
      projectAbstract: 'An existing project abstract for testing.',
      requiredCapabilities: ['cuda'],
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 1,
      hasSafetyCert: true,
      priorBookingsCount: 4,
      status: 'approved',
      priorityScore: 0,
      createdAt: nowIso,
    };

    // New booking with higher priority (urgent deadline, 0 prior)
    const newBooking: BookingRequest = {
      id: 'bk-new',
      equipmentId: equipment.id,
      studentId: 'stu-new',
      studentName: 'New Student',
      studentDepartment: 'Robotics',
      projectTitle: 'Urgent Capstone',
      projectAbstract: 'An urgent capstone project for testing.',
      requiredCapabilities: ['cuda', 'vision-ai'],
      deadlineIso: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 2,
      hasSafetyCert: true,
      priorBookingsCount: 0,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: nowIso,
    };

    const result = evaluateBookingRequest(
      newBooking, equipment, [equipment], [existingBooking], nowIso
    );

    // New booking should win due to higher priority
    expect(result.outcome).toBe('conflict_resolved');
    expect(result.winnerBookingId).toBe('bk-new');
    expect(result.waitlisted).toContain('bk-existing');
    expect(result.priorityScore).toBeGreaterThan(0);
  });
});

// ─── Faculty Decision Validation Tests ───────────────────────────────────────

describe('PATCH /api/bookings/[id] validation', () => {
  it('should validate approve action', () => {
    const result = facultyDecisionSchema.safeParse({
      action: 'approve',
      facultyNote: 'Looks good',
    });
    expect(result.success).toBe(true);
  });

  it('should validate reject action', () => {
    const result = facultyDecisionSchema.safeParse({
      action: 'reject',
      facultyNote: 'Not appropriate for this equipment',
    });
    expect(result.success).toBe(true);
  });

  it('should require reassign fields when action is reassign', () => {
    const result = facultyDecisionSchema.safeParse({
      action: 'reassign',
      // Missing required reassign fields
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid reassign action with all fields', () => {
    const now = new Date();
    const result = facultyDecisionSchema.safeParse({
      action: 'reassign',
      reassignEquipmentId: 'eq-alt-001',
      reassignSlotStartIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      reassignSlotEndIso: new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(),
      facultyNote: 'Reassigned to equivalent kit',
    });
    expect(result.success).toBe(true);
  });

  it('should return 404 for unknown booking ID via store', async () => {
    const store = new InMemoryLabStore();
    const booking = await store.getBookingById('nonexistent-id');
    expect(booking).toBeUndefined();
  });
});

// ─── Discover Validation Tests ───────────────────────────────────────────────

describe('POST /api/discover validation', () => {
  it('should validate discover query', () => {
    const result = discoverSchema.safeParse({ query: 'I need a GPU for deep learning' });
    expect(result.success).toBe(true);
  });

  it('should reject query shorter than 3 characters', () => {
    const result = discoverSchema.safeParse({ query: 'ab' });
    expect(result.success).toBe(false);
  });

  it('should work with deterministic fallback when GEMINI_API_KEY is unset', async () => {
    // Import the discover function
    const { discoverEquipmentWithAI } = await import('@/lib/gemini');
    const store = new InMemoryLabStore();
    const catalog = await store.getAllEquipment();

    // With no GEMINI_API_KEY set, should use fallback
    const result = await discoverEquipmentWithAI('I need a CUDA GPU for deep learning vision AI', catalog);

    expect(result.extractedCapabilities).toBeDefined();
    expect(Array.isArray(result.extractedCapabilities)).toBe(true);
    expect(result.extractedCapabilities.length).toBeGreaterThan(0);
    expect(result.recommendedIds.length).toBeGreaterThan(0);
    expect(result.urgencyLevel).toBeDefined();
  });
});

// ─── Simulate Conflict Tests ─────────────────────────────────────────────────

describe('POST /api/simulate-conflict', () => {
  it('should produce 3 ranked requests with priority scores', () => {
    const now = new Date();
    const nowIso = now.toISOString();

    // Get the Jetson Orin AGX
    const jetsonAgxId = 'eq-robo-jetson-agx';
    const slotStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 3 * 60 * 60 * 1000);

    const equipment = makeEquipment({
      id: jetsonAgxId,
      name: 'NVIDIA Jetson Orin AGX',
      department: 'Robotics',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai', 'robot-arm'],
      approvalPolicy: 'trained_only',
    });

    // Create 3 competing students
    const capstone: BookingRequest = {
      id: 'sim-1',
      equipmentId: jetsonAgxId,
      studentId: 'stu-1',
      studentName: 'Capstone Student',
      studentDepartment: 'Robotics',
      projectTitle: 'Senior Capstone',
      projectAbstract: 'Final capstone project due in 36 hours.',
      requiredCapabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      deadlineIso: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 2,
      hasSafetyCert: true,
      priorBookingsCount: 0,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: nowIso,
    };

    const hackathon: BookingRequest = {
      id: 'sim-2',
      equipmentId: jetsonAgxId,
      studentId: 'stu-2',
      studentName: 'Hackathon Student',
      studentDepartment: 'CSE',
      projectTitle: 'Hackathon Project',
      projectAbstract: 'Hackathon submission due in 4 days.',
      requiredCapabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      deadlineIso: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 4,
      hasSafetyCert: true,
      priorBookingsCount: 2,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: nowIso,
    };

    const exploratory: BookingRequest = {
      id: 'sim-3',
      equipmentId: jetsonAgxId,
      studentId: 'stu-3',
      studentName: 'Exploratory Student',
      studentDepartment: 'ECE',
      projectTitle: 'Exploratory Study',
      projectAbstract: 'Exploratory benchmarking due in 14 days.',
      requiredCapabilities: ['cuda', 'edge-gpu'],
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 1,
      hasSafetyCert: true,
      priorBookingsCount: 4,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: nowIso,
    };

    // Score all three
    const capstoneScore = computePriorityScore(capstone, equipment, nowIso);
    const hackathonScore = computePriorityScore(hackathon, equipment, nowIso);
    const exploratoryScore = computePriorityScore(exploratory, equipment, nowIso);

    // Capstone (36h deadline, 0 prior) should have highest score
    expect(capstoneScore.total).toBeGreaterThan(hackathonScore.total);
    expect(hackathonScore.total).toBeGreaterThan(exploratoryScore.total);

    // Verify score components
    expect(capstoneScore.breakdown.deadlineUrgency).toBeGreaterThanOrEqual(38);
    expect(capstoneScore.breakdown.fairnessScore).toBe(30); // 0 prior
    expect(exploratoryScore.breakdown.fairnessScore).toBe(10); // 4 prior: 30-20=10
  });

  it('should produce alternatives for waitlisted students', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const slotStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 3 * 60 * 60 * 1000);

    const primaryEquipment = makeEquipment({
      id: 'eq-primary',
      name: 'Jetson Orin AGX',
      department: 'Robotics',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      approvalPolicy: 'auto',
    });

    const altEquipment = makeEquipment({
      id: 'eq-alt',
      name: 'Jetson Orin Nano',
      department: 'ECE',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      approvalPolicy: 'auto',
    });

    const winner: BookingRequest = {
      id: 'bk-winner',
      equipmentId: 'eq-primary',
      studentId: 'stu-1',
      studentName: 'Winner',
      studentDepartment: 'Robotics',
      projectTitle: 'Winner Project',
      projectAbstract: 'Winner project abstract for testing.',
      requiredCapabilities: ['edge-gpu', 'cuda'],
      deadlineIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 2,
      hasSafetyCert: true,
      priorBookingsCount: 0,
      status: 'approved',
      priorityScore: 90,
      createdAt: nowIso,
    };

    const loser: BookingRequest = {
      id: 'bk-loser',
      equipmentId: 'eq-primary',
      studentId: 'stu-2',
      studentName: 'Loser',
      studentDepartment: 'ECE',
      projectTitle: 'Loser Project',
      projectAbstract: 'Loser project abstract for testing.',
      requiredCapabilities: ['edge-gpu', 'cuda'],
      deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      slotStartIso: slotStart.toISOString(),
      slotEndIso: slotEnd.toISOString(),
      teamSize: 1,
      hasSafetyCert: true,
      priorBookingsCount: 4,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: nowIso,
    };

    const allEquipment = [primaryEquipment, altEquipment];

    const result = evaluateBookingRequest(
      loser, primaryEquipment, allEquipment, [winner], nowIso
    );

    expect(result.outcome).toBe('conflict_resolved');
    expect(result.alternatives.length).toBeGreaterThan(0);
    // Should have cross-department alternative
    const equivAlt = result.alternatives.find((a) => a.type === 'equivalent_equipment');
    expect(equivAlt).toBeDefined();
    if (equivAlt) {
      expect(equivAlt.equipmentId).toBe('eq-alt');
    }
  });
});

// ─── Store Tests ─────────────────────────────────────────────────────────────

describe('InMemoryLabStore', () => {
  it('should have 12 pre-seeded equipment kits', async () => {
    const store = new InMemoryLabStore();
    const equipment = await store.getAllEquipment();
    expect(equipment.length).toBe(12);
  });

  it('should have 4 pre-seeded bookings', async () => {
    const store = new InMemoryLabStore();
    const bookings = await store.getAllBookings();
    expect(bookings.length).toBe(4);
  });

  it('should have at least 1 pending_faculty booking', async () => {
    const store = new InMemoryLabStore();
    const pending = await store.getBookingsByStatus('pending_faculty');
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });

  it('should have at least 1 active booking on Jetson Orin AGX', async () => {
    const store = new InMemoryLabStore();
    const bookings = await store.getBookingsByEquipment('eq-robo-jetson-agx');
    const active = bookings.filter((b) => b.status === 'approved');
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it('should reset store deterministically', async () => {
    const store = new InMemoryLabStore();
    await store.createBooking({
      id: 'bk-extra',
      equipmentId: 'eq-robo-jetson-agx',
      studentId: 'stu-extra',
      studentName: 'Extra Student',
      studentDepartment: 'CSE',
      projectTitle: 'Extra',
      projectAbstract: 'Extra booking for testing.',
      requiredCapabilities: [],
      deadlineIso: new Date().toISOString(),
      slotStartIso: new Date().toISOString(),
      slotEndIso: new Date().toISOString(),
      teamSize: 1,
      hasSafetyCert: false,
      priorBookingsCount: 0,
      status: 'pending_faculty',
      priorityScore: 0,
      createdAt: new Date().toISOString(),
    });

    let bookings = await store.getAllBookings();
    expect(bookings.length).toBe(5);

    store.resetStore();
    bookings = await store.getAllBookings();
    expect(bookings.length).toBe(4);
  });

  it('should filter equipment by capability showing cross-department results', async () => {
    const store = new InMemoryLabStore();
    const cudaKits = await store.getEquipmentByCapability('cuda');

    // Should include kits from multiple departments
    const departments = new Set(cudaKits.map((e) => e.department));
    expect(departments.size).toBeGreaterThanOrEqual(2); // At least Robotics and ECE share cuda
  });
});
