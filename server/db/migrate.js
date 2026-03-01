import { pool } from './index.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── people table: add missing columns ──
    await client.query(`
      ALTER TABLE people ADD COLUMN IF NOT EXISTS about TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS medical_notes TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_profile JSONB;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS birth_year INTEGER;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS death_date DATE;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS guardian_ids UUID[];
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_pattern TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_intensity INTEGER;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS star_flare_count INTEGER;
    `);

    // ── trips table: add missing columns ──
    await client.query(`
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'family_wide';
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning';
    `);

    // ── trip_participants: add room_id and fix status constraint ──
    await client.query(`
      ALTER TABLE trip_participants ADD COLUMN IF NOT EXISTS room_id UUID;
    `);
    // Drop and recreate status constraint to include 'invited'
    await client.query(`
      ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_status_check;
      ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_status_check
        CHECK (status IN ('accepted', 'maybe', 'declined', 'invited'));
    `);

    // ── households table: add description ──
    await client.query(`
      ALTER TABLE households ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    // ── family_settings table: add missing columns ──
    await client.query(`
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS admin_emails TEXT[];
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS planner_emails TEXT[];
    `);

    // ── join_requests table: add review tracking ──
    await client.query(`
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT;
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    `);

    // ── users table: add role ──
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    `);

    // ── calendar_events table: create if not exists ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        event_type TEXT,
        person_ids UUID[],
        is_recurring BOOLEAN DEFAULT false,
        color TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── session table for connect-pg-simple ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
