/**
 * GET /api/equipment
 * Lists all equipment with optional filters for department, policy, and capability.
 * Returns each kit's current bookings and utilization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import type { Department, ApprovalPolicy, CapabilityTag } from '@/types/lablink';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const store = getStore();
    const { searchParams } = request.nextUrl;

    const department = searchParams.get('department') as Department | null;
    const policy = searchParams.get('policy') as ApprovalPolicy | null;
    const capability = searchParams.get('capability') as CapabilityTag | null;

    let equipment;

    if (department) {
      equipment = await store.getEquipmentByDepartment(department);
    } else if (policy) {
      equipment = await store.getEquipmentByPolicy(policy);
    } else if (capability) {
      equipment = await store.getEquipmentByCapability(capability);
    } else {
      equipment = await store.getAllEquipment();
    }

    // Enrich with current bookings and utilization
    const allBookings = await store.getAllBookings();
    const enriched = equipment.map((eq) => {
      const eqBookings = allBookings.filter(
        (bk) => bk.equipmentId === eq.id && (bk.status === 'approved' || bk.status === 'pending_faculty')
      );
      const bookedHours = eqBookings.reduce((sum, bk) => {
        const duration = (new Date(bk.slotEndIso).getTime() - new Date(bk.slotStartIso).getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }, 0);
      const utilizationPercent = eq.dailyCapacityHours > 0
        ? Math.round((bookedHours / eq.dailyCapacityHours) * 100)
        : 0;

      return {
        ...eq,
        currentBookings: eqBookings.length,
        bookedHours: Math.round(bookedHours * 100) / 100,
        utilizationPercent,
      };
    });

    return NextResponse.json({ equipment: enriched, total: enriched.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
