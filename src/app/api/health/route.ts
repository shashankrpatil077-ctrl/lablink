/**
 * GET /api/health
 * Returns service health status, storage backend, and AI configuration.
 */

import { NextResponse } from 'next/server';
import { isAIConfigured } from '@/lib/gemini';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    storage: process.env.USE_FIRESTORE === 'true' ? 'firestore' : 'memory',
    aiConfigured: isAIConfigured(),
    timestamp: new Date().toISOString(),
  });
}
