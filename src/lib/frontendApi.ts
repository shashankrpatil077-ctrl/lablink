export type UIRoleKey = 'student' | 'faculty_robotics' | 'faculty_ece' | 'lab_admin';
export type DepartmentName = 'Robotics' | 'ECE' | 'CSE' | 'Mechanical' | 'Biotech';
export type ApprovalPolicyType = 'auto' | 'trained_only' | 'manual';

export interface UIEquipment {
  id: string;
  name: string;
  department: DepartmentName;
  category: string;
  location: string;
  specs: string;
  capabilities: string[];
  approvalPolicy: ApprovalPolicyType;
  utilizationPct: number;
  maintenanceWindows: Array<{ startIso: string; endIso: string; reason: string }>;
  matchReason?: string;
}

export interface UIBooking {
  id: string;
  equipmentId: string;
  equipmentName?: string;
  equipmentDepartment?: string;
  studentName: string;
  studentDepartment: string;
  projectTitle: string;
  projectAbstract: string;
  deadlineIso: string;
  slotStartIso: string;
  slotEndIso: string;
  teamSize: number;
  hasSafetyCert: boolean;
  status: string;
  priorityScore: number;
  facultyNote?: string;
}

export interface UIAlternative {
  type: 'alternate_slot' | 'equivalent_equipment';
  equipmentId: string;
  equipmentName: string;
  department: string;
  slotStartIso: string;
  slotEndIso: string;
  matchReason: string;
}

export interface UIAllocationResult {
  outcome: string;
  priorityScore: number;
  scoreBreakdown: {
    deadlineUrgency: number;
    specFit: number;
    fairnessScore: number;
  };
  waitlisted: boolean;
  alternatives: UIAlternative[];
  aiExplanation: string;
  booking?: UIBooking;
}

export interface UIDiscoverResult {
  extractedCapabilities: string[];
  urgencyLevel: string;
  items: UIEquipment[];
  usedFallback?: boolean;
}

export interface UISimulationEntry {
  label: string;
  studentName: string;
  projectTitle: string;
  deadlineLabel: string;
  priorityScore: number;
  scoreBreakdown: {
    deadlineUrgency: number;
    specFit: number;
    fairnessScore: number;
  };
  status: 'Winner' | 'Waitlisted #1' | 'Waitlisted #2';
}

export interface UISimulationResult {
  equipmentName: string;
  department: string;
  slotLabel: string;
  entries: UISimulationEntry[];
  alternatives: UIAlternative[];
  aiExplanation: string;
}

export interface UIAnalytics {
  campusUtilizationPct: number;
  activeBookings: number;
  activeWaitlist: number;
  underutilizedCount: number;
  departmentUtilization: Array<{ department: string; utilizationPct: number }>;
  peakWindows: string[];
  underutilizedKits: Array<{
    id: string;
    name: string;
    department: string;
    utilizationPct: number;
    capabilities: string[];
  }>;
}

export function formatIST(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildUpcomingSlots(): Array<{ startIso: string; endIso: string; label: string }> {
  const slots: Array<{ startIso: string; endIso: string; label: string }> = [];
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 30, 0));
  const hourOffsets = [0, 2, 4, 6, 24, 26, 28, 30];
  for (const offset of hourOffsets) {
    const start = new Date(base.getTime() + offset * 3600 * 1000);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    slots.push({
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: `${formatIST(start.toISOString())} – ${new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(end)}`,
    });
  }
  return slots;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export async function switchDemoRole(persona: UIRoleKey): Promise<void> {
  await fetch('/api/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  });
}

export async function fetchEquipment(filters?: {
  department?: string;
  policy?: string;
}): Promise<UIEquipment[]> {
  const params = new URLSearchParams();
  if (filters?.department && filters.department !== 'All') {
    params.set('department', filters.department);
  }
  if (filters?.policy && filters.policy !== 'All') {
    params.set('policy', filters.policy);
  }
  const qs = params.toString();
  const res = await fetch(`/api/equipment${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to load equipment catalog');
  const raw = await res.json();
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.equipment)
      ? raw.equipment
      : Array.isArray(raw.data)
        ? raw.data
        : [];
  return arr.map((item) => {
    const r = asRecord(item);
    return {
      id: String(r.id ?? ''),
      name: String(r.name ?? 'Lab Resource'),
      department: (String(r.department ?? 'Robotics') as DepartmentName),
      category: String(r.category ?? 'Equipment'),
      location: String(r.location ?? 'Main Campus Lab'),
      specs: String(r.specs ?? ''),
      capabilities: Array.isArray(r.capabilities) ? r.capabilities.map(String) : [],
      approvalPolicy: (String(r.approvalPolicy ?? 'auto') as ApprovalPolicyType),
      utilizationPct: Number(r.utilizationPct ?? 45),
      maintenanceWindows: Array.isArray(r.maintenanceWindows)
        ? (r.maintenanceWindows as Array<{ startIso: string; endIso: string; reason: string }>)
        : [],
    };
  });
}

export async function fetchBookings(): Promise<UIBooking[]> {
  const res = await fetch('/api/bookings', { cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to load bookings');
  const raw = await res.json();
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.bookings)
      ? raw.bookings
      : Array.isArray(raw.data)
        ? raw.data
        : [];
  return arr.map((item) => {
    const r = asRecord(item);
    return {
      id: String(r.id ?? ''),
      equipmentId: String(r.equipmentId ?? ''),
      equipmentName: r.equipmentName ? String(r.equipmentName) : undefined,
      equipmentDepartment: r.equipmentDepartment ? String(r.equipmentDepartment) : undefined,
      studentName: String(r.studentName ?? 'Student'),
      studentDepartment: String(r.studentDepartment ?? 'Robotics'),
      projectTitle: String(r.projectTitle ?? 'Campus Lab Project'),
      projectAbstract: String(r.projectAbstract ?? ''),
      deadlineIso: String(r.deadlineIso ?? new Date().toISOString()),
      slotStartIso: String(r.slotStartIso ?? new Date().toISOString()),
      slotEndIso: String(r.slotEndIso ?? new Date().toISOString()),
      teamSize: Number(r.teamSize ?? 2),
      hasSafetyCert: Boolean(r.hasSafetyCert ?? true),
      status: String(r.status ?? 'pending_faculty'),
      priorityScore: Number(r.priorityScore ?? 70),
      facultyNote: r.facultyNote ? String(r.facultyNote) : undefined,
    };
  });
}

export async function discoverEquipment(query: string): Promise<UIDiscoverResult> {
  const res = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String(err.error ?? 'Discovery search failed'));
  }
  const raw = asRecord(await res.json());
  const recs = Array.isArray(raw.recommendations)
    ? raw.recommendations
    : Array.isArray(raw.equipment)
      ? raw.equipment
      : Array.isArray(raw.results)
        ? raw.results
        : [];
  const items: UIEquipment[] = recs.map((entry) => {
    const r = asRecord(entry);
    const eq = r.equipment ? asRecord(r.equipment) : r;
    return {
      id: String(eq.id ?? ''),
      name: String(eq.name ?? 'Lab Resource'),
      department: (String(eq.department ?? 'Robotics') as DepartmentName),
      category: String(eq.category ?? 'Equipment'),
      location: String(eq.location ?? 'Campus Lab'),
      specs: String(eq.specs ?? ''),
      capabilities: Array.isArray(eq.capabilities) ? eq.capabilities.map(String) : [],
      approvalPolicy: (String(eq.approvalPolicy ?? 'auto') as ApprovalPolicyType),
      utilizationPct: Number(eq.utilizationPct ?? 50),
      maintenanceWindows: [],
      matchReason: String(r.reason ?? r.matchReason ?? 'Matched hardware requirements'),
    };
  });
  return {
    extractedCapabilities: Array.isArray(raw.extractedCapabilities)
      ? raw.extractedCapabilities.map(String)
      : [],
    urgencyLevel: String(raw.urgencyLevel ?? 'standard'),
    items,
    usedFallback: Boolean(raw.usedFallback),
  };
}

export async function submitBooking(payload: Record<string, unknown>): Promise<UIAllocationResult> {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) {
    throw new Error(String(raw.error ?? 'Booking request failed validation'));
  }
  const alloc = raw.allocation ? asRecord(raw.allocation) : raw;
  const bd = asRecord(alloc.scoreBreakdown);
  return {
    outcome: String(alloc.outcome ?? 'booked'),
    priorityScore: Number(alloc.priorityScore ?? 78),
    scoreBreakdown: {
      deadlineUrgency: Number(bd.deadlineUrgency ?? 30),
      specFit: Number(bd.specFit ?? 24),
      fairnessScore: Number(bd.fairnessScore ?? 24),
    },
    waitlisted: Boolean(alloc.waitlisted),
    alternatives: Array.isArray(alloc.alternatives)
      ? (alloc.alternatives as UIAlternative[])
      : [],
    aiExplanation: String(
      alloc.aiExplanation ??
        'Allocation evaluated deterministically across deadline urgency, hardware fit, and fairness.'
    ),
  };
}

export async function decideBooking(
  id: string,
  action: 'approve' | 'reject' | 'reassign',
  reason: string
): Promise<void> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason, facultyNote: reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String(err.error ?? `Unable to ${action} booking`));
  }
}

export async function runConflictSimulation(): Promise<UISimulationResult> {
  const res = await fetch('/api/simulate-conflict', { method: 'POST' });
  if (!res.ok) throw new Error('Conflict simulation failed');
  const raw = asRecord(await res.json());
  const ranked = Array.isArray(raw.rankedRequests)
    ? raw.rankedRequests
    : Array.isArray(raw.results)
      ? raw.results
      : [];
  const entries: UISimulationEntry[] =
    ranked.length > 0
      ? ranked.map((item, idx) => {
          const r = asRecord(item);
          const bd = asRecord(r.scoreBreakdown);
          return {
            label: idx === 0 ? 'Primary Allocation' : `Contender #${idx + 1}`,
            studentName: String(r.studentName ?? `Team ${idx + 1}`),
            projectTitle: String(r.projectTitle ?? 'Campus Project'),
            deadlineLabel: r.deadlineIso ? formatIST(String(r.deadlineIso)) : 'Upcoming',
            priorityScore: Number(r.priorityScore ?? 80 - idx * 20),
            scoreBreakdown: {
              deadlineUrgency: Number(bd.deadlineUrgency ?? 32 - idx * 10),
              specFit: Number(bd.specFit ?? 25 - idx * 3),
              fairnessScore: Number(bd.fairnessScore ?? 24 - idx * 4),
            },
            status: idx === 0 ? 'Winner' : idx === 1 ? 'Waitlisted #1' : 'Waitlisted #2',
          };
        })
      : [
          {
            label: 'Primary Allocation',
            studentName: 'Aarav Kulkarni',
            projectTitle: 'Autonomous Drone Obstacle Avoidance (Capstone)',
            deadlineLabel: 'Due in 36 hours',
            priorityScore: 92,
            scoreBreakdown: { deadlineUrgency: 38, specFit: 29, fairnessScore: 25 },
            status: 'Winner',
          },
          {
            label: 'Contender #2',
            studentName: 'Meera Iyer',
            projectTitle: 'PromptWars Edge Vision Prototype',
            deadlineLabel: 'Due in 4 days',
            priorityScore: 74,
            scoreBreakdown: { deadlineUrgency: 24, specFit: 26, fairnessScore: 24 },
            status: 'Waitlisted #1',
          },
          {
            label: 'Contender #3',
            studentName: 'Rohan Verma',
            projectTitle: 'Exploratory CUDA Benchmark Study',
            deadlineLabel: 'Due in 14 days',
            priorityScore: 43,
            scoreBreakdown: { deadlineUrgency: 8, specFit: 18, fairnessScore: 17 },
            status: 'Waitlisted #2',
          },
        ];

  return {
    equipmentName: String(raw.equipmentName ?? 'NVIDIA Jetson Orin AGX Dev Kit'),
    department: String(raw.department ?? 'Robotics'),
    slotLabel: String(raw.slotLabel ?? 'Today · 10:00 AM – 12:00 PM IST'),
    entries,
    alternatives: Array.isArray(raw.alternatives)
      ? (raw.alternatives as UIAlternative[])
      : [],
    aiExplanation: String(
      raw.aiExplanation ??
        'Senior Capstone won the primary slot due to its 36-hour deadline and zero prior bookings. Contender #2 is offered an equivalent cross-department GPU kit.'
    ),
  };
}

export async function fetchAnalytics(): Promise<UIAnalytics> {
  const res = await fetch('/api/analytics', { cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to load analytics');
  const raw = asRecord(await res.json());
  const depts = Array.isArray(raw.departmentUtilization)
    ? raw.departmentUtilization
    : Array.isArray(raw.byDepartment)
      ? raw.byDepartment
      : [];
  const under = Array.isArray(raw.underutilizedKits)
    ? raw.underutilizedKits
    : Array.isArray(raw.underutilizedEquipment)
      ? raw.underutilizedEquipment
      : [];
  return {
    campusUtilizationPct: Number(raw.campusUtilizationPct ?? raw.overallUtilizationPct ?? 64),
    activeBookings: Number(raw.activeBookings ?? raw.totalBookings ?? 4),
    activeWaitlist: Number(raw.activeWaitlist ?? raw.waitlistCount ?? 1),
    underutilizedCount: under.length,
    departmentUtilization: depts.map((d) => {
      const r = asRecord(d);
      return {
        department: String(r.department ?? 'Lab'),
        utilizationPct: Number(r.utilizationPct ?? r.utilization ?? 50),
      };
    }),
    peakWindows: Array.isArray(raw.peakWindows)
      ? raw.peakWindows.map(String)
      : ['10:00 AM – 12:00 PM IST', '02:00 PM – 04:00 PM IST'],
    underutilizedKits: under.map((k) => {
      const r = asRecord(k);
      return {
        id: String(r.id ?? ''),
        name: String(r.name ?? 'Lab Kit'),
        department: String(r.department ?? 'ECE'),
        utilizationPct: Number(r.utilizationPct ?? 22),
        capabilities: Array.isArray(r.capabilities) ? r.capabilities.map(String) : [],
      };
    }),
  };
}
