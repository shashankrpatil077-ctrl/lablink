/**
 * Deterministic Conflict & Fairness Engine
 * Pure, side-effect-free functions for interval overlap, priority scoring,
 * conflict resolution, and utilization analytics. Zero LLM calls.
 */

import type {
  BookingRequest,
  Equipment,
  AllocationResult,
  AllocationOutcome,
  ScoreBreakdown,
  Alternative,
  WaitlistEntry,
  UtilizationReport,
  DepartmentUtilization,
  PeakContentionWindow,
  UnderutilizedKit,
  Department,
} from '@/types/lablink';

/**
 * Checks if two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 * Back-to-back slots (e.g., 10:00–12:00 and 12:00–14:00) do NOT conflict.
 *
 * @param aStartIso - Start of interval A (ISO 8601)
 * @param aEndIso - End of interval A (ISO 8601)
 * @param bStartIso - Start of interval B (ISO 8601)
 * @param bEndIso - End of interval B (ISO 8601)
 * @returns true if the intervals overlap
 */
export function hasIntervalOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string
): boolean {
  const aStart = new Date(aStartIso).getTime();
  const aEnd = new Date(aEndIso).getTime();
  const bStart = new Date(bStartIso).getTime();
  const bEnd = new Date(bEndIso).getTime();

  // Half-open interval overlap: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Computes a priority score (0–100) for a booking request with exact breakdown.
 *
 * @param request - The booking request to score
 * @param equipment - The target equipment
 * @param nowIso - Current timestamp (ISO 8601)
 * @returns Object with total score and component breakdown
 */
export function computePriorityScore(
  request: BookingRequest,
  equipment: Equipment,
  nowIso: string
): { total: number; breakdown: ScoreBreakdown } {
  const now = new Date(nowIso).getTime();
  const deadline = new Date(request.deadlineIso).getTime();
  const hoursUntilDeadline = Math.max(0, (deadline - now) / (1000 * 60 * 60));

  // ── Deadline Urgency (0–40) ──
  let deadlineUrgency: number;
  if (hoursUntilDeadline <= 24) {
    deadlineUrgency = 40;
  } else if (hoursUntilDeadline <= 48) {
    deadlineUrgency = 38;
  } else if (hoursUntilDeadline <= 72) {
    deadlineUrgency = 34;
  } else if (hoursUntilDeadline <= 120) { // 5 days
    deadlineUrgency = 28;
  } else if (hoursUntilDeadline <= 168) { // 7 days
    deadlineUrgency = 22;
  } else if (hoursUntilDeadline <= 240) { // 10 days
    deadlineUrgency = 16;
  } else if (hoursUntilDeadline <= 336) { // 14 days
    deadlineUrgency = 10;
  } else {
    deadlineUrgency = 8;
  }

  // ── Spec Fit (0–30) ──
  let specFit: number;
  if (request.requiredCapabilities.length === 0) {
    specFit = 22; // Default when no capabilities specified
  } else {
    const matchedCaps = request.requiredCapabilities.filter((cap) =>
      equipment.capabilities.includes(cap)
    );
    specFit = Math.round((matchedCaps.length / request.requiredCapabilities.length) * 30);
  }

  // ── Fairness Score (0–30) ──
  // Anti-hoarding: penalize students with many prior bookings
  const fairnessScore = Math.max(5, 30 - request.priorBookingsCount * 5);

  const total = deadlineUrgency + specFit + fairnessScore;

  return {
    total: Math.min(100, total),
    breakdown: { deadlineUrgency, specFit, fairnessScore },
  };
}

/**
 * Finds the next available non-maintenance slot on the same equipment
 * within the next 48 hours.
 */
function findAlternateSlot(
  equipment: Equipment,
  existingBookings: BookingRequest[],
  requestedDurationMs: number,
  afterIso: string
): Alternative | null {
  const after = new Date(afterIso).getTime();
  const maxSearch = after + 48 * 60 * 60 * 1000; // 48 hours ahead
  const slotStep = 60 * 60 * 1000; // 1-hour steps

  const equipBookings = existingBookings.filter(
    (bk) => bk.equipmentId === equipment.id && (bk.status === 'approved' || bk.status === 'pending_faculty')
  );

  for (let candidateStart = after + slotStep; candidateStart + requestedDurationMs <= maxSearch; candidateStart += slotStep) {
    const candidateEnd = candidateStart + requestedDurationMs;
    const candidateStartIso = new Date(candidateStart).toISOString();
    const candidateEndIso = new Date(candidateEnd).toISOString();

    // Check maintenance windows
    const hitsMaintenanceSlot = equipment.maintenanceWindows.some((mw) =>
      hasIntervalOverlap(candidateStartIso, candidateEndIso, mw.startIso, mw.endIso)
    );
    if (hitsMaintenanceSlot) continue;

    // Check existing bookings
    const hasConflict = equipBookings.some((bk) =>
      hasIntervalOverlap(candidateStartIso, candidateEndIso, bk.slotStartIso, bk.slotEndIso)
    );
    if (hasConflict) continue;

    return {
      type: 'alternate_slot',
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      department: equipment.department,
      slotStartIso: candidateStartIso,
      slotEndIso: candidateEndIso,
      matchReason: `Next available ${requestedDurationMs / (60 * 60 * 1000)}-hour slot on the same equipment`,
    };
  }

  return null;
}

/**
 * Finds a cross-department equivalent kit with overlapping capabilities
 * that has an open slot at or near the requested time.
 */
function findEquivalentEquipment(
  request: BookingRequest,
  targetEquipment: Equipment,
  allEquipment: Equipment[],
  existingBookings: BookingRequest[],
  requestedDurationMs: number
): Alternative | null {
  // Find kits sharing capabilities with the target equipment (cross-department preferred)
  const candidates = allEquipment.filter((eq) => {
    if (eq.id === targetEquipment.id) return false;
    const sharedCaps = eq.capabilities.filter((cap) =>
      targetEquipment.capabilities.includes(cap)
    );
    return sharedCaps.length > 0;
  });

  // Sort by capability overlap (best match first)
  candidates.sort((a, b) => {
    const aOverlap = a.capabilities.filter((cap) => targetEquipment.capabilities.includes(cap)).length;
    const bOverlap = b.capabilities.filter((cap) => targetEquipment.capabilities.includes(cap)).length;
    return bOverlap - aOverlap;
  });

  for (const candidate of candidates) {
    const candidateBookings = existingBookings.filter(
      (bk) => bk.equipmentId === candidate.id && (bk.status === 'approved' || bk.status === 'pending_faculty')
    );

    // Try the exact requested time first
    const hasConflictAtRequestedTime = candidateBookings.some((bk) =>
      hasIntervalOverlap(request.slotStartIso, request.slotEndIso, bk.slotStartIso, bk.slotEndIso)
    );
    const hitsMaintenanceSlot = candidate.maintenanceWindows.some((mw) =>
      hasIntervalOverlap(request.slotStartIso, request.slotEndIso, mw.startIso, mw.endIso)
    );

    if (!hasConflictAtRequestedTime && !hitsMaintenanceSlot) {
      const sharedCaps = candidate.capabilities.filter((cap) =>
        targetEquipment.capabilities.includes(cap)
      );
      return {
        type: 'equivalent_equipment',
        equipmentId: candidate.id,
        equipmentName: candidate.name,
        department: candidate.department,
        slotStartIso: request.slotStartIso,
        slotEndIso: request.slotEndIso,
        matchReason: `Cross-department equivalent sharing capabilities: ${sharedCaps.join(', ')}`,
      };
    }

    // Try nearby slots on the candidate equipment
    const altSlot = findAlternateSlot(candidate, existingBookings, requestedDurationMs, request.slotStartIso);
    if (altSlot) {
      const sharedCaps = candidate.capabilities.filter((cap) =>
        targetEquipment.capabilities.includes(cap)
      );
      return {
        type: 'equivalent_equipment',
        equipmentId: candidate.id,
        equipmentName: candidate.name,
        department: candidate.department,
        slotStartIso: altSlot.slotStartIso,
        slotEndIso: altSlot.slotEndIso,
        matchReason: `Cross-department equivalent sharing capabilities: ${sharedCaps.join(', ')}`,
      };
    }
  }

  return null;
}

/**
 * Evaluates a booking request against hard constraints, existing bookings,
 * and cross-department alternatives.
 *
 * Step A: Hard constraints (maintenance, safety)
 * Step B: Conflict check on same equipment
 * Step C: No conflict → approve or route to faculty
 * Step D: Conflict → resolve by priority, generate alternatives
 *
 * @param request - The incoming booking request
 * @param equipment - The target equipment
 * @param allEquipment - Full equipment catalog (for cross-dept alternatives)
 * @param existingBookings - All existing bookings
 * @param nowIso - Current timestamp
 * @returns AllocationResult with outcome, waitlist, and alternatives
 */
export function evaluateBookingRequest(
  request: BookingRequest,
  equipment: Equipment,
  allEquipment: Equipment[],
  existingBookings: BookingRequest[],
  nowIso: string
): AllocationResult {
  const { total: priorityScore, breakdown: scoreBreakdown } = computePriorityScore(request, equipment, nowIso);
  const requestDurationMs = new Date(request.slotEndIso).getTime() - new Date(request.slotStartIso).getTime();

  // ── Step A: Hard Constraints ──

  // A1: Maintenance window blocking
  const hitsMaintenanceSlot = equipment.maintenanceWindows.some((mw) =>
    hasIntervalOverlap(request.slotStartIso, request.slotEndIso, mw.startIso, mw.endIso)
  );
  if (hitsMaintenanceSlot) {
    const alternatives: Alternative[] = [];
    const altSlot = findAlternateSlot(equipment, existingBookings, requestDurationMs, request.slotStartIso);
    if (altSlot) alternatives.push(altSlot);
    const equivKit = findEquivalentEquipment(request, equipment, allEquipment, existingBookings, requestDurationMs);
    if (equivKit) alternatives.push(equivKit);

    return {
      outcome: 'blocked_maintenance',
      winnerBookingId: '',
      priorityScore,
      scoreBreakdown,
      waitlisted: [],
      alternatives,
      aiExplanation: '',
    };
  }

  // A2: Safety cert blocking on trained_only/manual equipment
  if (equipment.approvalPolicy !== 'auto' && !request.hasSafetyCert) {
    return {
      outcome: 'blocked_safety',
      winnerBookingId: '',
      priorityScore,
      scoreBreakdown,
      waitlisted: [],
      alternatives: [],
      aiExplanation: '',
    };
  }

  // ── Step B: Conflict Check ──
  const conflictingBookings = existingBookings.filter(
    (bk) =>
      bk.equipmentId === equipment.id &&
      (bk.status === 'approved' || bk.status === 'pending_faculty') &&
      bk.id !== request.id &&
      hasIntervalOverlap(request.slotStartIso, request.slotEndIso, bk.slotStartIso, bk.slotEndIso)
  );

  // ── Step C: No Conflict ──
  if (conflictingBookings.length === 0) {
    let outcome: AllocationOutcome;
    if (equipment.approvalPolicy === 'auto') {
      outcome = 'booked';
    } else if (equipment.approvalPolicy === 'trained_only' && request.hasSafetyCert) {
      outcome = 'booked';
    } else {
      outcome = 'pending_faculty';
    }

    return {
      outcome,
      winnerBookingId: request.id,
      priorityScore,
      scoreBreakdown,
      waitlisted: [],
      alternatives: [],
      aiExplanation: '',
    };
  }

  // ── Step D: Conflict Resolution ──
  // Compare incoming request with highest-priority conflicting booking
  const conflictScores = conflictingBookings.map((bk) => ({
    booking: bk,
    score: computePriorityScore(bk, equipment, nowIso).total,
  }));
  conflictScores.sort((a, b) => b.score - a.score);

  const topConflict = conflictScores[0];
  const incomingWins = priorityScore > topConflict.score;

  const winnerId = incomingWins ? request.id : topConflict.booking.id;
  const loserId = incomingWins ? topConflict.booking.id : request.id;

  // Find alternatives for the loser
  const alternatives: Alternative[] = [];
  const altSlot = findAlternateSlot(equipment, existingBookings, requestDurationMs, request.slotStartIso);
  if (altSlot) alternatives.push(altSlot);
  const equivKit = findEquivalentEquipment(request, equipment, allEquipment, existingBookings, requestDurationMs);
  if (equivKit) alternatives.push(equivKit);

  return {
    outcome: 'conflict_resolved',
    winnerBookingId: winnerId,
    priorityScore,
    scoreBreakdown,
    waitlisted: [loserId],
    alternatives,
    aiExplanation: '',
  };
}

/**
 * Computes campus-wide utilization analytics.
 *
 * @param allEquipment - Full equipment catalog
 * @param allBookings - All bookings (any status)
 * @param waitlist - Current waitlist entries
 * @returns UtilizationReport with campus, department, and per-kit metrics
 */
export function computeUtilizationAnalytics(
  allEquipment: Equipment[],
  allBookings: BookingRequest[],
  waitlist: WaitlistEntry[]
): UtilizationReport {
  const activeBookings = allBookings.filter(
    (bk) => bk.status === 'approved' || bk.status === 'pending_faculty'
  );

  // ── Campus-wide utilization ──
  let totalCapacityHours = 0;
  let totalBookedHours = 0;

  const departments: Department[] = ['Robotics', 'ECE', 'CSE', 'Mechanical', 'Biotech'];
  const deptUtilization: DepartmentUtilization[] = [];

  for (const dept of departments) {
    const deptEquipment = allEquipment.filter((eq) => eq.department === dept);
    const deptCapacity = deptEquipment.reduce((sum, eq) => sum + eq.dailyCapacityHours, 0);
    const deptBookings = activeBookings.filter((bk) =>
      deptEquipment.some((eq) => eq.id === bk.equipmentId)
    );
    const deptBooked = deptBookings.reduce((sum, bk) => {
      const duration = (new Date(bk.slotEndIso).getTime() - new Date(bk.slotStartIso).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    totalCapacityHours += deptCapacity;
    totalBookedHours += deptBooked;

    deptUtilization.push({
      department: dept,
      utilizationPercent: deptCapacity > 0 ? Math.round((deptBooked / deptCapacity) * 100) : 0,
      totalCapacityHours: deptCapacity,
      bookedHours: Math.round(deptBooked * 100) / 100,
    });
  }

  // ── Peak contention windows ──
  const peakWindows: PeakContentionWindow[] = [];
  if (activeBookings.length > 1) {
    // Find time ranges with most overlapping bookings
    const events: Array<{ time: number; type: 'start' | 'end'; bookingId: string; equipmentId: string }> = [];
    for (const bk of activeBookings) {
      events.push({ time: new Date(bk.slotStartIso).getTime(), type: 'start', bookingId: bk.id, equipmentId: bk.equipmentId });
      events.push({ time: new Date(bk.slotEndIso).getTime(), type: 'end', bookingId: bk.id, equipmentId: bk.equipmentId });
    }
    events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1));

    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const activeSet = new Set<string>();
    let peakStart = 0;

    for (const event of events) {
      if (event.type === 'start') {
        currentConcurrent++;
        activeSet.add(event.equipmentId);
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent;
          peakStart = event.time;
        }
      } else {
        currentConcurrent--;
      }
    }

    if (maxConcurrent >= 2) {
      // Find the window where peak concurrent bookings occur
      const peakBookings = activeBookings.filter((bk) => {
        const start = new Date(bk.slotStartIso).getTime();
        const end = new Date(bk.slotEndIso).getTime();
        return start <= peakStart && end > peakStart;
      });

      if (peakBookings.length > 0) {
        const windowEnd = Math.min(...peakBookings.map((bk) => new Date(bk.slotEndIso).getTime()));
        peakWindows.push({
          windowStartIso: new Date(peakStart).toISOString(),
          windowEndIso: new Date(windowEnd).toISOString(),
          overlappingBookings: peakBookings.length,
          equipmentIds: [...new Set(peakBookings.map((bk) => bk.equipmentId))],
        });
      }
    }
  }

  // ── Underutilized kits (<35% utilization) ──
  const underutilizedKits: UnderutilizedKit[] = [];
  for (const eq of allEquipment) {
    const eqBookings = activeBookings.filter((bk) => bk.equipmentId === eq.id);
    const bookedHours = eqBookings.reduce((sum, bk) => {
      const duration = (new Date(bk.slotEndIso).getTime() - new Date(bk.slotStartIso).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);
    const utilPercent = eq.dailyCapacityHours > 0 ? Math.round((bookedHours / eq.dailyCapacityHours) * 100) : 0;

    if (utilPercent < 35) {
      underutilizedKits.push({
        equipmentId: eq.id,
        equipmentName: eq.name,
        department: eq.department,
        utilizationPercent: utilPercent,
        capabilities: eq.capabilities,
      });
    }
  }

  return {
    campusUtilizationPercent: totalCapacityHours > 0 ? Math.round((totalBookedHours / totalCapacityHours) * 100) : 0,
    departmentUtilization: deptUtilization,
    peakContentionWindows: peakWindows,
    activeWaitlistCount: waitlist.length,
    underutilizedKits,
  };
}
