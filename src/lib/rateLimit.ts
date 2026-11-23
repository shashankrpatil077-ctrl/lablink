/**
 * Rate Limiter
 * Lightweight per-IP sliding-window rate limiter for AI and mutation routes.
 * Uses an in-memory Map with automatic cleanup of expired entries.
 */

/** Configuration for the rate limiter */
interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Record of request timestamps for a given IP */
interface RateLimitRecord {
  timestamps: number[];
}

/** Default rate limit: 30 requests per 60 seconds */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

/** Stricter rate limit for AI routes: 10 requests per 60 seconds */
export const AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
};

/** Standard rate limit for mutation routes: 20 requests per 60 seconds */
export const MUTATION_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60 * 1000,
};

/** In-memory storage for rate limit tracking */
const rateLimitStore = new Map<string, RateLimitRecord>();

/** Cleanup interval - remove stale entries every 5 minutes */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove entries where all timestamps are expired
      const validTimestamps = record.timestamps.filter((t) => now - t < 5 * 60 * 1000);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Don't prevent process from exiting
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Timestamp when the rate limit resets (ms since epoch) */
  resetAt: number;
  /** Total requests allowed per window */
  limit: number;
}

/**
 * Check if a request from the given IP is within rate limits.
 *
 * @param ip - Client IP address (or other unique identifier)
 * @param config - Rate limit configuration to use
 * @returns RateLimitResult indicating if the request is allowed
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  ensureCleanupRunning();

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${ip}:${config.maxRequests}:${config.windowMs}`;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Remove timestamps outside the current window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    const oldestInWindow = record.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + config.windowMs,
      limit: config.maxRequests,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - record.timestamps.length,
    resetAt: now + config.windowMs,
    limit: config.maxRequests,
  };
}

/**
 * Extract client IP from a request.
 * Checks X-Forwarded-For header first (for reverse proxies), then falls back.
 *
 * @param request - The incoming Request object
 * @returns Client IP string
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback for local development
  return '127.0.0.1';
}

/**
 * Reset the rate limit store (for testing).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
