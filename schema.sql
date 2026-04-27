-- LIGMA Database Schema
-- Run this in the Supabase SQL editor

CREATE TYPE user_role AS ENUM ('lead', 'contributor', 'viewer');

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  session_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role user_role NOT NULL DEFAULT 'contributor',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  node_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_room_id ON events(room_id, id);
CREATE INDEX idx_events_node_id ON events(room_id, node_id) WHERE node_id IS NOT NULL;
CREATE RULE no_update_events AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO events DO INSTEAD NOTHING;
REVOKE TRUNCATE, DELETE, UPDATE ON events FROM PUBLIC;

CREATE TABLE node_acl (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  required_role user_role NOT NULL DEFAULT 'contributor',
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (room_id, node_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  source_event_id BIGINT REFERENCES events(id),
  source_node_id TEXT NOT NULL,
  text TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open'
);

CREATE TABLE yjs_snapshots (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contested_nodes (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  versions JSONB,
  votes JSONB DEFAULT '{}'::jsonb,
  resolution TEXT,
  PRIMARY KEY (room_id, node_id, detected_at)
);
CREATE UNIQUE INDEX one_active_contest_per_node
  ON contested_nodes(room_id, node_id) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION vote_on_contest(
  p_room_id UUID, p_node_id TEXT, p_voter_id UUID, p_voted_for UUID
) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text || ':' || p_node_id, 0));
  UPDATE contested_nodes
    SET votes = votes || jsonb_build_object(p_voter_id::text, p_voted_for::text)
    WHERE room_id = p_room_id AND node_id = p_node_id AND resolved_at IS NULL;
  IF NOT FOUND THEN RETURN 'already_resolved'; END IF;
  RETURN 'ok';
END;
$$;

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE contested_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-only for members; all writes go through server with service_role)
CREATE POLICY rooms_member_select ON rooms FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid()));
CREATE POLICY room_members_select ON room_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()));
CREATE POLICY events_member_select ON events FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members WHERE room_id = events.room_id AND user_id = auth.uid()));
CREATE POLICY tasks_member_select ON tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members WHERE room_id = tasks.room_id AND user_id = auth.uid()));

-- Append-only proof (run in Supabase SQL editor to demonstrate):
-- WITH d AS (DELETE FROM events WHERE id = 1 RETURNING *)
-- SELECT count(*) AS deleted_count FROM d;
-- Returns: 0 (RULE blocks it)
