# AGENT WORKFLOW — LIGMA

Self-reminders for every implementation cycle. Read this before starting any new feature.

## Standing rules

1. **Production-ready, first try.** No "we'll fix it later." Edge cases handled now.
2. **No hard-coded values.** Use `lib/env.ts` (or server equivalent) for anything configurable.
3. **No data duplication.** Spec requirement — tasks reference `nodeId` only.
4. **Every Y.js mutation in a `doc.transact(..., 'origin-tag')`.** Origin tag becomes the event-log event_type.
5. **`stopPropagation` on every node-level pointer handler** so canvas pan/zoom doesn't fire underneath.
6. **`requestAnimationFrame` coalescing for high-frequency mutations** (drag, draw, pointermove) — never fire one Y.js update per pointer event.
7. **`screenToWorld` translation** wherever pointer events meet world content. Account for `viewport.zoom` AND `viewport.x/y`.
8. **`'use client'` on anything that touches** Y.js, WebSocket, `window`, `document`, `localStorage`, or hooks.
9. **`useEffect` cleanups must be exhaustive** — unobserve, removeEventListener, cancelAnimationFrame, releasePointerCapture, destroy bindings.
10. **`memo()` node components** so a single node's update doesn't re-render every other node.

## End-of-implementation checklist (RUN EVERY TIME)

- [ ] `get_errors` on every file touched
- [ ] `bun run typecheck` from `apps/web` — must be zero errors
- [ ] `bun run build` from `apps/web` — must succeed
- [ ] If touching server: `bun run typecheck` from `apps/server`
- [ ] Update PLAN.md status column from ⏳ Pending → ✅ Done

## Common pitfalls to avoid

- **Next 16 + `dynamic({ ssr: false })`** must be wrapped in a `'use client'` component. Don't put it in a server component.
- **`observe` vs `observeDeep`** — use `observeDeep` on a `Y.Map<Y.Map>` so nested field changes fire.
- **Y.Text inside Y.Map** — read with `m.get('content')` and check `instanceof Y.Text`. Don't `JSON.stringify`.
- **Awareness state** updates fire frequently — debounce / RAF the consumer side, not the producer (producer must send asap).
- **Pointer capture** — always `releasePointerCapture` in cleanup AND in `pointercancel`.
- **Node `key` props** — use the stable `node.id`, never the array index.
- **Wheel handler** — must be `{ passive: false }` to allow `preventDefault`.
- **`touchAction: 'none'`** on draggable surfaces or mobile breaks.

## Architecture invariants

- World coordinates are pre-zoom. Screen coordinates are post-zoom. Conversions are explicit.
- Each node is a `Y.Map` inside the room's top-level `nodes: Y.Map<Y.Map>`. Never flat-store node fields on the root.
- Cursor presence lives in **Y.Awareness**, not in the Y.Doc (it's transient, not history).
- Drawing strokes are immutable once finished — append a `points: Y.Array` only at create time, then never mutate.
- Server-side RBAC is the source of truth. Client UI only mirrors it.

## File ownership

- `components/canvas/**` — Teammate A
- `app/`, `components/taskboard/**`, `components/sidebar/**`, `components/landing/**` — Teammate C
- `apps/server/**` — Teammate B
- `lib/**` — shared, edit carefully

When implementing A's work, if I need a B/C surface to exist (e.g., a hook), build that end to end and production ready in the appropriate folder.
