/**
 * Storage Adapter
 * Repository interface with InMemoryLabStore (default) and FirestoreLabStore implementations.
 * Pre-seeds 12 cross-department equipment, 4 bookings, and 2 maintenance windows.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Equipment,
  BookingRequest,
  WaitlistEntry,
  Department,
  ApprovalPolicy,
  CapabilityTag,
  BookingStatus,
} from '@/types/lablink';

/** Repository interface for LabLink data persistence */
export interface LabStore {
  /* Equipment */
  getAllEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | undefined>;
  getEquipmentByDepartment(department: Department): Promise<Equipment[]>;
  getEquipmentByPolicy(policy: ApprovalPolicy): Promise<Equipment[]>;
  getEquipmentByCapability(capability: CapabilityTag): Promise<Equipment[]>;

  /* Bookings */
  getAllBookings(): Promise<BookingRequest[]>;
  getBookingById(id: string): Promise<BookingRequest | undefined>;
  getBookingsByEquipment(equipmentId: string): Promise<BookingRequest[]>;
  getBookingsByStatus(status: BookingStatus): Promise<BookingRequest[]>;
  createBooking(booking: BookingRequest): Promise<BookingRequest>;
  updateBooking(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined>;

  /* Waitlist */
  getAllWaitlist(): Promise<WaitlistEntry[]>;
  addToWaitlist(entry: WaitlistEntry): Promise<WaitlistEntry>;
  removeFromWaitlist(bookingId: string): Promise<boolean>;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

/** 12 realistic cross-department equipment kits */
function createSeedEquipment(): Equipment[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return [
    // Robotics (3 kits)
    {
      id: 'eq-robo-jetson-agx',
      name: 'NVIDIA Jetson Orin AGX Dev Kit',
      department: 'Robotics',
      category: 'Embedded AI Platform',
      location: 'Robotics Lab A, Bench 3',
      specs: '12-core ARM Cortex, 64GB RAM, 275 TOPS AI, 2048-core Ampere GPU',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai', 'robot-arm'],
      approvalPolicy: 'trained_only',
      maintenanceWindows: [
        {
          startIso: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 6, 0).toISOString(),
          endIso: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0).toISOString(),
          reason: 'Scheduled firmware update and thermal paste replacement',
        },
      ],
      dailyCapacityHours: 12,
      status: 'available',
    },
    {
      id: 'eq-robo-ur5e',
      name: 'Universal Robots UR5e Collaborative Arm',
      department: 'Robotics',
      category: 'Robotic Manipulator',
      location: 'Robotics Lab B, Cell 1',
      specs: '5kg payload, 850mm reach, ±0.03mm repeatability, force/torque sensor',
      capabilities: ['robot-arm', 'vision-ai'],
      approvalPolicy: 'manual',
      maintenanceWindows: [],
      dailyCapacityHours: 8,
      status: 'available',
    },
    {
      id: 'eq-robo-lidar',
      name: 'Velodyne VLP-16 LiDAR Scanner',
      department: 'Robotics',
      category: 'Perception Sensor',
      location: 'Robotics Lab A, Station 7',
      specs: '16-channel, 100m range, 300K pts/sec, ±3cm accuracy',
      capabilities: ['lidar', 'vision-ai'],
      approvalPolicy: 'auto',
      maintenanceWindows: [],
      dailyCapacityHours: 10,
      status: 'available',
    },

    // ECE (3 kits)
    {
      id: 'eq-ece-jetson-nano',
      name: 'NVIDIA Jetson Orin Nano Kit',
      department: 'ECE',
      category: 'Embedded AI Platform',
      location: 'ECE Lab 201, Bench 5',
      specs: '6-core ARM Cortex, 8GB RAM, 40 TOPS AI, 1024-core Ampere GPU',
      capabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      approvalPolicy: 'auto',
      maintenanceWindows: [],
      dailyCapacityHours: 14,
      status: 'available',
    },
    {
      id: 'eq-ece-fpga',
      name: 'Xilinx Artix-7 FPGA Dev Board',
      department: 'ECE',
      category: 'Digital Logic Platform',
      location: 'ECE Lab 203, Rack B',
      specs: '215K logic cells, 740 DSP slices, 13Mb BRAM, PCIe Gen2 x4',
      capabilities: ['fpga', 'logic-analyzer'],
      approvalPolicy: 'auto',
      maintenanceWindows: [],
      dailyCapacityHours: 12,
      status: 'available',
    },
    {
      id: 'eq-ece-oscilloscope',
      name: 'Keysight DSOX3104T Oscilloscope',
      department: 'ECE',
      category: 'Test & Measurement',
      location: 'ECE Lab 201, Bench 2',
      specs: '1GHz, 4-channel, 5GSa/s, 10-bit ADC, zone-touch triggering',
      capabilities: ['oscilloscope', 'spectrum-analyzer', 'signal-generator'],
      approvalPolicy: 'auto',
      maintenanceWindows: [
        {
          startIso: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 8, 0).toISOString(),
          endIso: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 12, 0).toISOString(),
          reason: 'Annual calibration and probe certification',
        },
      ],
      dailyCapacityHours: 14,
      status: 'available',
    },

    // CSE (2 kits)
    {
      id: 'eq-cse-rtx4090',
      name: 'RTX 4090 AI Workstation',
      department: 'CSE',
      category: 'GPU Compute',
      location: 'CSE Server Room 101, Rack D',
      specs: 'Dual RTX 4090 (48GB each), 128GB DDR5, 2TB NVMe, Ubuntu 22.04',
      capabilities: ['cuda', 'vision-ai', 'edge-gpu'],
      approvalPolicy: 'auto',
      maintenanceWindows: [],
      dailyCapacityHours: 16,
      status: 'available',
    },
    {
      id: 'eq-cse-3dprinter',
      name: 'Prusa MK4 3D Printer Farm (4 units)',
      department: 'CSE',
      category: 'Prototyping',
      location: 'CSE Maker Space, Room 105',
      specs: 'PLA/PETG/ASA, 250x210x220mm, 0.05mm layer, auto-bed-leveling',
      capabilities: ['3d-print'],
      approvalPolicy: 'auto',
      maintenanceWindows: [],
      dailyCapacityHours: 20,
      status: 'available',
    },

    // Mechanical (2 kits)
    {
      id: 'eq-mech-cnc',
      name: 'Haas TM-1P CNC Mill',
      department: 'Mechanical',
      category: 'CNC Machining',
      location: 'Mechanical Workshop, Bay 2',
      specs: '30x12x16in travel, 7.5HP spindle, 6000RPM, 10-tool ATC',
      capabilities: ['cnc', '3d-print'],
      approvalPolicy: 'manual',
      maintenanceWindows: [],
      dailyCapacityHours: 8,
      status: 'available',
    },
    {
      id: 'eq-mech-thermal',
      name: 'Thermotron SE-600 Environmental Chamber',
      department: 'Mechanical',
      category: 'Thermal Testing',
      location: 'Mechanical Lab 302, Station 4',
      specs: '-70°C to +180°C, 20 cu ft, 10°C/min ramp, humidity 10-98% RH',
      capabilities: ['thermal-chamber'],
      approvalPolicy: 'trained_only',
      maintenanceWindows: [],
      dailyCapacityHours: 10,
      status: 'available',
    },

    // Biotech (2 kits)
    {
      id: 'eq-bio-pcr',
      name: 'Bio-Rad CFX96 Real-Time PCR System',
      department: 'Biotech',
      category: 'Molecular Biology',
      location: 'Biotech Lab 401, Bench 1',
      specs: '96-well, 6-channel multiplex, 0.5°C/sec ramp, FRET capable',
      capabilities: ['pcr', 'gel-electrophoresis'],
      approvalPolicy: 'trained_only',
      maintenanceWindows: [],
      dailyCapacityHours: 10,
      status: 'available',
    },
    {
      id: 'eq-bio-bioprinter',
      name: 'CELLINK BIO X6 Bioprinter',
      department: 'Biotech',
      category: 'Bioprinting',
      location: 'Biotech Lab 403, Clean Room',
      specs: '6 printheads, UV/photo crosslinking, 1μm precision, temp-controlled',
      capabilities: ['bioprinter', '3d-print', 'microscope'],
      approvalPolicy: 'manual',
      maintenanceWindows: [],
      dailyCapacityHours: 6,
      status: 'available',
    },
  ];
}

/** 4 realistic pre-seeded bookings */
function createSeedBookings(): BookingRequest[] {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fiveDaysOut = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tenDaysOut = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  return [
    // Active approved booking on Jetson Orin AGX
    {
      id: 'bk-seed-001',
      equipmentId: 'eq-robo-jetson-agx',
      studentId: 'stu-agarwal-robo',
      studentName: 'Priya Agarwal',
      studentDepartment: 'Robotics',
      projectTitle: 'Autonomous Drone Navigation with Visual SLAM',
      projectAbstract: 'Implementing real-time visual SLAM on Jetson for autonomous indoor drone navigation using stereo depth estimation and neural radiance fields for map reconstruction.',
      requiredCapabilities: ['edge-gpu', 'cuda', 'vision-ai'],
      deadlineIso: threeDaysOut.toISOString(),
      slotStartIso: twoHoursFromNow.toISOString(),
      slotEndIso: sixHoursFromNow.toISOString(),
      teamSize: 2,
      hasSafetyCert: true,
      priorBookingsCount: 3,
      status: 'approved',
      priorityScore: 72,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    // Pending faculty booking on UR5e
    {
      id: 'bk-seed-002',
      equipmentId: 'eq-robo-ur5e',
      studentId: 'stu-chen-mech',
      studentName: 'Wei Chen',
      studentDepartment: 'Mechanical',
      projectTitle: 'Precision Assembly Line Automation',
      projectAbstract: 'Developing force-controlled pick-and-place routines for sub-millimeter precision assembly of micro-electromechanical systems using the UR5e collaborative arm.',
      requiredCapabilities: ['robot-arm'],
      deadlineIso: fiveDaysOut.toISOString(),
      slotStartIso: fourHoursFromNow.toISOString(),
      slotEndIso: eightHoursFromNow.toISOString(),
      teamSize: 3,
      hasSafetyCert: true,
      priorBookingsCount: 1,
      status: 'pending_faculty',
      priorityScore: 65,
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    },
    // Approved booking on RTX 4090
    {
      id: 'bk-seed-003',
      equipmentId: 'eq-cse-rtx4090',
      studentId: 'stu-sharma-cse',
      studentName: 'Aarav Sharma',
      studentDepartment: 'CSE',
      projectTitle: 'Large Language Model Fine-tuning for Code Generation',
      projectAbstract: 'Fine-tuning a 7B parameter code-generation model on domain-specific programming tasks using QLoRA and evaluating on HumanEval benchmarks.',
      requiredCapabilities: ['cuda'],
      deadlineIso: sevenDaysOut.toISOString(),
      slotStartIso: twoHoursFromNow.toISOString(),
      slotEndIso: sixHoursFromNow.toISOString(),
      teamSize: 1,
      hasSafetyCert: false,
      priorBookingsCount: 5,
      status: 'approved',
      priorityScore: 48,
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    },
    // Approved booking on PCR System
    {
      id: 'bk-seed-004',
      equipmentId: 'eq-bio-pcr',
      studentId: 'stu-patel-bio',
      studentName: 'Meera Patel',
      studentDepartment: 'Biotech',
      projectTitle: 'CRISPR Guide RNA Efficiency Screening',
      projectAbstract: 'Quantitative RT-PCR screening of 48 candidate guide RNAs targeting tumor suppressor gene TP53 for CRISPR-Cas9 knockout efficiency in HEK293T cells.',
      requiredCapabilities: ['pcr'],
      deadlineIso: tenDaysOut.toISOString(),
      slotStartIso: fourHoursFromNow.toISOString(),
      slotEndIso: eightHoursFromNow.toISOString(),
      teamSize: 2,
      hasSafetyCert: true,
      priorBookingsCount: 2,
      status: 'approved',
      priorityScore: 55,
      createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// ─── InMemory Implementation ──────────────────────────────────────────────────

/** In-memory store for development and testing */
export class InMemoryLabStore implements LabStore {
  private equipment: Map<string, Equipment> = new Map();
  private bookings: Map<string, BookingRequest> = new Map();
  private waitlist: Map<string, WaitlistEntry> = new Map();

  constructor(seed = true) {
    if (seed) {
      this.seedData();
    }
  }

  /** Reset store to initial seed state (for deterministic testing) */
  resetStore(): void {
    this.equipment.clear();
    this.bookings.clear();
    this.waitlist.clear();
    this.seedData();
  }

  private seedData(): void {
    for (const eq of createSeedEquipment()) {
      this.equipment.set(eq.id, eq);
    }
    for (const bk of createSeedBookings()) {
      this.bookings.set(bk.id, bk);
    }
  }

  // ── Equipment ──
  async getAllEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipment.values());
  }

  async getEquipmentById(id: string): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async getEquipmentByDepartment(department: Department): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter((eq) => eq.department === department);
  }

  async getEquipmentByPolicy(policy: ApprovalPolicy): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter((eq) => eq.approvalPolicy === policy);
  }

  async getEquipmentByCapability(capability: CapabilityTag): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter((eq) =>
      eq.capabilities.includes(capability)
    );
  }

  // ── Bookings ──
  async getAllBookings(): Promise<BookingRequest[]> {
    return Array.from(this.bookings.values());
  }

  async getBookingById(id: string): Promise<BookingRequest | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByEquipment(equipmentId: string): Promise<BookingRequest[]> {
    return Array.from(this.bookings.values()).filter((bk) => bk.equipmentId === equipmentId);
  }

  async getBookingsByStatus(status: BookingStatus): Promise<BookingRequest[]> {
    return Array.from(this.bookings.values()).filter((bk) => bk.status === status);
  }

  async createBooking(booking: BookingRequest): Promise<BookingRequest> {
    this.bookings.set(booking.id, booking);
    return booking;
  }

  async updateBooking(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined> {
    const existing = this.bookings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.bookings.set(id, updated);
    return updated;
  }

  // ── Waitlist ──
  async getAllWaitlist(): Promise<WaitlistEntry[]> {
    return Array.from(this.waitlist.values());
  }

  async addToWaitlist(entry: WaitlistEntry): Promise<WaitlistEntry> {
    this.waitlist.set(entry.bookingId, entry);
    return entry;
  }

  async removeFromWaitlist(bookingId: string): Promise<boolean> {
    return this.waitlist.delete(bookingId);
  }
}

// ─── Firestore Implementation ─────────────────────────────────────────────────

/** Firestore store for production use with Cloud Run ADC */
export class FirestoreLabStore implements LabStore {
  private db: FirebaseFirestore.Firestore;

  constructor() {
    // Dynamic import to avoid loading Firestore SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Firestore } = require('@google-cloud/firestore') as typeof import('@google-cloud/firestore');
    this.db = new Firestore();
  }

  // ── Equipment ──
  async getAllEquipment(): Promise<Equipment[]> {
    const snapshot = await this.db.collection('equipment').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Equipment);
  }

  async getEquipmentById(id: string): Promise<Equipment | undefined> {
    const doc = await this.db.collection('equipment').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as Equipment;
  }

  async getEquipmentByDepartment(department: Department): Promise<Equipment[]> {
    const snapshot = await this.db.collection('equipment').where('department', '==', department).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Equipment);
  }

  async getEquipmentByPolicy(policy: ApprovalPolicy): Promise<Equipment[]> {
    const snapshot = await this.db.collection('equipment').where('approvalPolicy', '==', policy).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Equipment);
  }

  async getEquipmentByCapability(capability: CapabilityTag): Promise<Equipment[]> {
    const snapshot = await this.db.collection('equipment').where('capabilities', 'array-contains', capability).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Equipment);
  }

  // ── Bookings ──
  async getAllBookings(): Promise<BookingRequest[]> {
    const snapshot = await this.db.collection('bookings').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingRequest);
  }

  async getBookingById(id: string): Promise<BookingRequest | undefined> {
    const doc = await this.db.collection('bookings').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as BookingRequest;
  }

  async getBookingsByEquipment(equipmentId: string): Promise<BookingRequest[]> {
    const snapshot = await this.db.collection('bookings').where('equipmentId', '==', equipmentId).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingRequest);
  }

  async getBookingsByStatus(status: BookingStatus): Promise<BookingRequest[]> {
    const snapshot = await this.db.collection('bookings').where('status', '==', status).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingRequest);
  }

  async createBooking(booking: BookingRequest): Promise<BookingRequest> {
    await this.db.collection('bookings').doc(booking.id).set(booking);
    return booking;
  }

  async updateBooking(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined> {
    const docRef = this.db.collection('bookings').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return undefined;
    await docRef.update(updates);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as BookingRequest;
  }

  // ── Waitlist ──
  async getAllWaitlist(): Promise<WaitlistEntry[]> {
    const snapshot = await this.db.collection('waitlist').get();
    return snapshot.docs.map((doc) => ({ ...doc.data() }) as WaitlistEntry);
  }

  async addToWaitlist(entry: WaitlistEntry): Promise<WaitlistEntry> {
    await this.db.collection('waitlist').doc(entry.bookingId).set(entry);
    return entry;
  }

  async removeFromWaitlist(bookingId: string): Promise<boolean> {
    const docRef = this.db.collection('waitlist').doc(bookingId);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }
}

// ─── Store Factory ────────────────────────────────────────────────────────────

let storeInstance: LabStore | null = null;

/** Get or create the singleton store instance */
export function getStore(): LabStore {
  if (storeInstance) return storeInstance;

  if (process.env.USE_FIRESTORE === 'true') {
    storeInstance = new FirestoreLabStore();
  } else {
    storeInstance = new InMemoryLabStore();
  }

  return storeInstance;
}

/** Reset the store singleton (useful for testing) */
export function resetStoreInstance(): void {
  storeInstance = null;
}

/** Generate a unique ID */
export function generateId(prefix: string): string {
  return `${prefix}-${uuidv4().slice(0, 8)}`;
}
