/**
 * Zod Validation Schemas
 * Strict input validation for all LabLink API endpoints.
 */

import { z } from 'zod';

/** Valid department values */
const departmentEnum = z.enum(['Robotics', 'ECE', 'CSE', 'Mechanical', 'Biotech']);

/** Valid capability tags */
const capabilityTagEnum = z.enum([
  'edge-gpu', 'cuda', 'fpga', 'oscilloscope', '3d-print',
  'robot-arm', 'pcr', 'vision-ai', 'lidar', 'cnc',
  'laser-cutter', 'spectrum-analyzer', 'bioprinter', 'thermal-chamber',
  'logic-analyzer', 'signal-generator', 'soldering-station',
  'microscope', 'centrifuge', 'gel-electrophoresis',
]);

/** ISO 8601 datetime string pattern */
const isoDatetime = z.string().min(1).refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO 8601 datetime string' }
);

/**
 * Schema for equipment discovery queries.
 * Validates natural-language search input from students.
 */
export const discoverSchema = z.object({
  query: z.string()
    .min(3, 'Query must be at least 3 characters')
    .max(500, 'Query must not exceed 500 characters')
    .trim(),
});

/**
 * Schema for creating a new booking request.
 * Enforces temporal constraints and bounded field lengths.
 */
export const createBookingSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required').max(100),
  studentId: z.string().min(1, 'Student ID is required').max(100),
  studentName: z.string().min(1, 'Student name is required').max(200),
  studentDepartment: departmentEnum,
  projectTitle: z.string()
    .min(3, 'Project title must be at least 3 characters')
    .max(300, 'Project title must not exceed 300 characters'),
  projectAbstract: z.string()
    .min(10, 'Project abstract must be at least 10 characters')
    .max(2000, 'Project abstract must not exceed 2000 characters'),
  requiredCapabilities: z.array(capabilityTagEnum).default([]),
  deadlineIso: isoDatetime,
  slotStartIso: isoDatetime,
  slotEndIso: isoDatetime,
  teamSize: z.number()
    .int('Team size must be a whole number')
    .min(1, 'Team size must be at least 1')
    .max(10, 'Team size must not exceed 10'),
  hasSafetyCert: z.boolean(),
  priorBookingsCount: z.number().int().min(0).default(0),
}).refine(
  (data) => new Date(data.slotEndIso).getTime() > new Date(data.slotStartIso).getTime(),
  { message: 'slotEndIso must be after slotStartIso', path: ['slotEndIso'] }
).refine(
  (data) => {
    const durationMs = new Date(data.slotEndIso).getTime() - new Date(data.slotStartIso).getTime();
    const maxDurationMs = 8 * 60 * 60 * 1000; // 8 hours
    return durationMs <= maxDurationMs;
  },
  { message: 'Booking slot must not exceed 8 hours', path: ['slotEndIso'] }
);

/**
 * Schema for faculty decisions on pending bookings.
 * Supports approve, reject, and reassign actions.
 */
export const facultyDecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'reassign']),
  reassignEquipmentId: z.string().max(100).optional(),
  reassignSlotStartIso: isoDatetime.optional(),
  reassignSlotEndIso: isoDatetime.optional(),
  facultyNote: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.action === 'reassign') {
      return !!data.reassignEquipmentId && !!data.reassignSlotStartIso && !!data.reassignSlotEndIso;
    }
    return true;
  },
  { message: 'Reassign action requires reassignEquipmentId, reassignSlotStartIso, and reassignSlotEndIso', path: ['action'] }
).refine(
  (data) => {
    if (data.action === 'reassign' && data.reassignSlotStartIso && data.reassignSlotEndIso) {
      return new Date(data.reassignSlotEndIso).getTime() > new Date(data.reassignSlotStartIso).getTime();
    }
    return true;
  },
  { message: 'reassignSlotEndIso must be after reassignSlotStartIso', path: ['reassignSlotEndIso'] }
);

/** Inferred types from Zod schemas */
export type DiscoverInput = z.infer<typeof discoverSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type FacultyDecisionInput = z.infer<typeof facultyDecisionSchema>;
