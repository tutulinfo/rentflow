-- ============================================================
-- RentFlow - Complete Supabase Database Schema
-- Task 2 | Version 1.0
-- ============================================================
-- Execution order matters. Run top to bottom.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TABLE 1: global_settings
-- Single-row config table for all adjustable global rates.
-- Changes here ONLY affect future billing cycles.
-- Historical bills store their own snapshot of rates.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS global_settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1,  -- enforced single-row
    per_unit_rate       NUMERIC(10, 2) NOT NULL DEFAULT 8.00,  -- BDT per unit (electricity+water)
    waste_fee           NUMERIC(10, 2) NOT NULL DEFAULT 80.00, -- BDT flat waste fee per unit
    currency_symbol     TEXT NOT NULL DEFAULT '৳',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single settings row
INSERT INTO global_settings (id, per_unit_rate, waste_fee)
VALUES (1, 8.00, 80.00)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- TABLE 2: units
-- Physical rental units in the property.
-- A unit can be 'vacant' or 'occupied'.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_name           TEXT NOT NULL,                  -- e.g. "Unit 1", "Room A"
    room_rent           NUMERIC(10, 2) NOT NULL,        -- base monthly rent in BDT
    status              TEXT NOT NULL DEFAULT 'vacant'
                            CHECK (status IN ('occupied', 'vacant', 'inactive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS units_name_unique ON units (LOWER(unit_name));


-- ────────────────────────────────────────────────────────────
-- TABLE 3: renters
-- Individual renter profiles. Linked to a unit when active.
-- unit_id is nullable — a moved-out renter has no active unit
-- but their record (and ledger) is preserved forever.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS renters (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id                     UUID REFERENCES units(id) ON DELETE SET NULL,
    full_name                   TEXT NOT NULL,
    nid_number                  TEXT,                   -- National ID
    phone                       TEXT,
    emergency_contact_name      TEXT,
    emergency_contact_phone     TEXT,
    status                      TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'moved_out')),

    -- Onboarding fields (captured when renter moves in)
    opening_due                 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    opening_electricity_reading NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- Rolling fields (updated each billing cycle by the billing engine)
    current_due                 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    last_electricity_reading    NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    move_in_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    move_out_date               DATE,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active renter per unit at a time
CREATE UNIQUE INDEX IF NOT EXISTS renters_active_unit
    ON renters (unit_id)
    WHERE status = 'active' AND unit_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- TABLE 4: meter_readings
-- One record per billing cycle (month).
-- Stores the raw main water meter reading and is the
-- parent record for all sub-meter readings that cycle.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meter_readings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_month           TEXT NOT NULL,              -- format: 'YYYY-MM', e.g. '2025-06'
    main_water_reading      NUMERIC(12, 2) NOT NULL,    -- total main meter reading (units)
    active_unit_count       INTEGER NOT NULL,           -- snapshot of active units at time of billing
    water_share_per_unit    NUMERIC(12, 4) NOT NULL,    -- computed: main_water / (active_units + 1)
    per_unit_rate_snapshot  NUMERIC(10, 2) NOT NULL,    -- locked rate at time of billing
    waste_fee_snapshot      NUMERIC(10, 2) NOT NULL,    -- locked waste fee at time of billing
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT meter_readings_month_unique UNIQUE (billing_month)
);


-- ────────────────────────────────────────────────────────────
-- TABLE 5: bills
-- One bill per renter per billing cycle.
-- All monetary fields are a complete snapshot — immutable
-- after generation. Historical accuracy is guaranteed.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_reading_id            UUID NOT NULL REFERENCES meter_readings(id) ON DELETE RESTRICT,
    renter_id                   UUID NOT NULL REFERENCES renters(id) ON DELETE RESTRICT,
    unit_id                     UUID REFERENCES units(id) ON DELETE SET NULL,
    billing_month               TEXT NOT NULL,          -- redundant for fast queries: 'YYYY-MM'

    -- Meter snapshots (immutable)
    electricity_reading_prev    NUMERIC(12, 2) NOT NULL,
    electricity_reading_curr    NUMERIC(12, 2) NOT NULL,
    electricity_units_used      NUMERIC(12, 2) NOT NULL, -- curr - prev

    -- Rate snapshots (locked at billing time)
    water_share                 NUMERIC(12, 4) NOT NULL,
    per_unit_rate               NUMERIC(10, 2) NOT NULL,
    waste_fee                   NUMERIC(10, 2) NOT NULL,

    -- Computed bill components
    electricity_bill            NUMERIC(10, 2) NOT NULL,  -- (elec_units + water_share) × rate
    room_rent                   NUMERIC(10, 2) NOT NULL,  -- snapshot of unit room_rent
    previous_due                NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    -- Grand total
    total_bill                  NUMERIC(10, 2) NOT NULL,  -- room_rent + electricity_bill + waste_fee + previous_due

    -- Payment tracking
    amount_paid                 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    outstanding_balance         NUMERIC(10, 2) GENERATED ALWAYS AS (total_bill - amount_paid) STORED,
    payment_status              TEXT NOT NULL DEFAULT 'unpaid'
                                    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),

    -- Snapshot of renter name (for historical print even after renter deletion)
    renter_name_snapshot        TEXT NOT NULL,
    unit_name_snapshot          TEXT NOT NULL,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bills_renter_month_unique UNIQUE (renter_id, billing_month)
);

-- Index for fast monthly bill lookup (used by A4 print view)
CREATE INDEX IF NOT EXISTS bills_month_idx ON bills (billing_month);
-- Index for fast renter ledger lookup
CREATE INDEX IF NOT EXISTS bills_renter_idx ON bills (renter_id);


-- ────────────────────────────────────────────────────────────
-- TABLE 6: payments
-- Individual payment transactions against a bill.
-- Supports partial payments — multiple rows per bill.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    renter_id       UUID NOT NULL REFERENCES renters(id) ON DELETE RESTRICT,
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    note            TEXT,                               -- optional: "Cash", "bKash", etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_bill_idx ON payments (bill_id);
CREATE INDEX IF NOT EXISTS payments_renter_idx ON payments (renter_id);


-- ────────────────────────────────────────────────────────────
-- TABLE 7: ledger_entries
-- Full double-entry style ledger per renter.
-- Every charge (bill) and credit (payment) is a row here.
-- Running balance is computed in the application layer.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    renter_id       UUID NOT NULL REFERENCES renters(id) ON DELETE RESTRICT,
    entry_type      TEXT NOT NULL CHECK (entry_type IN ('charge', 'credit')),
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description     TEXT NOT NULL,                      -- e.g. "Bill for June 2025" / "Payment received"
    reference_id    UUID,                               -- FK to bills.id or payments.id (soft ref)
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    billing_month   TEXT,                               -- 'YYYY-MM', for filtering by cycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_renter_idx ON ledger_entries (renter_id);
CREATE INDEX IF NOT EXISTS ledger_date_idx ON ledger_entries (entry_date DESC);


-- ────────────────────────────────────────────────────────────
-- TABLE 8: income_expenses
-- Owner-level financial ledger.
-- Rent payments auto-post here as 'income'.
-- Owner manually adds expenses (repairs, maintenance, etc.)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type      TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
    category        TEXT NOT NULL DEFAULT 'rent',       -- 'rent', 'repair', 'maintenance', 'utility', 'other'
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description     TEXT NOT NULL,
    reference_id    UUID,                               -- soft FK to payments.id if auto-posted
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    billing_month   TEXT,                               -- 'YYYY-MM'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ie_type_idx ON income_expenses (entry_type);
CREATE INDEX IF NOT EXISTS ie_month_idx ON income_expenses (billing_month);
CREATE INDEX IF NOT EXISTS ie_date_idx ON income_expenses (entry_date DESC);


-- ============================================================
-- TRIGGERS
-- Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER units_updated_at    BEFORE UPDATE ON units    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER renters_updated_at  BEFORE UPDATE ON renters  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bills_updated_at    BEFORE UPDATE ON bills    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON global_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables. In Supabase, add policies per
-- your auth setup. For single-owner app, a simple policy
-- allowing all operations for authenticated users is shown.
-- ============================================================
ALTER TABLE global_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE renters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_expenses   ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users have full access (single-owner app)
-- Replace with uid-scoped policies if multi-owner support is needed later.
CREATE POLICY "auth_full_access" ON global_settings  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON units            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON renters          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON meter_readings   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON bills            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON payments         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON ledger_entries   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON income_expenses  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- USEFUL VIEWS (optional helpers for the frontend)
-- ============================================================

-- Active renters with their unit info
CREATE OR REPLACE VIEW active_renters_view AS
SELECT
    r.id,
    r.full_name,
    r.phone,
    r.current_due,
    r.last_electricity_reading,
    r.status,
    u.id AS unit_id,
    u.unit_name,
    u.room_rent
FROM renters r
LEFT JOIN units u ON r.unit_id = u.id
WHERE r.status = 'active';

-- Monthly dashboard summary
CREATE OR REPLACE VIEW monthly_summary_view AS
SELECT
    b.billing_month,
    COUNT(b.id)                             AS total_bills,
    SUM(b.total_bill)                       AS total_expected,
    SUM(b.amount_paid)                      AS total_collected,
    SUM(b.outstanding_balance)              AS total_outstanding,
    COUNT(CASE WHEN b.payment_status = 'paid'    THEN 1 END) AS fully_paid_count,
    COUNT(CASE WHEN b.payment_status = 'partial' THEN 1 END) AS partial_count,
    COUNT(CASE WHEN b.payment_status = 'unpaid'  THEN 1 END) AS unpaid_count
FROM bills b
GROUP BY b.billing_month
ORDER BY b.billing_month DESC;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
