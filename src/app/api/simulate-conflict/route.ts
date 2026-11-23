/**
 * POST /api/simulate-conflict
 * Runs a live, deterministic 3-student peak-contention scenario on the Jetson Orin AGX.
 * Senior Capstone (36h deadline) vs Hackathon Team (4 days) vs Exploratory Study (14 days).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { evaluateBookingRequest, computePriorityScore } from '@/lib/scheduler';
import { explainConflictWithAI } from '@/lib/gemini';
import { checkRateLimit, getClientIp, AI_RATE_LIMIT } from '@/lib/rateLimit';
import type { BookingRequest, AllocationResult } from '@/types/lablink';

interface SimulationEntry {
  booking: BookingRequest;
  allocation: AllocationResult;
  aiExplanation: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(ip, AI_RATE_LIMIT);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.', resetAt: new Date(rateCheck.resetAt).toISOString() },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
      );
    }

    const store = getStore();
    const allEquipment = await store.getAllEquipment();
    const existingBookings = await store.getAllBookings();

    // Target: Jetson Orin AGX
    const jetsonAgx = allEquipment.find((eq) => eq.id === 'eq-robo-jetson-agx');
    if (!jetsonAgx) {
      return NextResponse.json(
        { error: 'Jetson Orin AGX not found in equipment catalog' },
        { status: 500 }
      );
    }

    const now = new Date();
    // Contention slot: 6 hours from now, 3-hour duration
    const slotStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 3 * 60 * 60 * 1000);
    const slotStartIso = slotStart.toISOString();
    const slotEndIso = slotEnd.toISOString();
    const nowIso = now.toISOString();

    // 3 competing students
    const students: BookingRequest[] = [
      {
        id: 'sim-capstone-001',
        equipmentId: jetsonAgx.id,
        studentId: 'stu-sim-priya',
        studentName: 'Priya Kapoor',
        studentDepartment: 'Robotics',
        projectTitle: 'Senior Capstone: Real-Time Object Detection on Edge',
        projectAbstract: 'Final capstone project implementing YOLOv8 on Jetson for autonomous robot obstacle avoidance. Demo due in 36 hours to capstone committee.',
        requiredCapabilities: ['edge-gpu', 'cuda', 'vision-ai'],
        deadlineIso: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
        slotStartIso,
        slotEndIso,
        teamSize: 2,
        hasSafetyCert: true,
        priorBookingsCount: 0,
        status: 'pending_faculty',
        priorityScore: 0,
        createdAt: nowIso,
      },
      {
        id: 'sim-hackathon-002',
        equipmentId: jetsonAgx.id,
        studentId: 'stu-sim-rahul',
        studentName: 'Rahul Verma',
        studentDepartment: 'CSE',
        projectTitle: 'Hackathon: Edge AI Gesture Recognition',
        projectAbstract: 'Cross-department hackathon project building a real-time hand gesture recognition system for HRI applications. Hackathon submission due in 4 days.',
        requiredCapabilities: ['edge-gpu', 'cuda', 'vision-ai'],
        deadlineIso: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        slotStartIso,
        slotEndIso,
        teamSize: 4,
        hasSafetyCert: true,
        priorBookingsCount: 2,
        status: 'pending_faculty',
        priorityScore: 0,
        createdAt: nowIso,
      },
      {
        id: 'sim-explore-003',
        equipmentId: jetsonAgx.id,
        studentId: 'stu-sim-anjali',
        studentName: 'Anjali Deshmukh',
        studentDepartment: 'ECE',
        projectTitle: 'Exploratory Study: CUDA Performance Benchmarking',
        projectAbstract: 'Exploratory benchmarking of CUDA kernels across different Jetson platforms for a semester research paper. No hard deadline, submission in 14 days.',
        requiredCapabilities: ['cuda', 'edge-gpu'],
        deadlineIso: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        slotStartIso,
        slotEndIso,
        teamSize: 1,
        hasSafetyCert: true,
        priorBookingsCount: 4,
        status: 'pending_faculty',
        priorityScore: 0,
        createdAt: nowIso,
      },
    ];

    // Score and evaluate each student
    const results: SimulationEntry[] = [];
    const simulationBookings = [...existingBookings];

    for (const student of students) {
      const { total, breakdown } = computePriorityScore(student, jetsonAgx, nowIso);
      student.priorityScore = total;

      const allocation = evaluateBookingRequest(
        student,
        jetsonAgx,
        allEquipment,
        simulationBookings,
        nowIso
      );

      // If the student wins, add them to existing bookings for subsequent evaluations
      if (allocation.outcome === 'booked' || allocation.outcome === 'pending_faculty') {
        student.status = allocation.outcome === 'booked' ? 'approved' : 'pending_faculty';
        simulationBookings.push(student);
      } else if (allocation.outcome === 'conflict_resolved') {
        if (allocation.winnerBookingId === student.id) {
          student.status = 'approved';
          simulationBookings.push(student);
        } else {
          student.status = 'waitlisted';
        }
      } else {
        student.status = 'rejected';
      }

      allocation.priorityScore = total;
      allocation.scoreBreakdown = breakdown;

      const aiExplanation = await explainConflictWithAI(student, jetsonAgx, allocation);
      allocation.aiExplanation = aiExplanation;

      results.push({
        booking: student,
        allocation,
        aiExplanation,
      });
    }

    // Sort by priority score (highest first)
    results.sort((a, b) => b.booking.priorityScore - a.booking.priorityScore);

    return NextResponse.json({
      scenario: '3-student peak contention on Jetson Orin AGX',
      targetEquipment: {
        id: jetsonAgx.id,
        name: jetsonAgx.name,
        department: jetsonAgx.department,
        capabilities: jetsonAgx.capabilities,
      },
      results,
      summary: {
        totalStudents: 3,
        approved: results.filter((r) => r.booking.status === 'approved').length,
        waitlisted: results.filter((r) => r.booking.status === 'waitlisted').length,
        rejected: results.filter((r) => r.booking.status === 'rejected').length,
        pendingFaculty: results.filter((r) => r.booking.status === 'pending_faculty').length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
