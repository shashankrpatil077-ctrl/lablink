// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { StudentWorkspace } from '@/components/StudentWorkspace';
import { FacultyWorkspace } from '@/components/FacultyWorkspace';
import { AdminWorkspace } from '@/components/AdminWorkspace';
import { ConflictSimulatorModal } from '@/components/ConflictSimulatorModal';
import type { UIAnalytics, UIBooking, UIEquipment, UISimulationResult } from '@/lib/frontendApi';

const MOCK_EQUIPMENT: UIEquipment[] = [
  {
    id: 'eq-jetson-agx',
    name: 'NVIDIA Jetson Orin AGX Dev Kit',
    department: 'Robotics',
    category: 'Edge AI Compute',
    location: 'Robotics Lab R-204',
    specs: '64GB RAM, 275 TOPS',
    capabilities: ['cuda', 'vision-ai', 'edge-gpu'],
    approvalPolicy: 'trained_only',
    utilizationPct: 82,
    maintenanceWindows: [],
  },
];

const MOCK_BOOKINGS: UIBooking[] = [
  {
    id: 'bk-01',
    equipmentId: 'eq-jetson-agx',
    equipmentName: 'NVIDIA Jetson Orin AGX Dev Kit',
    equipmentDepartment: 'Robotics',
    studentName: 'Aarav Kulkarni',
    studentDepartment: 'Robotics',
    projectTitle: 'Autonomous Drone Vision',
    projectAbstract: 'Real-time YOLOv8 obstacle avoidance.',
    deadlineIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    slotStartIso: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    slotEndIso: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    teamSize: 3,
    hasSafetyCert: true,
    status: 'pending_faculty',
    priorityScore: 92,
  },
];

const MOCK_ANALYTICS: UIAnalytics = {
  campusUtilizationPct: 68,
  activeBookings: 4,
  activeWaitlist: 1,
  underutilizedCount: 2,
  departmentUtilization: [
    { department: 'Robotics', utilizationPct: 82 },
    { department: 'ECE', utilizationPct: 54 },
  ],
  peakWindows: ['10:00 AM – 12:00 PM IST'],
  underutilizedKits: [
    {
      id: 'eq-pcr',
      name: 'Bio-Rad PCR Thermal Cycler',
      department: 'Biotech',
      utilizationPct: 24,
      capabilities: ['pcr', 'thermal-cycling'],
    },
  ],
};

const MOCK_SIM: UISimulationResult = {
  equipmentName: 'NVIDIA Jetson Orin AGX Dev Kit',
  department: 'Robotics',
  slotLabel: 'Today · 10:00 AM – 12:00 PM IST',
  entries: [
    {
      label: 'Primary Allocation',
      studentName: 'Aarav Kulkarni',
      projectTitle: 'Drone Capstone',
      deadlineLabel: '36h',
      priorityScore: 92,
      scoreBreakdown: { deadlineUrgency: 38, specFit: 29, fairnessScore: 25 },
      status: 'Winner',
    },
  ],
  alternatives: [],
  aiExplanation: 'Senior Capstone prioritized by urgency and fairness.',
};

describe('LabLink WCAG 2.1 AA Accessibility Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('StudentWorkspace + accessible slot picker has zero axe violations', async () => {
    const { container } = render(
      <StudentWorkspace
        equipment={MOCK_EQUIPMENT}
        bookings={MOCK_BOOKINGS}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup', { name: /Select Time Slot/i })).toBeTruthy();
    const { violations } = await axe(container);
    expect(violations).toEqual([]);
  });

  it('FacultyWorkspace has zero axe violations', async () => {
    const { container } = render(
      <FacultyWorkspace
        facultyDepartment="Robotics"
        bookings={MOCK_BOOKINGS}
        equipment={MOCK_EQUIPMENT}
        onRefresh={vi.fn()}
      />
    );
    const { violations } = await axe(container);
    expect(violations).toEqual([]);
  });

  it('AdminWorkspace has zero axe violations', async () => {
    const { container } = render(<AdminWorkspace analytics={MOCK_ANALYTICS} />);
    const { violations } = await axe(container);
    expect(violations).toEqual([]);
  });

  it('ConflictSimulatorModal has zero axe violations', async () => {
    const { container } = render(
      <ConflictSimulatorModal
        open
        loading={false}
        data={MOCK_SIM}
        error={null}
        onClose={vi.fn()}
      />
    );
    const { violations } = await axe(container);
    expect(violations).toEqual([]);
  });
});
