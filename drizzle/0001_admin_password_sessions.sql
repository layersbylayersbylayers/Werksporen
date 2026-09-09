CREATE TABLE IF NOT EXISTS admin_auth (
  id TEXT PRIMARY KEY CHECK (id = 'owner'), username TEXT NOT NULL, salt TEXT NOT NULL,
  password_hash TEXT NOT NULL, iterations INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
PRAGMA optimize;
