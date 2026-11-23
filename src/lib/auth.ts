import crypto from 'crypto';
import type { NextRequest } from 'next/server';

export type DemoRole = 'student' | 'faculty' | 'lab_admin';
export type DemoDepartment = 'Robotics' | 'ECE' | 'CSE' | 'Mechanical' | 'Biotech';

export interface DemoSession {
  userId: string;
  name: string;
  role: DemoRole;
  department: DemoDepartment;
  recentBookedHours: number;
  hasSafetyCert: boolean;
}

export const SESSION_COOKIE_NAME = 'lablink_session';

// Production note: replace /api/demo-login with Google / Firebase Identity Platform sign-in.
const DEV_FALLBACK_SECRET = 'lablink-dev-only-session-secret-change-in-prod';

function getSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;
}

export const DEMO_PERSONAS: Record<string, DemoSession> = {
  student: {
    userId: 'stu-arjun-01',
    name: 'Arjun Mehta',
    role: 'student',
    department: 'Robotics',
    recentBookedHours: 2,
    hasSafetyCert: true,
  },
  faculty_robotics: {
    userId: 'fac-sharma-01',
    name: 'Dr. Kavita Sharma',
    role: 'faculty',
    department: 'Robotics',
    recentBookedHours: 0,
    hasSafetyCert: true,
  },
  faculty_ece: {
    userId: 'fac-nair-02',
    name: 'Prof. Rajesh Nair',
    role: 'faculty',
    department: 'ECE',
    recentBookedHours: 0,
    hasSafetyCert: true,
  },
  lab_admin: {
    userId: 'adm-rao-01',
    name: 'Ananya Rao (Lab Admin)',
    role: 'lab_admin',
    department: 'CSE',
    recentBookedHours: 0,
    hasSafetyCert: true,
  },
};

export function signSession(session: DemoSession): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): DemoSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DemoSession;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): DemoSession {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token) ?? DEMO_PERSONAS.student;
}
