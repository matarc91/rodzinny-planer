import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Nieoczekiwany błąd połączenia:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/**
 * Automatyczna inicjalizacja / migracja schematu bazy danych
 */
export async function initSchema() {
  try {
    await query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        verification_expires TIMESTAMPTZ,
        reset_token TEXT,
        reset_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS families (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        join_code TEXT UNIQUE NOT NULL,
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE families ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        family_id UUID REFERENCES families(id) ON DELETE CASCADE,
        person_id TEXT,
        display_name TEXT,
        role TEXT DEFAULT 'member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

      CREATE TABLE IF NOT EXISTS family_state (
        family_id UUID PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        family_id UUID REFERENCES families(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT,
        auth TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS idx_profiles_family ON profiles(family_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_family ON push_subscriptions(family_id);
      CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
    `);
    console.log('[DB] Schemat bazy danych zweryfikowany i gotowy.');
  } catch (err) {
    console.error('[DB] Błąd inicjalizacji schematu:', err.message);
  }
}

export default pool;
