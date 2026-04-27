# LIGMA — Hackathon Master Plan

**Let's Integrate Groups, Manage Anything**
**36-Hour Window | Target: Ship in 24h | Buffer: 12h for polish, bugs, README**

---

## Tech Stack (Zero Paid Integrations)

| Layer            | Choice                                                         | Why                                                          |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Frontend         | Next.js 14 + TypeScript                                        | App Router, API routes, SSR                                  |
| Styling          | Tailwind CSS v4 + shadcn/ui                                    | Fast, consistent                                             |
| Canvas Rendering | React + CSS Transforms (DOM-based nodes)                       | Full control over node ACL, no library lock-in               |
| CRDT             | **Y.js** (yjs + y-websocket)                             | Industry standard, used by Figma/Notion internals            |
| WebSockets       | ws + y-websocket server                                        | Y.js awareness protocol = cursors for free                   |
| Backend          | Node.js + Express                                              | REST + WebSocket on same process                             |
| Database         | PostgreSQL (Render managed)                                    | Event log, tasks, users, rooms                               |
| AI Intent        | Hugging Face Free Inference API (`facebook/bart-large-mnli`) | Free zero-shot classification, fallback to keyword heuristic |
| Auth             | Custom JWT (jsonwebtoken + bcrypt)                             | No Clerk/Auth0, zero cost                                    |
| Deployment       | Render (Web Service + PostgreSQL)                              | As specified in problem                                      |

---

## Team Roles

### Teammate A — Canvas & Real-Time Core

> Owns everything that happens ON the canvas. This is the hardest and most-judged role (25pts).

### Teammate B — Backend, WebSocket Server & Infrastructure

> Owns the server: WebSocket, event log, RBAC enforcement, DB, deployment.

### Teammate C — Frontend Shell, Task Board, AI & Landing Page

> Owns everything outside the canvas: task board, sidebar, auth UI, landing page, AI pipeline.

---

## Full Feature Checklist

### Core (Mandatory)

- [x] Infinite canvas — pan, zoom, drag
- [x] Sticky notes (create, edit, move, resize, delete)
- [x] Freehand drawing strokes
- [x] Shape nodes (rect, circle, arrow)
- [x] Text block nodes
- [x] Multi-user real-time sync — no page refresh
- [x] Cursor presence — labelled, coloured, smooth
- [x] Y.js CRDT — proper merge, not last-write-wins
- [x] Node-level RBAC — Lead / Contributor / Viewer per node
- [x] RBAC enforced server-side (WebSocket mutation validation)
- [x] AI intent extraction → classifies: action item / decision / open question / reference
- [ ] Action items auto-appear in Task Board (author + timestamp + canvas link)
- [ ] Task Board — live for all users, no reload
- [ ] Tasks reference the source node by `nodeId` only — text is read live from the node (no duplication, per spec)
- [ ] Clicking a task scrolls canvas to originating node
- [x] Comments on locked nodes — Viewers/Contributors can comment on Lead-locked nodes (per spec: "contributors can still comment")
- [x] Append-only event log — every mutation stored as immutable event
- [ ] Event log sidebar — viewable by users
- [x] WebSocket delta broadcasting (not full state)
- [x] Reconnect replay — client gets only missed events since last seq_id
- [x] Deploy on Render (config done, needs actual deploy)

### Landing Page (Extra — add polish)

- [~] Hero section — LIGMA tagline + CTA (basic page exists, needs full hero design)
- [ ] Feature cards (Canvas / Task Board / Real-time / AI)
- [x] Live demo room button — creates a guest session
- [ ] How it works — 3-step visual
- [ ] Tech stack badges

### Auth & Room Flow

- [x] Signup / Login (JWT) — API done, UI pages pending
- [x] Create room → get shareable URL `/room/[roomId]`
- [x] Join room via URL
- [x] Role assignment in room (Lead sets roles)
- [ ] Guest mode (anonymous cursor, read+comment only)

### Bonus Features (pick ONE to polish fully — 8pts)

**Recommended: Time-Travel Replay** (easiest to implement given event-sourced arch)

- [x] Scrub timeline slider at bottom of canvas
- [x] Replays event log forward/backward
- [x] Each event step highlights affected node

**Alternative: AI Summary Export**

- [ ] One-click export panel
- [ ] Groups canvas content by classification
- [ ] Downloads as structured JSON/Markdown brief

---

## Work Distribution

---

### Teammate A — Canvas & Real-Time Core

**Owns:** `/apps/web/components/canvas/` — do not touch this folder, others.

#### Deliverables

| #   | Feature                                                                | Time Budget | Status  |
| --- | ---------------------------------------------------------------------- | ----------- | ------- |
| A1  | Canvas viewport — infinite pan (drag) + zoom (scroll)                 | 0–3h       | ✅ Done |
| A2  | Node system — base node component, position/size stored in Y.Map      | 3–6h       | ✅ Done |
| A3  | Sticky note node — create on dblclick, inline edit with Y.Text        | 6–9h       | ✅ Done |
| A4  | Shape nodes — rect, circle (click toolbar → place)                   | 9–11h      | ✅ Done |
| A5  | Freehand drawing — SVG path stroke, stored as Y.Array of points       | 11–13h     | ✅ Done |
| A6  | Text block node                                                        | 13–14h     | ✅ Done |
| A7  | Cursor presence — Y.js Awareness, coloured + labelled per user        | 14–16h     | ✅ Done |
| A8  | Node selection, multi-select, delete                                   | 16–18h     | ✅ Done |
| A9  | Node-level ACL visual affordances — lock icon, greyed edit for Viewer | 18–20h     | ✅ Done |
| A10 | Comment thread popover on locked nodes (per spec)                      | 20–21h     | ✅ Done |
| A11 | Time-Travel Replay UI — timeline scrubber, step through events        | 21–24h     | ✅ Done |

#### Key Technical Decisions (A owns these)

- **Y.Map schema per node:**
  ```
  { id, type, x, y, w, h, content (Y.Text), authorId, acl: {nodeRole}, createdAt }
  ```
- **Conflict resolution:** Y.js CRDT handles concurrent text edits automatically. For position conflicts (two users drag same node), use Y.js transaction + last-write-wins on position only (acceptable for spatial data).
- **Canvas rendering:** DOM nodes positioned with `transform: translate(x,y)` inside a scaled container — NOT `<canvas>` element. This enables React event handlers per node without hitbox math.
- **Freehand:** SVG overlay on top of DOM canvas layer, paths stored as serialised point arrays in Y.Array.

---

### Teammate B — Backend, WebSocket & Infrastructure

**Owns:** `/apps/server/` entirely.

#### Deliverables

| #   | Feature                                                                                                                   | Time Budget | Status     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| B1  | Project scaffold — Express + ws + PostgreSQL connection                                                                  | 0–1h       | ✅ Done    |
| B2  | DB schema — users, rooms, room_members, events, tasks                                                                    | 1–2h       | ✅ Done    |
| B3  | Auth REST API — POST /auth/signup, /auth/login (JWT)                                                                     | 2–4h       | ✅ Done    |
| B4  | Room REST API — POST /rooms, GET /rooms/:id, PATCH /rooms/:id/members                                                    | 4–5h       | ✅ Done    |
| B5  | y-websocket server — room-namespaced Y.Doc, auth token validation on connect                                             | 5–8h       | ✅ Done    |
| B6  | Append-only event log — every Y.Doc update triggers INSERT into `events` table with seq_id, roomId, payload, timestamp | 8–11h      | ✅ Done    |
| B7  | Reconnection replay — on WS connect, client sends `last_seq_id`, server sends all events since                         | 11–13h     | ✅ Done    |
| B8  | Server-side RBAC middleware — intercept WS mutations, check node ACL, reject if Viewer tries to mutate                   | 13–16h     | ✅ Done    |
| B9  | Tasks REST API — GET /rooms/:id/tasks (for initial load)                                                                 | 16–17h     | ✅ Done    |
| B10 | AI intent endpoint — POST /intent { text } → returns classification + confidence                                        | 17–19h     | ✅ Done    |
| B11 | Delta broadcasting optimisation — send Y.js update bytes (binary delta), not full doc                                    | 19–20h     | ✅ Done    |
| B12 | Render deployment — render.yaml, env vars, DB migrations on deploy                                                       | 20–22h     | ✅ Done    |
| B13 | WebSocket stress test + reconnection manual test                                                                          | 22–24h     | ⏳ Pending |

#### Key Technical Decisions (B owns these)

- **Event log schema:**
  ```sql
  CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    seq_id BIGSERIAL,
    room_id UUID NOT NULL,
    user_id UUID,
    event_type VARCHAR(50), -- node_created, node_updated, node_deleted, stroke_added
    node_id UUID,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **RBAC enforcement:** On every WebSocket message, deserialise the Y.js update, extract affected node IDs, query their ACL from the Y.Doc (or DB cache), reject if caller's role < required. **Exception:** mutations that only touch the `comments` Y.Array of a locked node are allowed for Contributors+ (spec requirement).
- **AI intent:** Call HuggingFace free inference API with candidate labels `["action item", "decision", "open question", "reference"]`. Fallback: keyword heuristic (words like "todo", "fix", "assign" → action item; "decided", "we will" → decision; "?" → open question).
- **No paid services:** PostgreSQL on Render free tier. No Redis (use in-memory Map for WS room state).

---

### Teammate C — Frontend Shell, Task Board, AI Integration & Landing Page

**Owns:** `/apps/web/` (everything except `/canvas/`), `/apps/web/app/` routes, `/apps/web/components/taskboard/`, `/apps/web/components/sidebar/`

#### Deliverables

| #   | Feature                                                                                                                                                  | Time Budget | Status                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| C1  | Next.js project scaffold + Tailwind + shadcn/ui setup                                                                                                    | 0–1h       | ✅ Done                                        |
| C2  | Landing page — hero, features, CTA, how-it-works                                                                                                        | 1–4h       | 🟡 Partial (basic page exists, needs full UI) |
| C3  | Auth pages — /login, /signup with JWT storage                                                                                                           | 4–6h       | ⏳ Pending                                    |
| C4  | Room creation + join flow — /dashboard, /room/[roomId] shell                                                                                            | 6–8h       | 🟡 Partial (room shell exists, no dashboard)  |
| C5  | Main workspace layout — canvas area (left) + task board panel (right) + event log sidebar                                                               | 8–10h      | ⏳ Pending                                    |
| C6  | Task Board component — live list, author chip, timestamp, "jump to node" button                                                                         | 10–13h     | ⏳ Pending                                    |
| C7  | Task Board real-time sync — subscribe to Y.js shared array of tasks, updates propagate automatically                                                    | 13–15h     | ⏳ Pending                                    |
| C8  | Event Log sidebar — scrollable, reverse chronological, event type badges                                                                                | 15–17h     | ⏳ Pending                                    |
| C9  | AI intent pipeline integration — on node text change debounce 1.5s → call /intent → update node classification tag → push action items to task board | 17–19h     | ⏳ Pending                                    |
| C10 | Role management UI — Lead can open node context menu → set per-node role                                                                               | 19–21h     | ⏳ Pending                                    |
| C11 | AI Summary Export panel (bonus) — if time permits                                                                                                       | 21–23h     | ⏳ Pending                                    |
| C12 | README.md — architecture diagram (Mermaid), CRDT explanation, event-sourcing explanation, setup instructions                                            | 23–24h     | ⏳ Pending                                    |

#### Key Technical Decisions (C owns these)

- **Task Board sync:** Tasks are stored in a Y.Array on the shared Y.Doc (`yDoc.getArray('tasks')`). When AI classifies a node as action item, Teammate C's code pushes `{ id, text, authorId, nodeId, timestamp }` into this array. All clients observe changes via `tasks.observe()`.
- **Layout:** Fixed right panel (320px) for Task Board, collapsible left sidebar (280px) for Event Log, remaining width = canvas. No horizontal scroll on main layout.
- **"Jump to node":** Task items store `nodeId`. On click, emit a canvas scroll event (via a shared React context or EventEmitter) that Teammate A's canvas listens to — canvas pans/zooms to centre that node.

---

## Timeline

```
HOUR  0 ─────────────────────────────────────────────────── HOUR 36
      │                                                           │
  0   ├── [ALL] 30min kickoff: agree on interfaces, branch names, env setup
      │
  1   ├── [B] DB schema + server scaffold
      ├── [A] Canvas viewport (pan/zoom)
      ├── [C] Next.js scaffold + Tailwind + landing page starts
      │
  4   ├── [B] Auth API done ✓
      ├── [A] Base node system + sticky notes
      ├── [C] Landing page done ✓, auth pages done ✓
      │
  8   ├── [B] y-websocket server live, rooms working ✓
      ├── [A] All node types working (shapes, freehand, text)
      ├── [C] Workspace shell + layout done ✓, Task Board skeleton
      │
  11  ├── [B] Append-only event log writing to DB ✓
      ├── [A] Cursor presence live ✓
      ├── [C] Task Board syncing via Y.js ✓
      │
  14  ├── [B] Reconnection replay done ✓
      ├── [A] Node selection, delete, multi-select ✓
      ├── [C] Event log sidebar ✓
      │
  17  ├── [B] Server-side RBAC enforcement ✓
      ├── [A] Node ACL visual affordances ✓
      ├── [C] AI intent pipeline integrated ✓
      │
  20  ├── [B] AI intent endpoint ✓, Render config started
      ├── [A] Presence heatmap (bonus) ✓
      ├── [C] Role management UI ✓
      │
 ─────────────────── TARGET COMPLETION: HOUR 22 ─────────────────
      │
  22  ├── [ALL] Full integration test — open 3 tabs, verify sync, CRDT, RBAC
      ├── [B] Deploy to Render ✓
      ├── [A] Time-travel replay UI
      ├── [C] AI Summary Export panel (bonus)
      │
  24  ├── [ALL] Core feature freeze — everything above the bonus line is DONE
      ├── [C] README.md with architecture diagram
      │
 ─────────────────── BUFFER: HOUR 24–30 ────────────────────────
      │
  24–28 ── Bug fixes, edge cases, UI polish
  28–30 ── Cross-browser test, Render smoke test, final README pass
  30–34 ── Dry-run demo walkthrough, rehearse Stage 1 arch presentation
  34–36 ── Sleep / reserve for emergency fixes
      │
  36  └── SUBMISSION
```

---

## Interface Contracts (So Teammates Don't Block Each Other)

These are agreed upfront at Hour 0. Nobody waits on anyone else.

### Y.Doc Shared State Shape

```typescript
// Agreed schema — A writes, B validates, C reads tasks
const yNodes   = yDoc.getMap<NodeData>('nodes')     // A owns
const yTasks   = yDoc.getArray<TaskData>('tasks')   // C writes (AI), C reads
const yStrokes = yDoc.getArray<Stroke>('strokes')   // A owns
const yEvents  = yDoc.getArray<EventEntry>('events') // B writes (mirror), C reads for sidebar

// Awareness (cursors) — A owns
provider.awareness.setLocalStateField('cursor', { x, y, userId, color, name })
```

### REST Endpoints (B publishes, C+A consume)

```
POST   /auth/signup        { name, email, password }
POST   /auth/login         { email, password } → { token }
POST   /rooms              { name } → { roomId }
GET    /rooms/:id          → { room, members }
PATCH  /rooms/:id/members  { userId, role }
GET    /rooms/:id/tasks    → TaskData[]   (initial load only, live via Y.js)
POST   /intent             { text } → { label, confidence }
```

### Node data type (A defines, B validates, C reads)

```typescript
type NodeData = {
  id: string
  type: 'sticky' | 'shape' | 'text' | 'stroke'
  x: number; y: number; w: number; h: number
  content: string          // plain text for shapes/text; Y.Text id for sticky
  authorId: string
  acl: 'lead-only' | 'contributor+' | 'all'
  classification?: 'action-item' | 'decision' | 'open-question' | 'reference' | null
  taskId?: string          // set when classification = action-item
  createdAt: number        // unix ms
  updatedAt: number
}
```

### TaskData type (C defines, B stores, A jumps to)

```typescript
// IMPORTANT: per spec "no data is duplicated" — task does NOT store node text.
// UI reads the live text from yNodes.get(nodeId).content at render time.
type TaskData = {
  id: string
  nodeId: string           // single source of truth — text lives on the node
  authorId: string
  authorName: string
  createdAt: number
  status: 'open' | 'done'
}

// Comments — stored as a Y.Array on each node's Y.Map under key `comments`
type Comment = {
  id: string
  authorId: string
  authorName: string
  text: string
  createdAt: number
}
// Lead-locked nodes still accept comment mutations server-side (RBAC exception)
```

---

## What to Add (Beyond Problem Statement)

### High Value Additions (do these)

1. **Landing page** — Judges see this first. A clean marketing page with a "Try it live" button that creates a demo room signals polish and completeness. (~3h for C, big impression boost)
2. **Shareable room URL** — Copy link button in header. Anyone with the link joins as Contributor. This is the demo flow judges will use.
3. **User colour assignment** — Each user auto-assigned a unique hue on join. Cursors, node borders (on hover), task board chips all use this colour. Ties the whole UI together visually.
4. **Node context menu** (right-click) — Quick access to: set classification manually, lock node, assign role, delete. Shows UX maturity.
5. **Keyboard shortcuts** — `N` = new sticky note, `S` = shape, `D` = draw, `Escape` = deselect. Mention these in README for judges.
6. **Connection status indicator** — Green dot = connected, yellow = reconnecting, red = offline. Shows judges the reconnection handling is real.

### One Bonus Feature to Build Fully (pick this one)

**Time-Travel Replay** — because:

- The event log is already being built (B) — replay is just replaying that array
- It directly demonstrates the append-only architecture to judges visually
- It's demoed live (slider scrub) — scores all 8 bonus points
- A already has canvas rendering — replay just sets node states from snapshots

---

## Scoring Strategy

| Category         | Max           | Our Target    | How                                                                      |
| ---------------- | ------------- | ------------- | ------------------------------------------------------------------------ |
| Real-Time Collab | 25            | **25**  | Y.js CRDT is production-grade; cursor presence via Awareness             |
| Core Features    | 25            | **23**  | All features implemented; AI intent within 3s via debounce               |
| Architecture     | 20            | **18**  | Event-sourced DB, clear separation (routes/services/data), strong README |
| UI/UX            | 15            | **13**  | shadcn/ui consistency, no layout breaks, intuitive canvas                |
| Innovation       | 15            | **13**  | Time-Travel Replay live demo + articulate arch decisions in Stage 1      |
| **TOTAL**  | **100** | **~92** |                                                                          |

---

## Risk Register

| Risk                               | Mitigation                                                 |
| ---------------------------------- | ---------------------------------------------------------- |
| Y.js + Next.js hydration conflicts | Use `dynamic(() => import('./Canvas'), { ssr: false })`  |
| HuggingFace API rate limit         | Implement keyword-heuristic fallback that runs client-side |
| Render free tier cold starts       | Keep a /health endpoint; ping it before demo               |
| RBAC bypass via raw WS             | B must validate on every message, not just on connect      |
| Canvas performance with many nodes | Virtualise — only render nodes in viewport + 200px buffer |
| Team blocker: interface mismatch   | All use the contracts above; resolve in first 30min        |

---

## Repository Structure

```
ligma/
├── apps/
│   ├── web/                    # Next.js — Teammate C owns, A owns /canvas/
│   │   ├── app/
│   │   │   ├── page.tsx        # Landing page (C)
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── dashboard/
│   │   │   └── room/[roomId]/
│   │   ├── components/
│   │   │   ├── canvas/         # Teammate A owns this entirely
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── CanvasNode.tsx
│   │   │   │   ├── CursorLayer.tsx
│   │   │   │   ├── DrawingLayer.tsx
│   │   │   │   └── TimelineReplay.tsx
│   │   │   ├── taskboard/      # Teammate C
│   │   │   ├── sidebar/        # Teammate C (event log)
│   │   │   └── ui/             # shadcn components
│   │   └── lib/
│   │       ├── yjs.ts          # Y.Doc init, provider setup
│   │       └── api.ts          # REST client
│   └── server/                 # Teammate B owns entirely
│       ├── src/
│       │   ├── index.ts        # Express + WS entry
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── rooms.ts
│       │   │   ├── tasks.ts
│       │   │   └── intent.ts
│       │   ├── services/
│       │   │   ├── yjs-server.ts
│       │   │   ├── event-log.ts
│       │   │   ├── rbac.ts
│       │   │   └── ai-intent.ts
│       │   └── db/
│       │       ├── schema.sql
│       │       └── client.ts
│       └── render.yaml
├── README.md                   # C writes this (Hour 23–24)
└── PLAN.md                     # This file
```

---

## Hour 0 — Kickoff Checklist (30 minutes, all 3 together)

- [ ] Create GitHub repo, add all 3 as collaborators
- [ ] Create branches: `main`, `feat/canvas` (A), `feat/backend` (B), `feat/frontend` (C)
- [ ] Agree on port numbers: web=3000, server=8080, WS=8080 (same process)
- [ ] Set up `.env.example` with all required env vars
- [ ] Create Render account + PostgreSQL instance → get DATABASE_URL
- [ ] Verify everyone has Node 20+, pnpm installed
- [ ] Share this PLAN.md with everyone
- [ ] Assign colours: A=blue, B=green, C=orange (for PR reviews)

---

*Last updated: April 27, 2026 — Hour 0*
