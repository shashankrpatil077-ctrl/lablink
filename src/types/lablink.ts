/**
 * LabLink Domain Types
 * Strongly-typed interfaces for the campus laboratory resource-sharing platform.
 */

/** Supported academic departments */
export type Department = 'Robotics' | 'ECE' | 'CSE' | 'Mechanical' | 'Biotech';

/** Equipment approval policies */
export type ApprovalPolicy = 'auto' | 'trained_only' | 'manual';

/** Booking request statuses */
export type BookingStatus = 'approved' | 'pending_faculty' | 'waitlisted' | 'rejected';

/** Equipment operational status */
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'offline';

/** Normalized capability tags for cross-department matching */
export type CapabilityTag =
  | 'edge-gpu'
  | 'cuda'
  | 'fpga'
  | 'oscilloscope'
  | '3d-print'
  | 'robot-arm'
  | 'pcr'
  | 'vision-ai'
  | 'lidar'
  | 'cnc'
  | 'laser-cutter'
  | 'spectrum-analyzer'
  | 'bioprinter'
  | 'thermal-chamber'
  | 'logic-analyzer'
  | 'signal-generator'
  | 'soldering-station'
  | 'microscope'
  | 'centrifuge'
  | 'gel-electrophoresis';

/** Maintenance window for equipment downtime */
export interface MaintenanceWindow {
  startIso: string;
  endIso: string;
  reason: string;
}

/** Laboratory equipment */
export interface Equipment {
  id: string;
  name: string;
  department: Department;
  category: string;
  location: string;
  specs: string;
  capabilities: CapabilityTag[];
  approvalPolicy: ApprovalPolicy;
  maintenanceWindows: MaintenanceWindow[];
  dailyCapacityHours: number;
  status: EquipmentStatus;
}

/** Student booking request */
export interface BookingRequest {
  id: string;
  equipmentId: string;
  studentId: string;
  studentName: string;
  studentDepartment: Department;
  projectTitle: string;
  projectAbstract: string;
  requiredCapabilities: CapabilityTag[];
  deadlineIso: string;
  slotStartIso: string;
  slotEndIso: string;
  teamSize: number;
  hasSafetyCert: boolean;
  priorBookingsCount: number;
  status: BookingStatus;
  priorityScore: number;
  createdAt: string;
}

/** Alternative slot or equipment suggestion */
export interface Alternative {
  type: 'alternate_slot' | 'equivalent_equipment';
  equipmentId: string;
  equipmentName: string;
  department: Department;
  slotStartIso: string;
  slotEndIso: string;
  matchReason: string;
}

/** Outcome of a booking allocation evaluation */
export type AllocationOutcome =
  | 'booked'
  | 'pending_faculty'
  | 'conflict_resolved'
  | 'blocked_maintenance'
  | 'blocked_safety';

/** Score breakdown for priority computation */
export interface ScoreBreakdown {
  deadlineUrgency: number;
  specFit: number;
  fairnessScore: number;
}

/** Result of evaluating a booking request against existing bookings */
export interface AllocationResult {
  outcome: AllocationOutcome;
  winnerBookingId: string;
  priorityScore: number;
  scoreBreakdown: ScoreBreakdown;
  waitlisted: string[];
  alternatives: Alternative[];
  aiExplanation: string;
}

/** Waitlisted booking entry */
export interface WaitlistEntry {
  id: string;
  bookingId: string;
  equipmentId: string;
  originalSlotStartIso: string;
  originalSlotEndIso: string;
  priorityScore: number;
  createdAt: string;
}

/** Per-department utilization data */
export interface DepartmentUtilization {
  department: Department;
  utilizationPercent: number;
  totalCapacityHours: number;
  bookedHours: number;
}

/** Peak contention window */
export interface PeakContentionWindow {
  windowStartIso: string;
  windowEndIso: string;
  overlappingBookings: number;
  equipmentIds: string[];
}

/** Underutilized equipment candidate for cross-department sharing */
export interface UnderutilizedKit {
  equipmentId: string;
  equipmentName: string;
  department: Department;
  utilizationPercent: number;
  capabilities: CapabilityTag[];
}

/** Campus-wide utilization analytics report */
export interface UtilizationReport {
  campusUtilizationPercent: number;
  departmentUtilization: DepartmentUtilization[];
  peakContentionWindows: PeakContentionWindow[];
  activeWaitlistCount: number;
  underutilizedKits: UnderutilizedKit[];
}
