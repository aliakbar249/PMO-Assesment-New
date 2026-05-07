-- ============================================================
-- 360° Assessment Tool - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee' 
                  CHECK (role IN ('admin','employee','reviewer')),
  name          TEXT,
  status        TEXT DEFAULT 'active',
  password_reset BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employees ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  employee_id     TEXT UNIQUE,
  name            TEXT NOT NULL,
  email           TEXT,
  job_title       TEXT,
  department      TEXT,
  level           TEXT,
  organization    TEXT,
  phone           TEXT,
  location        TEXT,
  manager         TEXT,
  status          TEXT DEFAULT 'active',
  profile_complete BOOLEAN DEFAULT FALSE,
  template_id     UUID REFERENCES assessment_templates(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add template_id to existing employees table if it doesn't exist (migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='employees' AND column_name='template_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN template_id UUID REFERENCES assessment_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Template Sections ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  self_tip    TEXT,
  reviewer_tip TEXT,
  order_index  INTEGER DEFAULT 0,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Template Statements ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_statements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  UUID REFERENCES template_sections(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  self_tip    TEXT,
  reviewer_tip TEXT,
  order_index  INTEGER DEFAULT 0,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Assessments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
  responses    JSONB DEFAULT '{}',
  status       TEXT DEFAULT 'in_progress' 
                 CHECK (status IN ('in_progress','submitted')),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Assignments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number IN (1,2,3)),
  title       TEXT,
  type        TEXT,
  sector      TEXT,
  client_org  TEXT,
  role        TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT,
  budget      TEXT,
  team_size   INTEGER,
  location    TEXT,
  description TEXT,
  outcomes    TEXT,
  challenges  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nominations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nominations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES assignments(id) ON DELETE SET NULL,
  reviewer_type   TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT,
  department      TEXT,
  designation     TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  approval_status TEXT DEFAULT 'pending' 
                    CHECK (approval_status IN ('pending','approved','rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reviewers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviewers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  nomination_id UUID REFERENCES nominations(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  temp_password TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reviews ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id       UUID REFERENCES reviewers(id) ON DELETE CASCADE,
  employee_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  responses         JSONB DEFAULT '{}',
  assignment_ratings JSONB DEFAULT '{}',
  status            TEXT DEFAULT 'in_progress',
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Password Resets ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  temp_password TEXT NOT NULL,
  used          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Assessment Templates (multi-template support) ──────────────
-- Each template defines a set of sections for a specific audience
CREATE TABLE IF NOT EXISTS assessment_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  is_default          BOOLEAN DEFAULT FALSE,
  target_levels       TEXT[] DEFAULT '{}',
  target_departments  TEXT[] DEFAULT '{}',
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Assessment Template Sections (which sections belong to which template)
CREATE TABLE IF NOT EXISTS assessment_template_sections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  UUID REFERENCES assessment_templates(id) ON DELETE CASCADE,
  section_id   UUID REFERENCES template_sections(id) ON DELETE CASCADE,
  order_index  INTEGER DEFAULT 0,
  UNIQUE(template_id, section_id)
);

-- ── Row Level Security (allow all via anon key) ────────────────
ALTER TABLE users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_statements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON users;
DROP POLICY IF EXISTS "allow_all" ON employees;
DROP POLICY IF EXISTS "allow_all" ON template_sections;
DROP POLICY IF EXISTS "allow_all" ON template_statements;
DROP POLICY IF EXISTS "allow_all" ON assessments;
DROP POLICY IF EXISTS "allow_all" ON assignments;
DROP POLICY IF EXISTS "allow_all" ON nominations;
DROP POLICY IF EXISTS "allow_all" ON reviewers;
DROP POLICY IF EXISTS "allow_all" ON reviews;
DROP POLICY IF EXISTS "allow_all" ON password_resets;
DROP POLICY IF EXISTS "allow_all" ON assessment_templates;
DROP POLICY IF EXISTS "allow_all" ON assessment_template_sections;

CREATE POLICY "allow_all" ON users                       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON employees                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON template_sections           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON template_statements         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON assessments                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON assignments                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON nominations                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reviewers                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reviews                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON password_resets             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON assessment_templates        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON assessment_template_sections FOR ALL USING (true) WITH CHECK (true);

-- ── Seed Admin ─────────────────────────────────────────────────
INSERT INTO users (id, email, password, role, name)
VALUES ('00000000-0000-0000-0000-000000000001','admin@company.com','Admin@123','admin','System Administrator')
ON CONFLICT (email) DO NOTHING;

SELECT 'Schema created successfully!' AS result;
