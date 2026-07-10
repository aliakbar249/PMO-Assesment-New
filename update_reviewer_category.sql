-- ============================================================
--  OPTEM ACUITY — Update Reviewer Category
--  Table : nominations
--  Column: reviewer_type
--
--  Valid categories:
--    peer        → Peer
--    sponsor     → Sponsor
--    supervisor  → Supervisor
--    client      → Client
--    teamMember  → Team Member
--
--  Sentinel rows (reviewer_type = '__submitted__') are
--  excluded from every query below — DO NOT touch those.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- STEP 1 ▸ INSPECT
--   Run this first to see all reviewers and their current
--   categories before making any changes.
-- ──────────────────────────────────────────────────────────
SELECT
    n.id                  AS nomination_id,
    n.reviewer_type       AS current_category,
    n.approval_status,
    n.reviewer_name,
    n.reviewer_email,
    n.reviewer_designation,
    e.name                AS employee_name,
    e.email               AS employee_email,
    e.organization
FROM nominations n
LEFT JOIN employees e ON e.id = n.employee_id
WHERE n.reviewer_type <> '__submitted__'
ORDER BY e.organization, e.name, n.reviewer_name;


-- ──────────────────────────────────────────────────────────
-- STEP 2A ▸ UPDATE A SINGLE REVIEWER (by nomination ID)
--   Replace <NOMINATION_ID> with the actual UUID from Step 1.
--   Replace <NEW_CATEGORY>  with one of the valid values above.
-- ──────────────────────────────────────────────────────────
UPDATE nominations
SET    reviewer_type = '<NEW_CATEGORY>'          -- e.g. 'supervisor'
WHERE  id            = '<NOMINATION_ID>'          -- e.g. 'a1b2c3d4-...'
AND    reviewer_type <> '__submitted__';          -- safety guard


-- ──────────────────────────────────────────────────────────
-- STEP 2B ▸ UPDATE BY REVIEWER EMAIL (all assignments)
--   Useful when the same reviewer is assigned to multiple
--   employees and you want to fix the category everywhere.
-- ──────────────────────────────────────────────────────────
UPDATE nominations
SET    reviewer_type = '<NEW_CATEGORY>'           -- e.g. 'peer'
WHERE  reviewer_email = '<REVIEWER_EMAIL>'        -- e.g. 'john@company.com'
AND    reviewer_type  <> '__submitted__';         -- safety guard


-- ──────────────────────────────────────────────────────────
-- STEP 2C ▸ UPDATE FOR A SPECIFIC REVIEWER + EMPLOYEE PAIR
--   Most surgical option — one reviewer, one employee only.
-- ──────────────────────────────────────────────────────────
UPDATE nominations
SET    reviewer_type = '<NEW_CATEGORY>'           -- e.g. 'client'
WHERE  reviewer_email = '<REVIEWER_EMAIL>'
AND    employee_id    = '<EMPLOYEE_ID>'           -- UUID from employees table
AND    reviewer_type  <> '__submitted__';         -- safety guard


-- ──────────────────────────────────────────────────────────
-- STEP 3 ▸ VERIFY
--   Re-run after the update to confirm the change applied.
-- ──────────────────────────────────────────────────────────
SELECT
    n.id                  AS nomination_id,
    n.reviewer_type       AS updated_category,
    n.reviewer_name,
    n.reviewer_email,
    e.name                AS employee_name
FROM nominations n
LEFT JOIN employees e ON e.id = n.employee_id
WHERE n.reviewer_type <> '__submitted__'
ORDER BY e.name, n.reviewer_name;
