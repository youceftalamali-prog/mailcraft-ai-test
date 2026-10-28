-- Apply to a dedicated Neon PostgreSQL database before enabling the auth Worker.
-- Passwords are never stored; password_hash contains a PBKDF2 verifier.
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_usage (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  campaigns_count INTEGER NOT NULL DEFAULT 0 CHECK (campaigns_count >= 0),
  images_count INTEGER NOT NULL DEFAULT 0 CHECK (images_count >= 0),
  voice_count INTEGER NOT NULL DEFAULT 0 CHECK (voice_count >= 0),
  PRIMARY KEY (user_id, period_start)
);

CREATE TABLE IF NOT EXISTS app_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_audit_events_created_at_idx ON app_audit_events(created_at DESC);