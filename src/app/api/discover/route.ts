/**
 * POST /api/discover
 * AI-powered equipment discovery from natural-language student queries.
 * Validates input with Zod, calls discoverEquipmentWithAI, returns ranked kits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { discoverSchema } from '@/lib/validation';
import { discoverEquipmentWithAI } from '@/lib/gemini';
import { checkRateLimit, getClientIp, AI_RATE_LIMIT } from '@/lib/rateLimit';

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

    // Parse and validate input
    const body: unknown = await request.json();
    const parseResult = discoverSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { query } = parseResult.data;
    const store = getStore();
    const catalog = await store.getAllEquipment();

    // AI discovery
    const result = await discoverEquipmentWithAI(query, catalog);

    // Enrich recommended kits with full details
    const recommendedEquipment = result.recommendedIds
      .map((id) => catalog.find((eq) => eq.id === id))
      .filter((eq): eq is NonNullable<typeof eq> => eq !== undefined);

    return NextResponse.json({
      extractedCapabilities: result.extractedCapabilities,
      urgencyLevel: result.urgencyLevel,
      recommendedEquipment: recommendedEquipment.map((eq) => ({
        ...eq,
        matchReason: result.reasonsById[eq.id] ?? 'General match',
      })),
      totalMatches: recommendedEquipment.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
