/**
 * GET /api/bookings - List all bookings with optional status/role filters.
 * POST /api/bookings - Create a new booking with conflict resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore, generateId } from '@/lib/store';
import { createBookingSchema } from '@/lib/validation';
import { evaluateBookingRequest } from '@/lib/scheduler';
import { explainConflictWithAI } from '@/lib/gemini';
import { checkRateLimit, getClientIp, MUTATION_RATE_LIMIT } from '@/lib/rateLimit';
import type { BookingRequest, BookingStatus } from '@/types/lablink';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const store = getStore();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status') as BookingStatus | null;
    const role = searchParams.get('role');

    let bookings: BookingRequest[];
    if (status) {
      bookings = await store.getBookingsByStatus(status);
    } else {
      bookings = await store.getAllBookings();
    }

    // Filter by role (faculty sees pending, student sees their own)
    if (role === 'faculty') {
      bookings = bookings.filter((bk) => bk.status === 'pending_faculty');
    }

    const waitlist = await store.getAllWaitlist();

    return NextResponse.json({
      bookings,
      total: bookings.length,
      waitlist,
      waitlistCount: waitlist.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(ip, MUTATION_RATE_LIMIT);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.', resetAt: new Date(rateCheck.resetAt).toISOString() },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Parse and validate input
    const body: unknown = await request.json();
    const parseResult = createBookingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const store = getStore();

    // Verify equipment exists
    const equipment = await store.getEquipmentById(input.equipmentId);
    if (!equipment) {
      return NextResponse.json(
        { error: `Equipment not found: ${input.equipmentId}` },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    // Create booking request object
    const bookingRequest: BookingRequest = {
      id: generateId('bk'),
      equipmentId: input.equipmentId,
      studentId: input.studentId,
      studentName: input.studentName,
      studentDepartment: input.studentDepartment,
      projectTitle: input.projectTitle,
      projectAbstract: input.projectAbstract,
      requiredCapabilities: input.requiredCapabilities,
      deadlineIso: input.deadlineIso,
      slotStartIso: input.slotStartIso,
      slotEndIso: input.slotEndIso,
      teamSize: input.teamSize,
      hasSafetyCert: input.hasSafetyCert,
      priorBookingsCount: input.priorBookingsCount,
      status: 'pending_faculty', // Will be updated by evaluateBookingRequest
      priorityScore: 0,
      createdAt: nowIso,
    };

    // Get all existing bookings and equipment for evaluation
    const allBookings = await store.getAllBookings();
    const allEquipment = await store.getAllEquipment();

    // Evaluate the booking
    const result = evaluateBookingRequest(
      bookingRequest,
      equipment,
      allEquipment,
      allBookings,
      nowIso
    );

    // Update booking status based on allocation result
    switch (result.outcome) {
      case 'booked':
        bookingRequest.status = 'approved';
        break;
      case 'pending_faculty':
        bookingRequest.status = 'pending_faculty';
        break;
      case 'blocked_maintenance':
      case 'blocked_safety':
        bookingRequest.status = 'rejected';
        break;
      case 'conflict_resolved':
        if (result.winnerBookingId === bookingRequest.id) {
          bookingRequest.status = 'approved';
          // Waitlist the loser(s)
          for (const loserId of result.waitlisted) {
            await store.updateBooking(loserId, { status: 'waitlisted' });
            await store.addToWaitlist({
              id: generateId('wl'),
              bookingId: loserId,
              equipmentId: equipment.id,
              originalSlotStartIso: bookingRequest.slotStartIso,
              originalSlotEndIso: bookingRequest.slotEndIso,
              priorityScore: 0,
              createdAt: nowIso,
            });
          }
        } else {
          bookingRequest.status = 'waitlisted';
          await store.addToWaitlist({
            id: generateId('wl'),
            bookingId: bookingRequest.id,
            equipmentId: equipment.id,
            originalSlotStartIso: bookingRequest.slotStartIso,
            originalSlotEndIso: bookingRequest.slotEndIso,
            priorityScore: result.priorityScore,
            createdAt: nowIso,
          });
        }
        break;
    }

    bookingRequest.priorityScore = result.priorityScore;

    // Persist the booking
    await store.createBooking(bookingRequest);

    // Get AI explanation
    const aiExplanation = await explainConflictWithAI(bookingRequest, equipment, result);
    result.aiExplanation = aiExplanation;

    return NextResponse.json(
      { booking: bookingRequest, allocation: result },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
