/**
 * Server-Only GenAI Engine
 * Uses @google/genai SDK with gemini-2.5-flash and structured JSON output.
 * Falls back to deterministic keyword/template matching when API key is missing or rate-limited.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { Equipment, BookingRequest, AllocationResult, CapabilityTag } from '@/types/lablink';

/** Check if the Gemini API key is configured */
function isAIConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0;
}

/** Export for health check endpoint */
export { isAIConfigured };

/** Structured output schema for equipment discovery */
const discoverResponseSchema = {
  type: Type.OBJECT,
  properties: {
    extractedCapabilities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Normalized capability tags extracted from the query',
    },
    urgencyLevel: {
      type: Type.STRING,
      description: 'Perceived urgency: low, medium, high, critical',
    },
    recommendedIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Equipment IDs ranked by relevance',
    },
    reasonsById: {
      type: Type.OBJECT,
      properties: {},
      additionalProperties: { type: Type.STRING },
      description: 'Mapping of equipment ID to reason for recommendation',
    },
  },
  required: ['extractedCapabilities', 'urgencyLevel', 'recommendedIds', 'reasonsById'],
};

/** Structured output schema for conflict explanation */
const explainResponseSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: 'A crisp 2-sentence plain-English explanation',
    },
  },
  required: ['explanation'],
};

// ─── Keyword-Based Fallback ───────────────────────────────────────────────────

/** Map of keywords to capability tags for deterministic fallback */
const KEYWORD_CAPABILITY_MAP: Record<string, CapabilityTag[]> = {
  'gpu': ['cuda', 'edge-gpu'],
  'cuda': ['cuda'],
  'nvidia': ['cuda', 'edge-gpu', 'vision-ai'],
  'jetson': ['edge-gpu', 'cuda', 'vision-ai'],
  'ai': ['cuda', 'vision-ai', 'edge-gpu'],
  'machine learning': ['cuda', 'vision-ai'],
  'deep learning': ['cuda', 'vision-ai'],
  'computer vision': ['vision-ai', 'cuda'],
  'vision': ['vision-ai'],
  'robot': ['robot-arm'],
  'arm': ['robot-arm'],
  'manipulator': ['robot-arm'],
  'fpga': ['fpga'],
  'digital logic': ['fpga', 'logic-analyzer'],
  'oscilloscope': ['oscilloscope'],
  'signal': ['signal-generator', 'spectrum-analyzer'],
  'spectrum': ['spectrum-analyzer'],
  '3d print': ['3d-print'],
  'print': ['3d-print'],
  'prototype': ['3d-print', 'cnc'],
  'cnc': ['cnc'],
  'machining': ['cnc'],
  'lidar': ['lidar'],
  'pcr': ['pcr'],
  'dna': ['pcr', 'gel-electrophoresis'],
  'biology': ['pcr', 'microscope', 'centrifuge'],
  'bioprint': ['bioprinter'],
  'thermal': ['thermal-chamber'],
  'laser': ['laser-cutter'],
  'solder': ['soldering-station'],
  'microscop': ['microscope'],
  'centrifug': ['centrifuge'],
  'gel': ['gel-electrophoresis'],
  'electrophoresis': ['gel-electrophoresis'],
  'edge': ['edge-gpu'],
  'embedded': ['edge-gpu', 'fpga'],
  'drone': ['edge-gpu', 'vision-ai', 'lidar'],
  'autonomous': ['edge-gpu', 'vision-ai', 'lidar'],
  'slam': ['edge-gpu', 'vision-ai', 'lidar'],
};

/** Urgency keywords for deterministic fallback */
const URGENCY_KEYWORDS: Record<string, string> = {
  'urgent': 'critical',
  'asap': 'critical',
  'emergency': 'critical',
  'deadline': 'high',
  'tomorrow': 'high',
  'capstone': 'high',
  'final project': 'high',
  'thesis': 'high',
  'hackathon': 'medium',
  'explore': 'low',
  'exploratory': 'low',
  'research': 'medium',
  'experiment': 'medium',
};

/**
 * Deterministic fallback for equipment discovery.
 * Extracts capabilities from query keywords and matches against catalog.
 */
function discoverFallback(
  query: string,
  catalog: Equipment[]
): {
  extractedCapabilities: string[];
  urgencyLevel: string;
  recommendedIds: string[];
  reasonsById: Record<string, string>;
} {
  const lowerQuery = query.toLowerCase();
  const extractedCaps = new Set<CapabilityTag>();

  // Extract capabilities from keywords
  for (const [keyword, caps] of Object.entries(KEYWORD_CAPABILITY_MAP)) {
    if (lowerQuery.includes(keyword)) {
      for (const cap of caps) {
        extractedCaps.add(cap);
      }
    }
  }

  // Determine urgency
  let urgencyLevel = 'medium';
  for (const [keyword, level] of Object.entries(URGENCY_KEYWORDS)) {
    if (lowerQuery.includes(keyword)) {
      urgencyLevel = level;
      break;
    }
  }

  // Rank equipment by capability overlap
  const capsArray = Array.from(extractedCaps);
  const scored = catalog.map((eq) => {
    const matchedCaps = capsArray.filter((cap) => eq.capabilities.includes(cap));
    return { equipment: eq, matchCount: matchedCaps.length, matchedCaps };
  });

  scored.sort((a, b) => b.matchCount - a.matchCount);
  const recommended = scored.filter((s) => s.matchCount > 0);

  const recommendedIds = recommended.map((s) => s.equipment.id);
  const reasonsById: Record<string, string> = {};
  for (const item of recommended) {
    reasonsById[item.equipment.id] =
      `Matches ${item.matchCount} capability(s): ${item.matchedCaps.join(', ')}. Located in ${item.equipment.department} department at ${item.equipment.location}.`;
  }

  return {
    extractedCapabilities: capsArray,
    urgencyLevel,
    recommendedIds,
    reasonsById,
  };
}

/**
 * Deterministic fallback for conflict explanation.
 */
function explainFallback(
  request: BookingRequest,
  equipment: Equipment,
  result: AllocationResult
): string {
  const { outcome, scoreBreakdown, alternatives } = result;

  switch (outcome) {
    case 'booked':
      return `Your booking for ${equipment.name} has been approved. No scheduling conflicts were detected for your requested time slot.`;
    case 'pending_faculty':
      return `Your booking for ${equipment.name} requires faculty approval due to ${equipment.approvalPolicy === 'manual' ? 'manual approval policy' : 'equipment policy'}. You will be notified once a decision is made.`;
    case 'blocked_maintenance':
      return `Your requested slot for ${equipment.name} conflicts with a scheduled maintenance window. ${alternatives.length > 0 ? `Consider the alternative: ${alternatives[0].matchReason}.` : 'Please choose a different time slot.'}`;
    case 'blocked_safety':
      return `Access to ${equipment.name} requires a valid safety certification. Please complete the required safety training before booking this equipment.`;
    case 'conflict_resolved': {
      const winner = result.winnerBookingId === request.id ? 'your request' : 'the existing booking';
      return `A scheduling conflict was detected on ${equipment.name}. Priority scoring (deadline urgency: ${scoreBreakdown.deadlineUrgency}/40, spec fit: ${scoreBreakdown.specFit}/30, fairness: ${scoreBreakdown.fairnessScore}/30) determined ${winner} as the winner. ${alternatives.length > 0 ? `Alternative suggested: ${alternatives[0].matchReason}.` : ''}`;
    }
    default:
      return `Your booking request for ${equipment.name} has been processed with outcome: ${outcome}.`;
  }
}

// ─── Main GenAI Functions ─────────────────────────────────────────────────────

/**
 * Discovers equipment matching a natural-language student project query.
 * Uses Gemini with structured JSON output, falls back to keyword matching.
 *
 * @param query - Natural-language query from a student
 * @param catalog - Full equipment catalog
 * @returns Extracted capabilities, urgency, ranked recommendations, and reasons
 */
export async function discoverEquipmentWithAI(
  query: string,
  catalog: Equipment[]
): Promise<{
  extractedCapabilities: string[];
  urgencyLevel: string;
  recommendedIds: string[];
  reasonsById: Record<string, string>;
}> {
  if (!isAIConfigured()) {
    return discoverFallback(query, catalog);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const catalogSummary = catalog.map((eq) => ({
      id: eq.id,
      name: eq.name,
      department: eq.department,
      capabilities: eq.capabilities,
      location: eq.location,
      approvalPolicy: eq.approvalPolicy,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a campus lab equipment advisor. A student needs equipment for their project. Analyze their query, extract normalized capability tags they need, assess urgency, and recommend the best matching equipment from the catalog below.

Student Query: "${query}"

Equipment Catalog:
${JSON.stringify(catalogSummary, null, 2)}

Available capability tags: edge-gpu, cuda, fpga, oscilloscope, 3d-print, robot-arm, pcr, vision-ai, lidar, cnc, laser-cutter, spectrum-analyzer, bioprinter, thermal-chamber, logic-analyzer, signal-generator, soldering-station, microscope, centrifuge, gel-electrophoresis

Return equipment ranked by relevance to the student's needs. Prioritize cross-department matching (kits from different departments that share capabilities). For each recommended kit, explain why it matches.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: discoverResponseSchema,
      },
    });

    clearTimeout(timeout);

    const parsed = JSON.parse(response.text ?? '{}') as {
      extractedCapabilities: string[];
      urgencyLevel: string;
      recommendedIds: string[];
      reasonsById: Record<string, string>;
    };

    return {
      extractedCapabilities: parsed.extractedCapabilities ?? [],
      urgencyLevel: parsed.urgencyLevel ?? 'medium',
      recommendedIds: parsed.recommendedIds ?? [],
      reasonsById: parsed.reasonsById ?? {},
    };
  } catch {
    // Fallback on any error (rate limit, timeout, invalid key, etc.)
    return discoverFallback(query, catalog);
  }
}

/**
 * Generates a plain-English explanation of a booking allocation result.
 * Uses Gemini for natural language, falls back to template-based explanation.
 *
 * @param request - The booking request
 * @param equipment - The target equipment
 * @param result - The deterministic allocation result
 * @returns A crisp 2-sentence explanation
 */
export async function explainConflictWithAI(
  request: BookingRequest,
  equipment: Equipment,
  result: AllocationResult
): Promise<string> {
  if (!isAIConfigured()) {
    return explainFallback(request, equipment, result);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a fair campus lab resource allocator. Explain this allocation result in exactly 2 crisp sentences that a student would understand. Be empathetic but factual.

Student: ${request.studentName} (${request.studentDepartment})
Project: ${request.projectTitle}
Equipment: ${equipment.name} (${equipment.department})
Outcome: ${result.outcome}
Priority Score: ${result.priorityScore}/100
Score Breakdown: Deadline Urgency ${result.scoreBreakdown.deadlineUrgency}/40, Spec Fit ${result.scoreBreakdown.specFit}/30, Fairness ${result.scoreBreakdown.fairnessScore}/30
Winner: ${result.winnerBookingId || 'N/A'}
Waitlisted: ${result.waitlisted.join(', ') || 'None'}
Alternatives: ${result.alternatives.map((a) => `${a.equipmentName} (${a.type}: ${a.matchReason})`).join('; ') || 'None'}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: explainResponseSchema,
      },
    });

    clearTimeout(timeout);

    const parsed = JSON.parse(response.text ?? '{}') as { explanation: string };
    return parsed.explanation ?? explainFallback(request, equipment, result);
  } catch {
    return explainFallback(request, equipment, result);
  }
}
