/**
 * GET /api/analytics
 * Returns campus-wide utilization analytics, per-department metrics,
 * peak contention windows, and underutilized equipment candidates.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { computeUtilizationAnalytics } from '@/lib/scheduler';

export async function GET(): Promise<NextResponse> {
  try {
    const store = getStore();

    const allEquipment = await store.getAllEquipment();
    const allBookings = await store.getAllBookings();
    const waitlist = await store.getAllWaitlist();

    const report = computeUtilizationAnalytics(allEquipment, allBookings, waitlist);
    const activeBookings = allBookings.filter(
      (b) => b.status === 'approved' || b.status === 'pending_faculty'
    );

    return NextResponse.json({
      ...report,
      activeBookingsCount: activeBookings.length,
      totalBookingsCount: allBookings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
