# LabLink — Making College Laboratories More Accessible

A GenAI-powered campus laboratory resource-sharing platform that helps students discover and access specialised equipment, development kits, and laboratory workstations across departments.

## 🚀 Features

### Equipment Discovery
- Browse 12 pre-seeded lab equipment across 5 departments (Robotics, ECE, CSE, Mechanical, Biotech)
- Filter by department, approval policy, or capability tags
- AI-powered natural language search (e.g., "I need a GPU for computer vision")

### Intelligent Slot Booking
- Zod-validated booking with slot duration limits (max 8 hours)
- Deterministic conflict resolution using priority scoring
- Cross-department equivalent-kit alternatives when conflicts arise

### Fair Scheduling Engine
- **Deadline Urgency** (0–40 pts): Closer deadlines get higher priority
- **Spec Fit** (0–30 pts): Better capability match = higher score
- **Fairness** (0–30 pts): Anti-hoarding penalty for frequent users

### Faculty Approvals
- Three approval policies: `auto`, `trained_only`, `manual`
- Safety certification validation
- Faculty approve/reject/reassign workflow

### Analytics & Utilization
- Campus-wide and per-department utilization metrics
- Peak contention window detection
- Underutilized kit flagging for cross-department sharing

## 📡 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Health check with storage and AI status |
| `GET` | `/api/equipment` | List equipment with filters (`?department=`, `?capability=`, `?policy=`) |
| `POST` | `/api/discover` | AI-powered equipment discovery |
| `GET` | `/api/bookings` | List bookings with filters (`?status=`, `?role=`) |
| `POST` | `/api/bookings` | Create a new booking request |
| `PATCH` | `/api/bookings/[id]` | Faculty decision (approve/reject/reassign) |
| `POST` | `/api/simulate-conflict` | 3-student peak contention simulation |
| `GET` | `/api/analytics` | Campus utilization analytics |

## 🏗️ Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript `strict: true`)
- **Validation**: Zod schemas
- **AI**: Google Gemini 2.5 Flash via `@google/genai`
- **Storage**: In-memory (default) or Firestore (Cloud Run)
- **Testing**: Vitest (43 tests)
- **Deployment**: Docker (Node 20 Alpine, non-root, port 8080)

## 🔧 Setup

```bash
# Install dependencies
npm ci

# Copy env template
cp .env.example .env.local

# Add your Gemini API key to .env.local
# GEMINI_API_KEY=your_key_here

# Development
npm run dev

# Run all checks
npm run lint && npx tsc --noEmit && npm test && npm run build
```

## 🧪 Testing

```bash
npm test
```

**43 tests** across 2 test suites:
- `tests/scheduler.test.ts` — 20 tests (interval overlap, priority scoring, conflict resolution, analytics)
- `tests/api.test.ts` — 23 tests (validation, store operations, discover fallback, simulation)

## 🐳 Docker

```bash
docker build -t lablink .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key lablink
```

## 🔒 Security

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` configured
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Per-IP rate limiting on AI and mutation routes
- Non-root Docker user

## 📋 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analytics/route.ts
│   │   ├── bookings/route.ts
│   │   ├── bookings/[id]/route.ts
│   │   ├── discover/route.ts
│   │   ├── equipment/route.ts
│   │   ├── health/route.ts
│   │   └── simulate-conflict/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── gemini.ts          # GenAI engine with fallback
│   ├── rateLimit.ts       # Per-IP sliding window
│   ├── scheduler.ts       # Deterministic conflict engine
│   ├── store.ts           # InMemory + Firestore adapters
│   └── validation.ts      # Zod schemas
└── types/
    └── lablink.ts         # Domain types
tests/
├── scheduler.test.ts      # 20 unit tests
└── api.test.ts            # 23 integration tests
```

## License

MIT
