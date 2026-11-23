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

- **Framework**: Next.js 16 (App Router, TypeScript `strict: true`)
- **Styling**: Tailwind CSS v4 (Pure CSS, tactile editorial system, zero bloated UI libraries)
- **Validation**: Zod 3 schemas on all mutation routes
- **AI**: Google Gemini 2.5 Flash via `@google/genai` (with deterministic heuristic fallback)
- **Storage**: In-memory (default) or Firestore (`LabStore` interface)
- **Testing**: Vitest + Vitest-Axe (47 tests: unit, integration, and WCAG 2.1 AA accessibility)
- **Deployment**: Vercel / Cloud Run Docker (Node 20 Alpine, non-root, port 8080)

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

# Run all verification gates
npm run lint && npx tsc --noEmit && npm test && npm run build
```

## 🧪 Testing & Verification

```bash
npm test
```

**47 automated tests** across 3 test suites:
- `tests/scheduler.test.ts` — 20 tests (interval overlap, priority scoring, conflict resolution, analytics)
- `tests/api.test.ts` — 23 tests (validation, store operations, discover fallback, simulation)
- `tests/a11y.test.tsx` — 4 tests (WCAG 2.1 AA accessibility tests with `vitest-axe` for zero violations)

## 🐳 Docker (Cloud Run Ready)

```bash
docker build -t lablink .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key lablink
```

## 🔒 Security & Performance

- **Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, strict `Content-Security-Policy`
- **Rate Limiting**: Sliding window per-IP rate limiter on AI endpoints (10 req/min) and mutations (30 req/min)
- **Zero Client Mock Data**: All data fetched live from backend REST APIs
- **Accessibility**: WCAG 2.1 AA compliant, full keyboard navigation (`Escape`, `Tab`, radio groups), high contrast ratios (>7:1 on key text)
- **Lean Footprint**: Git repository < 1 MB (well below the 10 MB competition limit), exactly one branch (`main`)

## 📋 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analytics/route.ts
│   │   ├── bookings/route.ts
│   │   ├── bookings/[id]/route.ts
│   │   ├── demo-login/route.ts
│   │   ├── discover/route.ts
│   │   ├── equipment/route.ts
│   │   ├── health/route.ts
│   │   └── simulate-conflict/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AdminWorkspace.tsx
│   ├── BookingPanel.tsx
│   ├── ConflictSimulatorModal.tsx
│   ├── FacultyWorkspace.tsx
│   └── StudentWorkspace.tsx
├── lib/
│   ├── auth.ts            # Role-based cookie helpers
│   ├── frontendApi.ts     # Client typed API fetchers
│   ├── gemini.ts          # GenAI engine with fallback
│   ├── rateLimit.ts       # Per-IP sliding window
│   ├── scheduler.ts       # Deterministic conflict engine
│   ├── store.ts           # InMemory + Firestore adapters
│   └── validation.ts      # Zod schemas
└── types/
    └── lablink.ts         # Domain types
tests/
├── a11y.test.tsx          # WCAG 2.1 AA accessibility tests
├── api.test.ts            # Integration & route tests
└── scheduler.test.ts      # Core scheduling engine tests
```

## License

MIT
