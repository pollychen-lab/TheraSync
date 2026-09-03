-- Therapist directory and booking tables, plus initial seed data.

CREATE TABLE IF NOT EXISTS therapists (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    title VARCHAR(256) NOT NULL,
    modalities TEXT[] NOT NULL,
    specialties TEXT[] NOT NULL,
    rating NUMERIC(3, 2) NOT NULL,
    slots TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id VARCHAR(64) PRIMARY KEY,
    therapist_id VARCHAR(64) REFERENCES therapists(id),
    slot VARCHAR(128) NOT NULL,
    intake_summary TEXT,
    consent_acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enforce at most one CONFIRMED booking per therapist/slot pair, even under
-- concurrent or retried commit requests (the in-memory lock alone cannot
-- guarantee this).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_slot
    ON bookings (therapist_id, slot)
    WHERE status = 'CONFIRMED';

-- Seed data
INSERT INTO therapists (id, name, title, modalities, specialties, rating, slots)
VALUES
(
    'th_01',
    'Dr. Sarah Chen, Ph.D.',
    'Clinical Psychologist / Senior CBT Supervisor',
    ARRAY['CBT', 'ACT (Acceptance and Commitment Therapy)'],
    ARRAY['Workplace Burnout', 'Generalized Anxiety', 'Perfectionism'],
    4.98,
    ARRAY['Thursday 18:00', 'Saturday 10:00']
),
(
    'th_02',
    'Marcus Vance, LMFT',
    'Licensed Marriage & Family Therapist',
    ARRAY['Psychodynamic', 'Emotionally Focused Therapy (EFT)'],
    ARRAY['Intimate Relationships', 'Family-of-Origin Trauma', 'Identity'],
    4.92,
    ARRAY['Wednesday 19:30', 'Friday 16:00']
)
ON CONFLICT (id) DO NOTHING;

-- Data API hardening.
--
-- On a managed host such as Supabase the `public` schema is reachable through
-- an auto-generated REST API using a publicly-distributed anon key, and
-- bookings.intake_summary holds sensitive mental-health intake text. Enabling
-- row level security with no policies denies every Data API read and write,
-- while the backend is unaffected because it connects as `postgres`, which
-- holds BYPASSRLS. On a plain local Postgres this is simply inert.
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Defense in depth: drop the table grants a managed host hands its API roles.
-- Guarded so the same script still runs against a local Postgres, where these
-- roles do not exist.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON TABLE therapists, bookings FROM anon, authenticated';
    END IF;
END
$$;
