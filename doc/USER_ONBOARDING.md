# LIGMA — User Onboarding Guide

> **Live App:** https://ligma-web.vercel.app  
> **Server:** https://ligma-server.onrender.com  
> **Demo room (no login required):** `/room/demo`

---

## What is LIGMA?

**LIGMA** (Let's Integrate Groups, Manage Anything) is a real-time collaborative infinite canvas for engineering and product teams. It lets multiple people simultaneously draw, write sticky notes, place shapes, and run freehand sketches — all synced instantly using conflict-free CRDT technology (Yjs).

On top of the canvas, LIGMA adds:
- **AI intent classification** — your sticky notes are automatically labelled as action items, decisions, open questions, or references.
- **A live Task Board** — action items flow straight from the canvas into a shared to-do board, visible to everyone in the room.
- **Node-level access control** — the room Lead can lock individual nodes so only they can edit them.
- **Time-Travel Replay** — scrub back through the full edit history of any room.

---

## Creating Your Account

### Option A — Email & Password

1. Navigate to `/signup`.
2. Enter your name, email, and a password (minimum 6 characters).
3. Check your inbox for a **6-digit OTP verification code** (valid 10 minutes).
4. Enter the code on `/verify-email` to activate your account and receive your JWT session.

> If you do not receive the code, use **"Resend code"** — a new code can be requested after a 60-second cooldown. Your old code is automatically invalidated.

### Option B — Google OAuth

1. Click **"Continue with Google"** on the login or signup page.
2. Authorise with your Google account — no OTP required.
3. You are logged in immediately. A welcome email is sent on first sign-in.

### Forgot Your Password?

1. Go to `/forgot-password` and enter your email.
2. A 6-digit reset code is emailed to you.
3. Enter the code and your new password on `/reset-password`.

> Google-only accounts (no password set) cannot use password reset — use Google sign-in instead.

---

## Setting Up Locally

### Prerequisites

| Tool | Version |
|------|---------|
| [Bun](https://bun.sh) | ≥ 1.3 |
| PostgreSQL | 15+ |
| Groq API key *(optional)* | For real AI classification |

### 1 — Clone & install

```bash
git clone https://github.com/codewithalphadotcom/ligma.git
cd ligma
bun install
```

### 2 — Configure environment

```bash
# Server — copy and fill in your values
cp apps/server/.env.example apps/server/.env
# Required: DATABASE_URL, JWT_SECRET
# Optional: GROQ_API_KEY, RESEND_API_KEY, AUTH_SHARED_SECRET

# Web
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" >> apps/web/.env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8080"   >> apps/web/.env.local
```

### 3 — Push database schema

```bash
cd apps/server
bun run db:push
cd ../..
```

### 4 — Run both apps

```bash
# From repo root — starts web (port 3000) and server (port 8080) concurrently
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).  
The demo room at `/room/demo` works immediately, without creating an account.

### 5 — Run server tests

```bash
cd apps/server
bun test
```

Tests cover: node ACL enforcement, RBAC role helpers, and reconnect replay.

---

## Rooms

### Creating a Room

1. Log in and go to `/dashboard`.
2. Click **"New Room"**, give it a name, and confirm.
3. You are automatically added as the room **Lead**.

### Joining a Room

- **Share link:** A Lead can share the room URL. Visiting it with a valid session adds you as a **Contributor** automatically.
- **Demo room:** Anyone — including guests with no account — can visit `/room/demo` and start collaborating immediately.

### Room Roles

| Role | Create nodes | Edit nodes | Delete nodes | Change node ACL | Manage members |
|------|:---:|:---:|:---:|:---:|:---:|
| **Lead** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Contributor** | ✅ | ✅ (unless locked) | ✅ (unless locked) | ❌ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ❌ |

> **All roles can comment** on any node, including Lead-locked ones.

Role changes take effect **live** — a demoted user's next edit is rejected by the server within one round-trip, no reconnect needed.

---

## Using the Canvas

### Navigation

| Action | How |
|--------|-----|
| Pan | Click and drag on empty canvas space |
| Zoom | Mouse wheel / trackpad pinch |
| Reset view | Double-click empty canvas space |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New sticky note at canvas centre |
| `S` | Shape tool (rectangle / circle) |
| `D` | Freehand draw tool |
| `T` | Text block tool |
| `Escape` | Deselect / cancel active tool |
| `Delete` / `Backspace` | Delete selected node(s) |
| `H` | Toggle Time-Travel replay panel |
| `←` / `→` | Step backward / forward in replay |

### Node Types

| Type | Created by | Notes |
|------|-----------|-------|
| **Sticky Note** | `N` key or double-click canvas | Supports inline text editing; AI classifies text after 1.5 s of idle |
| **Rectangle / Circle** | `S` key | Resizable, colourable |
| **Freehand Stroke** | `D` key | Immutable once finished — points cannot be edited |
| **Text Block** | `T` key | Floating text label |

### Node-Level Access Control (ACL)

Each node has an ACL setting the Lead can change:

| ACL | Who can edit the node |
|-----|-----------------------|
| `all` | Lead + Contributor |
| `contributor+` | Lead + Contributor |
| `lead-only` | Lead only |

Viewers can **comment** on any node regardless of ACL.

---

## AI Intent Classification & Task Board

LIGMA watches for typing on sticky notes. After **1.5 seconds of idle time**, the text is sent to the Groq AI model which classifies it as one of:

| Label | Example text |
|-------|-------------|
| 🔴 **action item** | "Fix login bug before release" |
| 🟡 **decision** | "We agreed to use PostgreSQL" |
| 🔵 **open question** | "Should we support mobile?" |
| ⚪ **reference** | "See RFC-2119 for must/should definitions" |

When a node is classified as **action item**, it is automatically added to the **Task Board** panel, visible and live-synced for every user in the room.

> If no Groq API key is configured, a fast keyword-based fallback classifier is used instead — the Task Board still populates correctly.

Tasks can be marked **Done** from the Task Board. The status is persisted to the database and reflected live for all peers.

---

## Time-Travel Replay

Every canvas mutation is stored as an immutable event in the database. The replay panel lets you step through the full history of a room.

1. Press `H` (or click the clock icon in the toolbar) to open the replay panel.
2. Drag the slider to any point in time.
3. Use `←` / `→` arrow keys to step one event at a time.
4. Press `H` again (or close the panel) to return to live mode.

> The canvas is **read-only** during replay. No edits are possible until you return to live mode.

---

## Event Log

The **Event Log** sidebar (right panel) shows a real-time, append-only feed of every canvas mutation — who changed what, and when. It updates live as peers make edits.

---

## Connection Status

The room header shows a live connection indicator:
- 🟢 **Connected** — fully synced with the server.
- 🟡 **Connecting** — handshaking (normal on first load).
- 🔴 **Disconnected** — network lost; the client will auto-reconnect when connectivity is restored.

LIGMA handles network interruptions gracefully: on reconnect, the server replays only the events you missed (delta sync), so no edits are ever lost.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Verification code not received | Wait 60 s and use "Resend code"; check your spam folder |
| Canvas not loading | Hard-refresh (`Ctrl+Shift+R`); check browser console for errors |
| Real-time sync not working | Check connection indicator — if disconnected, check your network; the client auto-reconnects |
| AI labels not appearing | Groq API key may be missing; keyword fallback is active — labels still appear |
| Role change not taking effect | Role changes propagate within ~1 round-trip; try editing a node to trigger a refresh |

---

## Getting Help

- **Technical architecture:** [`README.md`](../README.md)
- **Development guidelines:** [`AGENT.md`](../AGENT.md)
- **Project plan:** [`doc/PLAN.md`](./PLAN.md)
- **GitHub:** https://github.com/codewithalphadotcom/ligma

---

*Last updated: April 29, 2026*