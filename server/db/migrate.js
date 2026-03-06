import { pool } from './index.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS households (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS people (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        nickname TEXT,
        photo_url TEXT,
        birth_date DATE,
        birth_year INTEGER,
        death_date DATE,
        role_type TEXT,
        household_id UUID REFERENCES households(id),
        household_status TEXT DEFAULT 'primary',
        linked_user_email TEXT,
        allergies TEXT,
        dietary_preferences TEXT,
        is_deceased BOOLEAN DEFAULT false,
        about TEXT,
        medical_notes TEXT,
        star_profile JSONB,
        guardian_ids UUID[],
        star_pattern TEXT,
        star_intensity INTEGER,
        star_flare_count INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL REFERENCES people(id),
        related_person_id UUID NOT NULL REFERENCES people(id),
        relationship_type TEXT NOT NULL,
        subtype TEXT DEFAULT 'biological'
      );

      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        cover_image_url TEXT,
        planner_ids UUID[],
        visibility TEXT DEFAULT 'family_wide',
        status TEXT DEFAULT 'planning',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS trip_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        person_id UUID NOT NULL REFERENCES people(id),
        status TEXT DEFAULT 'invited',
        room_id UUID
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        capacity INTEGER,
        notes TEXT,
        assigned_person_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS meals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        meal_type TEXT,
        title TEXT,
        description TEXT,
        chef_ids UUID[],
        location TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        date DATE,
        time TEXT,
        location TEXT,
        description TEXT,
        organizer_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        description TEXT,
        amount NUMERIC(10,2),
        paid_by_person_id UUID REFERENCES people(id),
        category TEXT,
        date DATE,
        split_among_ids UUID[]
      );

      CREATE TABLE IF NOT EXISTS packing_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        person_id UUID REFERENCES people(id),
        item TEXT NOT NULL,
        category TEXT,
        is_packed BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS shared_trip_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        item TEXT NOT NULL,
        assigned_to_person_id UUID REFERENCES people(id),
        is_confirmed BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS moments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT,
        media_urls TEXT[],
        media_type TEXT,
        trip_id UUID,
        tagged_person_ids UUID[],
        captured_date DATE,
        author_person_id UUID,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS love_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        from_person_id UUID NOT NULL REFERENCES people(id),
        to_person_id UUID NOT NULL REFERENCES people(id),
        trip_id UUID,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT,
        author_person_id UUID,
        related_person_ids UUID[],
        era TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_name TEXT,
        invite_code TEXT,
        timezone TEXT,
        tagline TEXT,
        admin_emails TEXT[],
        planner_emails TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS join_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by_email TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rituals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        frequency TEXT,
        assigned_person_ids UUID[],
        household_id UUID,
        next_occurrence DATE,
        category TEXT,
        typical_month TEXT,
        host_rotation UUID[],
        current_host_index INTEGER,
        custom_frequency TEXT,
        cover_image_url TEXT,
        typical_participant_household_ids UUID[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_ids UUID[],
        type TEXT NOT NULL DEFAULT 'direct',
        name TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        from_person_id UUID REFERENCES people(id),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

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
      ALTER TABLE people ADD COLUMN IF NOT EXISTS household_status TEXT DEFAULT 'primary';
    `);

    await client.query(`
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'family_wide';
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning';
    `);

    await client.query(`
      ALTER TABLE trip_participants ADD COLUMN IF NOT EXISTS room_id UUID;
    `);
    await client.query(`
      ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_status_check;
      ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_status_check
        CHECK (status IN ('accepted', 'maybe', 'declined', 'invited'));
    `);

    await client.query(`
      ALTER TABLE households ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    await client.query(`
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS admin_emails TEXT[];
      ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS planner_emails TEXT[];
    `);

    await client.query(`
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT;
      ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    `);

    await client.query(`
      ALTER TABLE relationships ADD COLUMN IF NOT EXISTS subtype TEXT DEFAULT 'biological';
    `);

    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    await client.query(`
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS typical_month TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS host_rotation UUID[];
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS current_host_index INTEGER;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS custom_frequency TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
      ALTER TABLE rituals ADD COLUMN IF NOT EXISTS typical_participant_household_ids UUID[];
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
