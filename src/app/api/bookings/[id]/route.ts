/**
 * PATCH /api/bookings/[id]
 * Faculty decision endpoint: approve, reject, or reassign a pending booking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore, generateId } from '@/lib/store';
import { facultyDecisionSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp, MUTATION_RATE_LIMIT } from '@/lib/rateLimit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const { id } = await params;

    // Parse and validate input
    const body: unknown = await request.json();
    const parseResult = facultyDecisionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const decision = parseResult.data;
    const store = getStore();

    // Find the booking
    const booking = await store.getBookingById(id);
    if (!booking) {
      return NextResponse.json(
        { error: `Booking not found: ${id}` },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    switch (decision.action) {
      case 'approve': {
        const updated = await store.updateBooking(id, { status: 'approved' });
        // Remove from waitlist if applicable
        await store.removeFromWaitlist(id);
        return NextResponse.json({
          booking: updated,
          message: `Booking ${id} approved by faculty.`,
          facultyNote: decision.facultyNote ?? null,
        });
      }

      case 'reject': {
        const updated = await store.updateBooking(id, { status: 'rejected' });
        // Remove from waitlist if applicable
        await store.removeFromWaitlist(id);

        // Check if any waitlisted bookings can now be promoted
        const waitlist = await store.getAllWaitlist();
        const equipmentWaitlist = waitlist.filter((w) => w.equipmentId === booking.equipmentId);
        if (equipmentWaitlist.length > 0) {
          // Promote highest priority waitlisted booking
          equipmentWaitlist.sort((a, b) => b.priorityScore - a.priorityScore);
          const promoted = equipmentWaitlist[0];
          await store.updateBooking(promoted.bookingId, { status: 'pending_faculty' });
          await store.removeFromWaitlist(promoted.bookingId);
        }

        return NextResponse.json({
          booking: updated,
          message: `Booking ${id} rejected by faculty.`,
          facultyNote: decision.facultyNote ?? null,
        });
      }

      case 'reassign': {
        // Verify new equipment exists
        const newEquipment = await store.getEquipmentById(decision.reassignEquipmentId!);
        if (!newEquipment) {
          return NextResponse.json(
            { error: `Reassign equipment not found: ${decision.reassignEquipmentId}` },
            { status: 404 }
          );
        }

        // Create a new booking on the reassigned equipment
        const reassignedBooking = {
          ...booking,
          id: generateId('bk'),
          equipmentId: decision.reassignEquipmentId!,
          slotStartIso: decision.reassignSlotStartIso!,
          slotEndIso: decision.reassignSlotEndIso!,
          status: 'approved' as const,
          createdAt: nowIso,
        };

        await store.createBooking(reassignedBooking);
        await store.updateBooking(id, { status: 'rejected' });
        await store.removeFromWaitlist(id);

        return NextResponse.json({
          originalBooking: { ...booking, status: 'rejected' },
          reassignedBooking,
          message: `Booking ${id} reassigned to ${newEquipment.name}.`,
          facultyNote: decision.facultyNote ?? null,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
