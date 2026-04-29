# LIGMA — Live Interactive Group Meeting Application

A real-time collaborative canvas for teams. Multiple users share a single infinite whiteboard, write sticky notes, lock decisions, track action items automatically, and tag any element.

---

## Architecture

### Frontend (`client/`)

Built with **React + Vite + TypeScript**.

| Layer | Technology |
|---|---|
| Canvas | [tldraw](https://tldraw.dev) — infinite whiteboard with built-in shape primitives |
| Realtime sync | Yjs CRDT bound to tldraw's store via `useYjsBinding.ts` |
| State | React hooks + context (`CanvasContext`, `useMyRole`, `useTagStore`) |
| Styling | Inline styles — glassmorphism / SoftAurora WebGL background |
| Routing | React Router v6 |
| WebSocket client | Custom `wsClient.ts` with auth queue and reconnect logic |

Key components:
- `TaskBoard` — live action-item tracker, auto-populated by AI classification
- `EventLog` — append-only audit log of canvas mutations
- `TagsPanel` — per-node tag editor (shown on selection)
- `TagsOverlay` — hover tag display rendered over canvas
- `ContestedNodeOverlay` — conflict resolution UI for heavily-edited nodes
- `NodeLockButton` — lead-only decision locking

### Backend (`server/`)

Built with **Node.js + Express + TypeScript**, deployed on Render.

| Layer | Technology |
|---|---|
| HTTP API | Express — rooms, members, tasks, tags, events |
| WebSocket | `ws` library — Yjs sync + awareness + realtime events |
| CRDT engine | Yjs (`Y.Doc`) — in-memory per room, snapshotted to DB |
| Auth | Supabase JWT validation on every WS message and HTTP request |
| Permissions | RBAC middleware — lead / contributor / viewer per room |

### Realtime Sync Layer

**Strategy: Yjs CRDT (Conflict-free Replicated Data Type)**

tldraw shapes are stored as a `Y.Map` inside a `Y.Doc`. Every mutation produces a compact binary Yjs update. The server:

1. Receives `mutation:apply` from any client
2. Applies the update to the in-memory `Y.Doc`
3. Broadcasts the binary diff to all other clients in the room
4. Debounces a snapshot write to Supabase every 10 seconds

On join, the server computes a delta from the client's state vector and sends only the missing operations.

**Why Yjs?**

- Mathematically proven convergence — any two replicas that have seen the same set of operations will be in identical state, regardless of the order they were applied.
- No central coordinator needed for conflict resolution — each operation is independent and commutative.
- Handles simultaneous character insertion/deletion in text nodes natively — concurrent edits merge without overwrite.
- Compact binary encoding keeps WebSocket payloads small.
- First-class tldraw integration.

**How concurrent edits resolve:**

Each insertion carries a Lamport-style logical timestamp and a unique client ID. When two users type at the same position simultaneously, Yjs uses the client ID as a deterministic tiebreaker — both clients converge to the same merged string within one round-trip. Deletions are tombstoned rather than physically removed, so concurrent deletes never conflict.

### Persistence Layer

| Data | Storage |
|---|---|
| Canvas state | `yjs_snapshots` — binary Yjs state, upserted every ~10 s |
| Events | `events` — append-only audit log, no UPDATE/DELETE allowed |
| Tasks | `tasks` — action items with AI intent classification |
| Node ACL | `node_acl` — per-node role requirements and lock state |
| Contests | `contested_nodes` — edit conflict records and votes |
| Tags | `node_tags` — per-element tags, unique per (room, node, tag) |

All persistence via **Supabase** (PostgreSQL + RLS). The server uses the service-role key for writes; RLS policies guard client reads.

**Why event-sourcing for the activity log?**

The `events` table has SQL-level `NO UPDATE` / `NO DELETE` rules — rows are physically immutable. This gives a reliable audit trail for replaying session history and building the Event Log panel without risk of accidental mutation.

---

## Task Board Auto-sync

When any user writes text on the canvas:

1. tldraw mutation → Yjs update → `applyMutation()` on server
2. Server extracts text from the shape's TipTap richText AST
3. `taskExtractor.ts` debounces 3 seconds, then sends text to **Claude Haiku** via `aiClassifier.ts`
4. Claude classifies intent: `action_item` | `decision` | `open_question` | `reference`
5. Task is upserted to `tasks` (no duplicates — checks existing open task for that node)
6. `task:created` or `task:updated` broadcast to all room clients
7. `TaskBoard` receives the WS event and adds the card instantly

Cards show category label + content. Clicking a card zooms the canvas to the source node.

---

## Multiuser Tagging

Any canvas element can be tagged by any room member. Tags are stored in `node_tags` and broadcast via `tag:added` / `tag:removed` WebSocket events. Tags are hidden normally and appear as pills above an element on hover. Select any element to open the tag editor.

**DB setup** — run once in Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS node_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT node_tags_unique UNIQUE(room_id, node_id, tag)
);
ALTER TABLE node_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read_tags" ON node_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = node_tags.room_id AND user_id = auth.uid()
  ));
```

---

## Technical Choices

| Choice | Rationale |
|---|---|
| **Yjs CRDT** | Proven convergence, compact binary encoding, native tldraw integration |
| **tldraw** | Production-grade canvas with shape primitives, selection, and awareness built in |
| **Append-only events table** | Immutable audit trail; enables activity replay without complex state reconstruction |
| **Supabase** | Postgres with built-in auth, RLS, and realtime — no separate auth service needed |
| **WebSocket (ws library)** | Full-duplex binary framing needed for Yjs update payloads |
| **Claude Haiku (AI classification)** | Fast, cheap intent classification running server-side |
| **Render (server) + Vercel (client)** | Simple Node.js hosting with persistent WS support; edge CDN for the static build |

---

## Local Development

```bash
# 1. Install dependencies
npm install
cd client && npm install
cd ../server && npm install

# 2. Environment variables

# client/.env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SERVER_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# server/.env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
PORT=3001

# 3. Run
cd server && npm run dev   # http://localhost:3001
cd client && npm run dev   # http://localhost:5173
```

---

## Roles

| Role | Capabilities |
|---|---|
| **lead** | Full access — lock decisions, unlock nodes, manage members |
| **contributor** | Create and edit shapes |
| **viewer** | Read-only canvas |

The first user to open a room URL is auto-assigned `lead`.
