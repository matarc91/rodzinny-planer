-- ============================================================
-- Schemat bazy danych: Planer Rodzinny (cosmere PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Użytkownicy (zastępuje Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  is_verified         BOOLEAN DEFAULT false,
  verification_token  TEXT,
  verification_expires TIMESTAMPTZ,
  reset_token         TEXT,
  reset_expires       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Rodziny
CREATE TABLE IF NOT EXISTS families (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  join_code           TEXT UNIQUE NOT NULL,
  owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Profile (powiązanie użytkownik ↔ rodzina ↔ osoba w planerze)
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  family_id           UUID REFERENCES families(id) ON DELETE CASCADE,
  person_id           TEXT,
  display_name        TEXT,
  role                TEXT DEFAULT 'member',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Stan danych rodziny (JSON blob ze stanem aplikacji)
CREATE TABLE IF NOT EXISTS family_state (
  family_id           UUID PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  data                JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Subskrypcje Web Push (jedno urządzenie = jeden wiersz)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  family_id           UUID REFERENCES families(id) ON DELETE CASCADE,
  endpoint            TEXT UNIQUE NOT NULL,
  p256dh              TEXT,
  auth                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy przyspieszające
CREATE INDEX IF NOT EXISTS idx_profiles_family ON profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_push_family ON push_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
