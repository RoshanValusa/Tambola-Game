CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'guest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  room_code TEXT NOT NULL,
  host_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  total_calls INTEGER NOT NULL,
  ended_reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_host ON games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at DESC);

CREATE TABLE IF NOT EXISTS game_players (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  ticket_json JSONB NOT NULL,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prize TEXT NOT NULL,
  valid BOOLEAN NOT NULL,
  call_index INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_game ON claims(game_id);
