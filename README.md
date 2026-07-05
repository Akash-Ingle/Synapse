# Synapse - Real-Time Collaborative AI Editor

A production-grade collaborative document editor with deep AI capabilities, real-time multi-user editing, and full DevOps infrastructure. Built as a monorepo with 5 services spanning the full stack.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                        │
│   TipTap Editor · Yjs CRDT · Dark Mode · Comments · Versions   │
└──────────┬───────────────────────┬──────────────────────────────┘
           │ REST / SSE            │ WebSocket
           ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   API (NestJS)   │    │  Collab Service  │
│  Auth · RBAC     │    │  Yjs · Presence  │
│  AI · Versions   │    │  WebSocket Sync  │
│  Comments        │    └────────┬─────────┘
│  Prometheus /metrics           │
└──────┬──────┬────┘             │
       │      │                  │
       ▼      ▼                  ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Postgres │ │  Redis   │ │  Worker  │
│ pgvector │ │  BullMQ  │ │ Embed +  │
│          │ │  Cache   │ │ Tagging  │
└──────────┘ └──────────┘ └──────────┘
```

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| **web** | React, Vite, TipTap, Tailwind | 5173 | SPA with collaborative editor |
| **api** | NestJS, Prisma, prom-client | 4000 | REST API, AI features, auth |
| **collab** | Node.js, Yjs, WebSocket | 4001 | Real-time CRDT sync & presence |
| **worker** | BullMQ | 4002 | Background embeddings & tagging |
| **shared** | Zod, TypeScript | — | Shared schemas, types, roles |

---

## Features

### Real-Time Collaboration
- **CRDT-based editing** — Yjs for conflict-free concurrent editing across multiple users
- **Live presence** — See who's editing in real time with cursor positions
- **WebSocket sync** — Sub-second latency document synchronization
- **Room management** — Automatic room lifecycle with memory-efficient eviction

### AI Capabilities (Gemini 2.5 Flash)
- **Rewrite** — 7 modes: improve, shorten, lengthen, formal, casual, simplify, fix grammar
- **Expand** — AI-powered text expansion from selections
- **Summarize** — Short / medium / long summaries with SSE streaming
- **Outline** — Auto-generate structured document outlines
- **Task extraction** — Pull action items with owners, due dates, and priorities
- **Chat with document (RAG)** — Ask questions about your document using vector search
- **Notes → structured doc** — Convert meeting notes into formatted documents
- **Style adaptation** — Rewrite for executive, engineer, customer, casual, or academic audiences
- **Semantic diff** — AI-powered explanation of changes between document versions
- **Semantic search** — Vector similarity search across workspace documents

### Auth & Permissions
- **JWT auth** with access + refresh token rotation
- **Bcrypt** password hashing (cost factor 12)
- **Role-based access** — Owner / Editor / Commenter / Viewer at document level
- **Workspace membership** — Admin / Member roles

### Comments & Versioning
- **Anchored comments** — Highlight text and attach threaded discussions
- **Thread resolution** — Resolve / reopen comment threads
- **Version history** — Save, label, and restore document snapshots
- **Side-by-side diff** — Visual text diff between any two versions

### DevOps & Observability
- **Docker** — Multi-stage Dockerfiles with production dependency pruning
- **Docker Compose** — Full-stack deployment with health checks, resource limits, network isolation
- **CI/CD** — GitHub Actions with lint, typecheck, test, build, Docker push to GHCR
- **Prometheus metrics** — HTTP latency histograms, request counters, AI call tracking
- **Health checks** — Liveness (`/healthz`) and readiness (`/readyz`) on every service
- **Structured logging** — pino with JSON output in production, pretty-print in dev

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Docker & Docker Compose
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier works)

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/synapse.git
cd synapse
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 3. Start infrastructure

```bash
npm run infra:up          # Starts Postgres + Redis
```

### 4. Initialize the database

```bash
cd apps/api
npx prisma db push
cd ../..
```

### 5. Start all services (development)

Open 4 terminals:

```bash
npm run dev:api           # REST API on :4000
npm run dev:collab        # WebSocket on :4001
npm run dev:worker        # Background jobs
npm run dev:web           # Vite dev server on :5173
```

### Full Docker deployment

```bash
npm run docker:build      # Build all images
npm run docker:up         # Start everything
npm run docker:logs       # Tail logs
```

---

## Testing

```bash
npm run test              # Run all tests (78 tests across 7 suites)
npm run typecheck         # TypeScript checks across all workspaces
npm run lint              # ESLint across all workspaces
```

**Test coverage:**

| Package | Suites | Tests | What's tested |
|---------|--------|-------|---------------|
| `@synapse/shared` | 3 | 55 | Zod schemas (DTOs, AI requests), role hierarchy, permission helpers |
| `@synapse/api` | 4 | 23 | Auth service (register, login, refresh, logout), health checks, Prometheus metrics, Zod validation pipe |

---

## Project Structure

```
synapse/
├── apps/
│   ├── api/              # NestJS REST API
│   │   ├── prisma/       # Schema + migrations
│   │   └── src/
│   │       ├── ai/       # AI service, LLM/embeddings providers, prompts
│   │       ├── auth/     # JWT auth, passport strategy
│   │       ├── comments/ # Threaded comments
│   │       ├── documents/# CRUD + sharing
│   │       ├── health/   # Liveness + readiness
│   │       ├── metrics/  # Prometheus (prom-client)
│   │       ├── permissions/
│   │       ├── versions/ # Document snapshots
│   │       └── workspaces/
│   ├── collab/           # WebSocket + Yjs CRDT server
│   ├── web/              # React + Vite + TipTap
│   │   └── src/
│   │       ├── components/  # Editor, AI panel, comments, diff view
│   │       ├── pages/       # Login, dashboard, editor
│   │       └── store/       # Zustand stores (auth, theme)
│   └── worker/           # BullMQ background jobs
├── packages/
│   └── shared/           # Zod schemas, types, roles
├── .github/workflows/    # CI/CD pipeline
├── docker-compose.yml    # Full-stack orchestration
└── .dockerignore
```

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Get tokens |
| POST | `/auth/refresh` | Public | Rotate tokens |
| POST | `/auth/logout` | JWT | Revoke refresh token |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents?workspaceId=` | List documents |
| POST | `/documents` | Create document |
| GET | `/documents/:id` | Get document |
| PATCH | `/documents/:id` | Update document |
| DELETE | `/documents/:id` | Archive document |
| POST | `/documents/:id/share` | Share with user |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/rewrite` | Rewrite text (7 modes) |
| POST | `/ai/expand` | Expand selection |
| POST | `/ai/summarize` | Summarize (SSE stream) |
| POST | `/ai/outline` | Generate outline |
| POST | `/ai/tasks` | Extract action items |
| POST | `/ai/chat` | Chat with document (RAG) |
| POST | `/ai/notes-to-doc` | Notes → structured doc |
| POST | `/ai/style-adapt` | Adapt writing style |
| POST | `/ai/semantic-diff` | AI diff explanation |
| POST | `/ai/search` | Semantic search |

### Observability
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | Public | Liveness probe |
| GET | `/readyz` | Public | Readiness (DB + Redis) |
| GET | `/metrics` | Public | Prometheus metrics |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TipTap, Tailwind CSS, Zustand, TanStack Query |
| Editor | ProseMirror (via TipTap), Yjs CRDT, y-websocket |
| Backend | NestJS, Prisma, Passport JWT, pino |
| AI | Google Gemini 2.5 Flash, gemini-embedding-001, pgvector |
| Queue | BullMQ + Redis |
| Database | PostgreSQL 16 + pgvector |
| Observability | prom-client (Prometheus), pino (structured logging) |
| DevOps | Docker, Docker Compose, GitHub Actions, nginx |
| Testing | Jest, ts-jest, @nestjs/testing |

---

## License

MIT
