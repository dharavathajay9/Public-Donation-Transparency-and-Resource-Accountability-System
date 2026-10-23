-- ============================================================================
-- TrustLedger — Public Donation Transparency & Resource Accountability System
-- Relational schema (Cloudflare D1 / SQLite)
--
-- Demonstrates: 3NF normalisation, primary/foreign keys, CHECK constraints,
-- indexes, SQL views, aggregate analytics and trigger-enforced business rules.
-- ============================================================================

-- Foreign keys are enforced by D1/SQLite for every statement in this schema.

-- ---------------------------------------------------------------- core tables

CREATE TABLE IF NOT EXISTS organizations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  registration_no TEXT  NOT NULL UNIQUE,
  mission       TEXT    NOT NULL DEFAULT '',
  contact_email TEXT    NOT NULL,
  phone         TEXT,
  website       TEXT,
  verified      INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name            TEXT    NOT NULL,
  password_hash   TEXT    NOT NULL,
  role            TEXT    NOT NULL CHECK (role IN ('admin', 'staff', 'auditor', 'donor')),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  donor_id        INTEGER REFERENCES donors(id) ON DELETE SET NULL,
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS donors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    UNIQUE COLLATE NOCASE,
  phone       TEXT,
  donor_type  TEXT    NOT NULL DEFAULT 'individual'
                      CHECK (donor_type IN ('individual', 'corporate', 'trust', 'anonymous')),
  city        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code            TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  summary         TEXT    NOT NULL DEFAULT '',
  description     TEXT    NOT NULL DEFAULT '',
  category        TEXT    NOT NULL CHECK (category IN
                    ('health', 'education', 'disaster_relief', 'food_security',
                     'water', 'livelihood', 'environment', 'shelter')),
  goal_amount     REAL    NOT NULL CHECK (goal_amount > 0),
  status          TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date      TEXT    NOT NULL,
  end_date        TEXT,
  goal_reached_at TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS donations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no      TEXT    NOT NULL UNIQUE,
  donor_id        INTEGER NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  kind            TEXT    NOT NULL CHECK (kind IN ('monetary', 'material')),
  amount          REAL    NOT NULL DEFAULT 0 CHECK (amount >= 0),
  item_name       TEXT,
  unit            TEXT,
  quantity        REAL    NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  estimated_value REAL    NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  channel         TEXT    NOT NULL DEFAULT 'online'
                          CHECK (channel IN ('online', 'bank_transfer', 'upi',
                                             'cheque', 'cash', 'in_kind')),
  status          TEXT    NOT NULL DEFAULT 'received'
                          CHECK (status IN ('received', 'allocated', 'utilized')),
  donated_at      TEXT    NOT NULL,
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- monetary donations must carry a value, material donations must carry goods
  CHECK (
    (kind = 'monetary' AND amount > 0 AND COALESCE(item_name, '') = '')
    OR
    (kind = 'material' AND item_name IS NOT NULL AND quantity > 0)
  )
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name            TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK (category IN
                    ('family', 'school', 'shelter', 'patient', 'farmers',
                     'students', 'individual', 'community')),
  location        TEXT    NOT NULL,
  household_size  INTEGER NOT NULL DEFAULT 1 CHECK (household_size > 0),
  contact         TEXT,
  verified        INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1)),
  registered_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS allocations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reference       TEXT    NOT NULL UNIQUE,
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  beneficiary_id  INTEGER NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  donation_id     INTEGER REFERENCES donations(id) ON DELETE SET NULL,
  kind            TEXT    NOT NULL CHECK (kind IN ('fund', 'material')),
  amount          REAL    NOT NULL DEFAULT 0 CHECK (amount >= 0),
  item_name       TEXT,
  unit            TEXT,
  quantity        REAL    NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  purpose         TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'allocated'
                          CHECK (status IN ('allocated', 'partially_distributed', 'distributed')),
  allocated_at    TEXT    NOT NULL,
  allocated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (
    (kind = 'fund' AND amount > 0)
    OR
    (kind = 'material' AND item_name IS NOT NULL AND quantity > 0)
  )
);

CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_no   TEXT    NOT NULL UNIQUE,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  allocation_id INTEGER REFERENCES allocations(id) ON DELETE SET NULL,
  category     TEXT    NOT NULL CHECK (category IN
                 ('logistics', 'procurement', 'medical', 'education',
                  'field_operations', 'utilities', 'admin', 'other')),
  description  TEXT    NOT NULL,
  amount       REAL    NOT NULL CHECK (amount > 0),
  vendor       TEXT,
  receipt_ref  TEXT,
  spent_at     TEXT    NOT NULL,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS distributions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reference      TEXT    NOT NULL UNIQUE,
  allocation_id  INTEGER NOT NULL REFERENCES allocations(id) ON DELETE RESTRICT,
  beneficiary_id INTEGER NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  amount         REAL    NOT NULL DEFAULT 0 CHECK (amount >= 0),
  quantity       REAL    NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  evidence_ref   TEXT,
  notes          TEXT    NOT NULL DEFAULT '',
  distributed_at TEXT    NOT NULL,
  distributed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (amount > 0 OR quantity > 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT    NOT NULL DEFAULT 'system',
  actor_role    TEXT    NOT NULL DEFAULT 'system',
  action        TEXT    NOT NULL,
  entity        TEXT    NOT NULL,
  entity_id     INTEGER,
  summary       TEXT    NOT NULL,
  meta          TEXT    NOT NULL DEFAULT '{}',
  ip            TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- -------------------------------------------------------------------- indexes

CREATE INDEX IF NOT EXISTS idx_campaigns_org        ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_donations_campaign   ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor      ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_date       ON donations(donated_at);
CREATE INDEX IF NOT EXISTS idx_allocations_campaign ON allocations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_allocations_benef    ON allocations(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status   ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_expenses_campaign    ON expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date        ON expenses(spent_at);
CREATE INDEX IF NOT EXISTS idx_distribution_alloc   ON distributions(allocation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_org    ON beneficiaries(organization_id);

-- ---------------------------------------------------------------------- views

-- Campaign-level financial picture: raised, allocated, spent, remaining.
CREATE VIEW IF NOT EXISTS v_campaign_finance AS
SELECT
  c.id                AS campaign_id,
  c.organization_id,
  o.name              AS organization_name,
  c.code,
  c.title,
  c.category,
  c.status,
  c.goal_amount,
  c.start_date,
  c.end_date,
  COALESCE((SELECT SUM(d.amount) FROM donations d
             WHERE d.campaign_id = c.id AND d.kind = 'monetary'), 0)          AS raised,
  COALESCE((SELECT SUM(d.estimated_value) FROM donations d
             WHERE d.campaign_id = c.id AND d.kind = 'material'), 0)          AS material_value,
  COALESCE((SELECT COUNT(*) FROM donations d WHERE d.campaign_id = c.id), 0)  AS donation_count,
  COALESCE((SELECT COUNT(DISTINCT d.donor_id) FROM donations d
             WHERE d.campaign_id = c.id), 0)                                  AS donor_count,
  COALESCE((SELECT SUM(a.amount) FROM allocations a
             WHERE a.campaign_id = c.id AND a.kind = 'fund'), 0)              AS allocated,
  COALESCE((SELECT SUM(e.amount) FROM expenses e
             WHERE e.campaign_id = c.id), 0)                                  AS spent,
  COALESCE((SELECT COUNT(*) FROM distributions ds
             JOIN allocations a2 ON a2.id = ds.allocation_id
            WHERE a2.campaign_id = c.id), 0)                                  AS distribution_count,
  COALESCE((SELECT COUNT(*) FROM beneficiaries b
             JOIN allocations a3 ON a3.beneficiary_id = b.id
            WHERE a3.campaign_id = c.id), 0)                                  AS beneficiary_count
FROM campaigns c
JOIN organizations o ON o.id = c.organization_id;

-- Platform-wide transparency counters for the public landing page.
CREATE VIEW IF NOT EXISTS v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM campaigns WHERE status IN ('active', 'completed'))       AS campaigns,
  (SELECT COUNT(*) FROM organizations)                                          AS organizations,
  (SELECT COUNT(*) FROM donors)                                                 AS donors,
  (SELECT COUNT(*) FROM beneficiaries)                                          AS beneficiaries,
  (SELECT COUNT(*) FROM donations)                                              AS donations_count,
  (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE kind = 'monetary')      AS raised,
  (SELECT COALESCE(SUM(estimated_value), 0) FROM donations WHERE kind = 'material') AS material_value,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses)                               AS spent,
  (SELECT COALESCE(SUM(amount), 0) FROM distributions)                          AS distributed_funds,
  (SELECT COUNT(*) FROM distributions)                                          AS distributions,
  (SELECT COUNT(*) FROM audit_logs)                                             AS audit_entries;

CREATE VIEW IF NOT EXISTS v_allocation_detail AS
SELECT
  a.id,
  a.reference,
  a.campaign_id,
  c.organization_id,
  c.title             AS campaign_title,
  c.code              AS campaign_code,
  a.beneficiary_id,
  b.name              AS beneficiary_name,
  b.category          AS beneficiary_category,
  b.location          AS beneficiary_location,
  a.kind,
  a.amount,
  a.item_name,
  a.unit,
  a.quantity,
  a.purpose,
  a.status,
  a.allocated_at,
  COALESCE((SELECT SUM(ds.amount) FROM distributions ds
             WHERE ds.allocation_id = a.id), 0)   AS distributed_amount,
  COALESCE((SELECT SUM(ds.quantity) FROM distributions ds
             WHERE ds.allocation_id = a.id), 0)   AS distributed_quantity,
  (SELECT COUNT(*) FROM distributions ds WHERE ds.allocation_id = a.id) AS distribution_count
FROM allocations a
JOIN campaigns c     ON c.id = a.campaign_id
JOIN beneficiaries b ON b.id = a.beneficiary_id;

CREATE VIEW IF NOT EXISTS v_donor_totals AS
SELECT
  dn.id,
  dn.name,
  dn.donor_type,
  dn.city,
  COUNT(d.id)                                              AS donation_count,
  COALESCE(SUM(CASE WHEN d.kind = 'monetary' THEN d.amount END), 0)      AS monetary_total,
  COALESCE(SUM(CASE WHEN d.kind = 'material' THEN d.estimated_value END), 0) AS material_total,
  MAX(d.donated_at)                                        AS last_donation_at
FROM donors dn
LEFT JOIN donations d ON d.donor_id = dn.id
GROUP BY dn.id, dn.name, dn.donor_type, dn.city;

CREATE VIEW IF NOT EXISTS v_beneficiary_support AS
SELECT
  b.id,
  b.organization_id,
  o.name                AS organization_name,
  b.name,
  b.category,
  b.location,
  b.household_size,
  b.verified,
  (SELECT COUNT(*) FROM allocations a WHERE a.beneficiary_id = b.id) AS allocation_count,
  (SELECT COALESCE(SUM(a.amount), 0) FROM allocations a
    WHERE a.beneficiary_id = b.id AND a.kind = 'fund') AS funds_allocated,
  (SELECT COALESCE(SUM(ds.amount), 0) FROM distributions ds
    WHERE ds.beneficiary_id = b.id) AS funds_received,
  (SELECT COALESCE(SUM(ds.quantity), 0) FROM distributions ds
    WHERE ds.beneficiary_id = b.id) AS items_received,
  (SELECT COUNT(*) FROM distributions ds WHERE ds.beneficiary_id = b.id) AS distributions_received
FROM beneficiaries b
JOIN organizations o ON o.id = b.organization_id;

CREATE VIEW IF NOT EXISTS v_expense_breakdown AS
SELECT
  campaign_id,
  category,
  COUNT(*)            AS entries,
  COALESCE(SUM(amount), 0) AS total
FROM expenses
GROUP BY campaign_id, category;

CREATE VIEW IF NOT EXISTS v_monthly_donations AS
SELECT
  substr(donated_at, 1, 7) AS month,
  SUM(CASE WHEN kind = 'monetary' THEN amount ELSE 0 END) AS monetary,
  SUM(CASE WHEN kind = 'material' THEN estimated_value ELSE 0 END) AS material,
  COUNT(*) AS donations
FROM donations
GROUP BY substr(donated_at, 1, 7)
ORDER BY month;

CREATE VIEW IF NOT EXISTS v_organization_summary AS
SELECT
  o.id,
  o.name,
  o.verified,
  (SELECT COUNT(*) FROM campaigns c WHERE c.organization_id = o.id)      AS campaigns,
  (SELECT COUNT(*) FROM beneficiaries b WHERE b.organization_id = o.id)  AS beneficiaries,
  (SELECT COALESCE(SUM(d.amount), 0) FROM donations d
     JOIN campaigns c2 ON c2.id = d.campaign_id
    WHERE c2.organization_id = o.id AND d.kind = 'monetary')             AS raised,
  (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
     JOIN campaigns c3 ON c3.id = e.campaign_id
    WHERE c3.organization_id = o.id)                                     AS spent,
  (SELECT COALESCE(SUM(d2.estimated_value), 0) FROM donations d2
     JOIN campaigns c4 ON c4.id = d2.campaign_id
    WHERE c4.organization_id = o.id AND d2.kind = 'material')            AS material_value
FROM organizations o;

-- ------------------------------------------------------------------- triggers
-- These enforce the accountability rules at the database layer, so no client,
-- script or manual query can bypass them.

-- 1. Money may only be allocated if the campaign actually received it.
CREATE TRIGGER IF NOT EXISTS trg_alloc_fund_guard
BEFORE INSERT ON allocations
WHEN NEW.kind = 'fund'
BEGIN
  SELECT CASE WHEN
    (SELECT COALESCE(SUM(amount), 0) FROM allocations
      WHERE campaign_id = NEW.campaign_id AND kind = 'fund') + NEW.amount
    >
    (SELECT COALESCE(SUM(amount), 0) FROM donations
      WHERE campaign_id = NEW.campaign_id AND kind = 'monetary')
  THEN RAISE(ABORT, 'ALLOCATION_EXCEEDS_FUNDS') END;
END;

-- 2. Material allocations cannot exceed the donated quantity of that item.
CREATE TRIGGER IF NOT EXISTS trg_alloc_material_guard
BEFORE INSERT ON allocations
WHEN NEW.kind = 'material'
BEGIN
  SELECT CASE WHEN
    (SELECT COALESCE(SUM(quantity), 0) FROM allocations
      WHERE campaign_id = NEW.campaign_id AND kind = 'material'
        AND LOWER(item_name) = LOWER(NEW.item_name)) + NEW.quantity
    >
    (SELECT COALESCE(SUM(quantity), 0) FROM donations
      WHERE campaign_id = NEW.campaign_id AND kind = 'material'
        AND LOWER(item_name) = LOWER(NEW.item_name))
  THEN RAISE(ABORT, 'ALLOCATION_EXCEEDS_ITEMS') END;
END;

-- 3. A campaign can only allocate to beneficiaries of its own organization.
CREATE TRIGGER IF NOT EXISTS trg_alloc_org_guard
BEFORE INSERT ON allocations
BEGIN
  SELECT CASE WHEN
    (SELECT organization_id FROM campaigns WHERE id = NEW.campaign_id)
    <> (SELECT organization_id FROM beneficiaries WHERE id = NEW.beneficiary_id)
  THEN RAISE(ABORT, 'ORGANIZATION_MISMATCH') END;
END;

-- 4. Expenses must be covered by funds already allocated for that campaign.
CREATE TRIGGER IF NOT EXISTS trg_expense_budget_guard
BEFORE INSERT ON expenses
BEGIN
  SELECT CASE WHEN
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE campaign_id = NEW.campaign_id)
      + NEW.amount
    >
    (SELECT COALESCE(SUM(amount), 0) FROM allocations
      WHERE campaign_id = NEW.campaign_id AND kind = 'fund')
  THEN RAISE(ABORT, 'EXPENSE_EXCEEDS_ALLOCATED_FUNDS') END;
END;

-- 5. Distributions can never exceed what was allocated to a beneficiary.
CREATE TRIGGER IF NOT EXISTS trg_distribution_guard
BEFORE INSERT ON distributions
BEGIN
  SELECT CASE WHEN
    (SELECT COALESCE(SUM(amount), 0) FROM distributions
      WHERE allocation_id = NEW.allocation_id) + NEW.amount
    > (SELECT amount FROM allocations WHERE id = NEW.allocation_id) + 0.01
  THEN RAISE(ABORT, 'DISTRIBUTION_EXCEEDS_ALLOCATION') END;

  SELECT CASE WHEN
    (SELECT COALESCE(SUM(quantity), 0) FROM distributions
      WHERE allocation_id = NEW.allocation_id) + NEW.quantity
    > (SELECT quantity FROM allocations WHERE id = NEW.allocation_id)
  THEN RAISE(ABORT, 'DISTRIBUTION_EXCEEDS_ALLOCATION') END;
END;

-- 6. Allocation status follows the distribution ledger automatically.
CREATE TRIGGER IF NOT EXISTS trg_distribution_status
AFTER INSERT ON distributions
BEGIN
  UPDATE allocations
     SET status = CASE
       WHEN kind = 'fund' THEN
         CASE WHEN (SELECT COALESCE(SUM(amount), 0) FROM distributions
                     WHERE allocation_id = NEW.allocation_id) >= amount - 0.005
              THEN 'distributed' ELSE 'partially_distributed' END
       ELSE
         CASE WHEN (SELECT COALESCE(SUM(quantity), 0) FROM distributions
                     WHERE allocation_id = NEW.allocation_id) >= quantity - 0.0005
              THEN 'distributed' ELSE 'partially_distributed' END
     END
   WHERE id = NEW.allocation_id;
END;

-- 7. Only active campaigns may accept donations.
CREATE TRIGGER IF NOT EXISTS trg_donation_campaign_active
BEFORE INSERT ON donations
BEGIN
  SELECT CASE WHEN
    (SELECT status FROM campaigns WHERE id = NEW.campaign_id) <> 'active'
  THEN RAISE(ABORT, 'CAMPAIGN_NOT_ACCEPTING_DONATIONS') END;
END;

-- 8. Donation records are a ledger: financial fields can never be rewritten.
CREATE TRIGGER IF NOT EXISTS trg_donations_immutable_update
BEFORE UPDATE ON donations
WHEN NEW.amount IS NOT OLD.amount
  OR NEW.kind IS NOT OLD.kind
  OR NEW.campaign_id IS NOT OLD.campaign_id
  OR NEW.donor_id IS NOT OLD.donor_id
  OR NEW.quantity IS NOT OLD.quantity
  OR NEW.estimated_value IS NOT OLD.estimated_value
BEGIN
  SELECT RAISE(ABORT, 'DONATION_RECORD_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_donations_immutable_delete
BEFORE DELETE ON donations
BEGIN
  SELECT RAISE(ABORT, 'DONATION_RECORD_IMMUTABLE');
END;

-- 9. Audit log is append-only.
CREATE TRIGGER IF NOT EXISTS trg_audit_immutable_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_immutable_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
END;

-- 10. Stamp the moment a campaign reaches its funding goal.
CREATE TRIGGER IF NOT EXISTS trg_campaign_goal_reached
AFTER INSERT ON donations
WHEN NEW.kind = 'monetary'
BEGIN
  UPDATE campaigns
     SET goal_reached_at = COALESCE(goal_reached_at, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
   WHERE id = NEW.campaign_id
     AND (SELECT COALESCE(SUM(amount), 0) FROM donations
           WHERE campaign_id = NEW.campaign_id AND kind = 'monetary') >= goal_amount;
END;
