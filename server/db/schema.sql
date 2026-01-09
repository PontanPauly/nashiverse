-- Nashiverse Family App Database Schema
-- PostgreSQL Migration File

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- 3. Households table (created before people due to FK)
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. People table
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nickname TEXT,
    photo_url TEXT,
    birth_date DATE,
    role_type TEXT CHECK (role_type IN ('adult', 'teen', 'child', 'ancestor')),
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    linked_user_email TEXT,
    allergies TEXT[],
    dietary_preferences TEXT[],
    is_deceased BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_household_id ON people(household_id);
CREATE INDEX idx_people_linked_user_email ON people(linked_user_email);

-- 4. Relationships table
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    related_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'partner', 'sibling'))
);

CREATE INDEX idx_relationships_person_id ON relationships(person_id);
CREATE INDEX idx_relationships_related_person_id ON relationships(related_person_id);

-- 5. Trips table
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cover_image_url TEXT,
    planner_ids UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trips_start_date ON trips(start_date);
CREATE INDEX idx_trips_end_date ON trips(end_date);

-- 6. Trip Participants table
CREATE TABLE trip_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'maybe', 'declined')) DEFAULT 'accepted'
);

CREATE INDEX idx_trip_participants_trip_id ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_person_id ON trip_participants(person_id);

-- 7. Meals table
CREATE TABLE meals (
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

CREATE INDEX idx_meals_trip_id ON meals(trip_id);
CREATE INDEX idx_meals_date ON meals(date);

-- 8. Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    notes TEXT,
    assigned_person_ids UUID[]
);

CREATE INDEX idx_rooms_trip_id ON rooms(trip_id);

-- 9. Activities table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE,
    time TIME,
    location TEXT,
    description TEXT,
    organizer_ids UUID[]
);

CREATE INDEX idx_activities_trip_id ON activities(trip_id);
CREATE INDEX idx_activities_date ON activities(date);

-- 10. Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    category TEXT,
    date DATE,
    split_among_ids UUID[]
);

CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_paid_by_person_id ON expenses(paid_by_person_id);

-- 11. Packing Items table
CREATE TABLE packing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    category TEXT,
    is_packed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_packing_items_trip_id ON packing_items(trip_id);
CREATE INDEX idx_packing_items_person_id ON packing_items(person_id);

-- 12. Shared Trip Items table
CREATE TABLE shared_trip_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    assigned_to_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    is_confirmed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_shared_trip_items_trip_id ON shared_trip_items(trip_id);
CREATE INDEX idx_shared_trip_items_assigned_to_person_id ON shared_trip_items(assigned_to_person_id);

-- 13. Moments table
CREATE TABLE moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    media_urls TEXT[],
    media_type TEXT,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    tagged_person_ids UUID[],
    captured_date TIMESTAMPTZ,
    author_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moments_trip_id ON moments(trip_id);
CREATE INDEX idx_moments_author_person_id ON moments(author_person_id);
CREATE INDEX idx_moments_created_date ON moments(created_date);

-- 14. Love Notes table
CREATE TABLE love_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    from_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    to_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_love_notes_from_person_id ON love_notes(from_person_id);
CREATE INDEX idx_love_notes_to_person_id ON love_notes(to_person_id);
CREATE INDEX idx_love_notes_trip_id ON love_notes(trip_id);

-- 15. Family Stories table
CREATE TABLE family_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    author_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    related_person_ids UUID[],
    era TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_stories_author_person_id ON family_stories(author_person_id);
CREATE INDEX idx_family_stories_created_date ON family_stories(created_date);

-- 16. Family Settings table
CREATE TABLE family_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_name TEXT,
    invite_code TEXT,
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Join Requests table
CREATE TABLE join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_join_requests_status ON join_requests(status);
CREATE INDEX idx_join_requests_email ON join_requests(email);

-- 18. Rituals table
CREATE TABLE rituals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT,
    assigned_person_ids UUID[],
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    next_occurrence TIMESTAMPTZ,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rituals_household_id ON rituals(household_id);
CREATE INDEX idx_rituals_next_occurrence ON rituals(next_occurrence);

-- 19. Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_ids UUID[],
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_created_date ON conversations(created_date);

-- 20. Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    from_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_from_person_id ON messages(from_person_id);
CREATE INDEX idx_messages_created_date ON messages(created_date);
