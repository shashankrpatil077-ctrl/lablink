import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DEMO_PERSONAS,
  SESSION_COOKIE_NAME,
  getSessionFromRequest,
  signSession,
} from '@/lib/auth';

const demoLoginSchema = z.object({
  persona: z.enum(['student', 'faculty_robotics', 'faculty_ece', 'lab_admin']),
});

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  return NextResponse.json({ session });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = demoLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid persona selection', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const session = DEMO_PERSONAS[parsed.data.persona];
    const token = signSession(session);
    const res = NextResponse.json({ session });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
