# Synapse — Real-Time Collaborative AI Editor

A real-time collaborative document editor with a deep, product-wide AI layer. Built to
demonstrate serious engineering across three domains: **AI**, **SWE**, and **DevOps**.

> One-liner: *"Google Docs where the AI actually understands your document, your history, and your team."*

---

## 1. Product Vision and Target Users

A collaborative writing workspace where multiple people edit the same document in real time,
and an AI layer continuously helps them write better, understand faster, and coordinate work —
woven into the editing surface, version history, comments, and search (not a bolted-on chat box).

**Target users**
- Primary: small/mid product/eng/design teams writing specs, PRDs, RFCs, meeting notes.
- Secondary: writers, students, researchers wanting AI-assisted long-form writing + collaboration.
- Tertiary (demo narrative): teams turning messy meeting notes into structured, searchable docs.

## 2. Core MVP Features
- Auth & accounts (email/password + Google OAuth, JWT + refresh).
- Workspaces & documents (organize, CRUD).
- Rich-text collaborative editor: real-time multi-cursor + presence, CRDT (Yjs).
- Permissions: owner / editor / commenter / viewer per document.
- Comment threads anchored to text ranges, resolve/reopen, @mentions.
- Version history: automatic + named snapshots, restore, diff view.
- AI core (substantial subset): inline rewrite/expand, summarize selection/doc, semantic search, outline generation.
- Hybrid search (full-text + semantic).
- Presence & in-app notifications.

## 3. Advanced Features
Semantic diffing (explain what/why changed), AI task extraction, meeting-notes → doc,
style adaptation, smart tagging/categorization, AI collaboration insights, chat-with-document (RAG),
retrieval over past versions, adaptive suggestions, templates/slash commands, offline sync, export.

## 4. AI-First Capabilities

| # | Capability | Technique | Surface |
|---|-----------|-----------|---------|
| 1 | Inline rewrite | prompt + constrained output | editor bubble menu |
| 2 | Expand | prompt | editor bubble menu |
| 3 | Summarize (selection/doc) | map-reduce for long docs | side panel / slash |
| 4 | Semantic search | embeddings + pgvector | global search |
| 5 | Outline generation | structured JSON prompt | side panel |
| 6 | Task extraction | structured JSON | tasks panel |
| 7 | Smart tagging | classification + embeddings | doc metadata (bg job) |
| 8 | Meeting-notes → doc | transform prompt | import flow |
| 9 | Style adaptation | rewrite w/ persona | side panel |
| 10 | Semantic diff / change explanation | diff + explanation prompt | history view |
| 11 | Chat with document (RAG) | retrieval + grounded answer w/ citations | doc chat panel |
| 12 | Collaboration insights | summarize structured events | insights dashboard |
| 13 | Version retrieval | embeddings over historical snapshots | chat / search |
| 14 | Adaptive suggestions | doc-type detection → tailored prompts | everywhere |

**Cross-cutting AI infra:** RAG pipeline (chunk→embed→pgvector→retrieve→rerank→prompt),
typed/versioned prompt orchestration with Zod-validated structured outputs + retries + guardrails,
SSE streaming, background AI workers, content-hash response caching, per-request token/cost tracking,
and an evaluation harness (golden set) for summarize/extract quality.

## 5. AI Resume Framing
- RAG pipeline over live docs/comments/version history with semantic chunking, pgvector embeddings, reranking, grounded chat with citations.
- AI prompt-orchestration layer with versioned templates, JSON-schema-validated outputs, retries, guardrails across 10+ features.
- Map-reduce summarization beyond context window + eval harness on a golden set.
- Adaptive, doc-type-aware prompting.
- Latency/cost reduction via SSE streaming, content-hash caching, background embedding workers.

## 6. SWE Resume Framing
- Real-time multiplayer editing via CRDTs (Yjs) over WebSockets w/ presence, cursors, offline sync.
- Versioning system with immutable snapshots, restore, diff engine.
- RBAC permission model enforced across REST + WebSocket layers.
- Normalized Postgres schema for workspaces/docs/versions/comments/embeddings.
- Range-anchored comments surviving concurrent edits via CRDT relative positions.
- Clean typed REST + WebSocket APIs.

## 7. DevOps Resume Framing
- Containerized multi-service system (API, WS, worker, Postgres, Redis) with Compose + multi-stage builds.
- CI/CD via GitHub Actions (lint/typecheck/test/build/deploy).
- Full observability: structured logs, Prometheus metrics, OpenTelemetry tracing, Grafana.
- Redis-backed rate limiting + caching to protect AI cost.
- k6 load testing with p95 SLOs; WS horizontal scaling via Redis pub/sub.
- Health checks, graceful shutdown, BullMQ queue with retries + DLQ.

## 8. Architecture (text)

```
Browser SPA (React + TipTap + Yjs)
   │ REST/HTTPS            │ WebSocket
   ▼                       ▼
Nginx reverse proxy
   │                       │
REST API (NestJS) ◄─Redis─► Realtime Collab (WS + Yjs rooms)
   │  enqueue                     │ snapshots
   ▼                             ▼
Redis + BullMQ  ──► AI Worker ──► Claude API + Embeddings
   │                             │
   └──────────► Postgres + pgvector ◄──────────┘

Observability: OpenTelemetry → Prometheus/Tempo/Loki → Grafana; Sentry for errors.
```

## 9. Tech Stack
- **Frontend:** React + TS + Vite, TipTap (ProseMirror), Yjs + y-websocket, Tailwind + shadcn/ui, TanStack Query + Zustand.
- **Backend:** Node + TS, **NestJS** REST API, separate WebSocket collab service, BullMQ workers, Zod validation.
- **Data:** PostgreSQL + **pgvector**, Redis (cache/queue/pubsub/ratelimit), Prisma ORM.
- **AI:** Claude API (all generation/reasoning), pluggable embeddings provider.
- **DevOps:** Docker + Compose, GitHub Actions, Nginx, OpenTelemetry/Prometheus/Grafana/Loki, Sentry, k6.
- **Deploy target:** single VPS via Compose for the demo; documented k8s path for scale.

## 10. Database Design (core tables)
users, workspaces, workspace_members(role), documents(ydoc_state, current_version, doc_type),
document_perms(role), versions(immutable snapshot + content_text), comments(anchor_relpos),
document_tags(source user|ai), embeddings(pgvector), ai_jobs(cost/token ledger), ai_cache,
tasks(AI-extracted), activity_events, notifications.

Key: `ydoc_state` = live CRDT binary; `versions.snapshot` = immutable historical CRDT; `content_text` = flattened for FTS/embeddings/diff; comment anchors as CRDT relative positions.

## 11. Real-Time Sync
Yjs CRDT updates over WebSocket document rooms; awareness protocol for presence; debounced
persistence to Postgres + periodic/explicit snapshots; Redis pub/sub adapter for cross-instance
scaling; update batching/backpressure; automatic offline merge on reconnect.

## 12. Conflict Resolution
CRDT (Yjs/YATA) over OT — automatic convergent merges + offline. Rich-text validity via
ProseMirror schema. Comment anchors reattach or gracefully orphan. Version restore is
non-destructive (append-only). AI edits applied as accept/reject suggestions through the CRDT path.

## 13. AI Architecture & Claude Usage
Layers: AI gateway (auth/ratelimit/cost/cache/routing) → prompt orchestration (versioned templates,
JSON-schema + Zod output, retry-with-repair) → provider abstraction (Claude for generation,
pluggable embeddings) → RAG subsystem → background workers. Claude used across rewrite/expand/style,
summarize (map-reduce), outline, task extraction, tagging, notes→doc, semantic diff, chat (RAG),
insights, doc-type detection. Reliability/cost: SSE streaming, content-hash cache, token/cost logging,
guardrails (schema validation, token caps, prompt-injection mitigation), eval harness.

## 14. Backend Services
1. REST API (NestJS): auth, users, workspaces, documents, permissions, comments, versions, search, ai, tasks, notifications.
2. Realtime Collab: WS Yjs rooms, awareness, persistence hooks, Redis pub/sub, JWT handshake, per-room perms.
3. AI Worker: BullMQ consumers for embeddings/tagging/insights/diff; writes results + cost.
Cross-cutting: shared types package, structured logging, health/readiness, graceful shutdown, OTel.

## 15. Frontend
Editor shell (TipTap) + presence avatars + bubble/slash menus; right rail AI panels
(Summarize/Outline/Tasks/Chat/Insights); left rail workspace tree/search; history view with diff +
AI change explanation; comments layer. AI UX: suggestions with accept/reject, streaming, optimistic UI,
keyboard-first slash commands.

## 16. Deployment & DevOps
Local `docker compose up` (all services + Postgres + Redis + observability). Multi-stage Docker builds,
non-root images. CI (GitHub Actions): install/lint/typecheck/test/build; on main build+push+migrate+deploy.
Nginx TLS + routing. Prisma migrate gated step. Tagged images + rollback procedure. k8s manifests documented as scale path.

## 17. Observability, Scaling, Reliability
Structured JSON logs → Loki w/ correlation IDs; Prometheus metrics (latencies, WS conns, queue depth,
AI tokens/cost, cache hit rate); OTel traces REST→worker→Claude; Grafana dashboards; Sentry.
Redis token-bucket rate limiting (stricter on AI); caching (AI/embedding/hot-doc); stateless REST +
WS pub/sub scaling + queue-depth worker scaling + Postgres read replicas. Health probes, graceful
shutdown, queue retries + DLQ, idempotent AI jobs, circuit breaker around Claude. Documented SLOs.

## 18. Milestones (Phases)
- **Phase 0 — Foundations:** monorepo, Compose, Postgres/Redis, CI, auth, base schema, health.
- **Phase 1 — Collaboration core (SWE):** docs CRUD, TipTap editor, Yjs sync, presence, permissions, comments, versions + diff.
- **Phase 2 — AI core (AI MVP):** AI gateway + orchestration, rewrite/expand/summarize, embeddings + semantic search, outline, streaming.
- **Phase 3 — AI depth:** task extraction, tagging, notes→doc, style adaptation, semantic diff, chat (RAG), insights, version retrieval.
- **Phase 4 — DevOps hardening:** observability, rate limiting, caching, load testing, WS scaling, k8s manifests, eval harness.
- **Phase 5 — Polish & demo:** UX, templates/slash, export, seed data, demo script, docs.

## 19. Resume Metrics & Demo Ideas
Metrics: concurrent editors + sync p95; AI first-token & E2E latency; cache hit rate + % token savings;
semantic search recall; summarization/extraction eval scores; load-test throughput + error rate; queue throughput.
Demos: two-window live edit + AI rewrite; messy notes → structured doc + tasks + tags; "what changed
between v3 and v7 and why?"; chat-with-document with citation deep-links; live Grafana AI cost dashboard.

## 20. Risks, Tradeoffs, Non-Goals
- Risks: AI cost (cache/batch/caps/dashboard), CRDT edge cases (mature Yjs + snapshots), prompt injection
  (untrusted retrieved text), WS scaling (Redis pub/sub), scope creep (strict phase gates).
- Tradeoffs: CRDT vs OT; pgvector vs dedicated vector DB; three focused services vs microservices; Compose vs k8s.
- Non-goals (v1): native mobile, audio/video, spreadsheet/whiteboard, SSO/SAML, multi-region active-active, block-level perms.

---

## Build Order
1. **FIRST** (Phase 0→1): foundation + real-time collaborative editor.
2. **SECOND** (Phase 2): AI core woven into the editor.
3. **THIRD** (Phase 3→4→5): AI depth + DevOps hardening + polish.
