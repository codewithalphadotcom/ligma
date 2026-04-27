CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  color         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  role    TEXT NOT NULL CHECK (role IN ('lead', 'contributor', 'viewer')),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  seq_id     BIGSERIAL UNIQUE,
  room_id    UUID NOT NULL REFERENCES rooms(id),
  user_id    UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  node_id    UUID,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id),
  node_id     UUID NOT NULL,
  author_id   UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
