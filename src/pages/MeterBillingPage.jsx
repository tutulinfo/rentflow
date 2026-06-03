/**
 * RentFlow – Task 4: Meter Entry Form & Billing Engine
 *
 * MATHEMATICAL ENGINE (strictly from PRD):
 *   Water Share       = Main Water Reading ÷ (Active Units + 1)
 *   Electricity Units = Current Reading − Previous Reading
 *   Electricity Bill  = (Electricity Units + Water Share) × Per Unit Rate
 *   Total Bill        = Room Rent + Electricity Bill + Waste Fee + Previous Due
 *
 * TRIGGER: Saving the form:
 *   1. Inserts one `meter_readings` row (locks rates as snapshot)
 *   2. Inserts one `bills` row per active renter
 *   3. Inserts one `ledger_entries` (charge) row per renter
 *   4. Updates renter.current_due  → total_bill
 *   5. Updates renter.last_electricity_reading → current sub-meter reading
 *   6. Unit is now locked for this billing_month (UNIQUE constraint)
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  primary:      "#1a6b4a",
  primaryDark:  "#0f4a33",
  primaryLight: "#e8f5ee",
  primaryMid:   "#2d9e6e",
  accent:       "#f0a500",
  accentLight:  "#fff8e6",
  surface:      "#f7f9f7",
  card:         "#ffffff",
  border:       "rgba(26,107,74,0.13)",
  borderMid:    "rgba(26,107,74,0.25)",
  text:         "#1a2e22",
  textMuted:    "#5a7a6a",
  danger:       "#c0392b",
  dangerLight:  "#fdf0ee",
  warning:      "#e67e22",
  warningLight: "#fef5ec",
  info:         "#2980b9",
  infoLight:    "#eaf4fb",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtBDT    = (n) => `৳ ${Number(n || 0).toFixed(2)}`;
const thisMonth = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'
const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(y, m - 1).toLocaleString("en-BD", { month: "long", year: "numeric" });
};
const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
const avatarColor = (name = "") => {
  const pool = [C.primary, "#2e86ab", "#e67e22", "#8e44ad", "#16a085", "#c0392b"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % pool.length;
  return pool[h];
};

// ─── THE MATH ENGINE (pure functions — zero side effects) ──────────────────
const engine = {
  /**
   * waterShare = mainWaterReading / (activeUnits + 1)
   * +1 accounts for the homeowner's share
   */
  waterShare(mainReading, activeCount) {
    if (!activeCount || activeCount <= 0) return 0;
    return mainReading / (activeCount + 1);
  },

  /**
   * electricityUnits = currentReading - previousReading
   */
  electricityUnits(current, previous) {
    const units = current - previous;
    return units < 0 ? 0 : units; // Guard: never negative
  },

  /**
   * electricityBill = (electricityUnits + waterShare) × perUnitRate
   */
  electricityBill(elecUnits, waterShare, perUnitRate) {
    return (elecUnits + waterShare) * perUnitRate;
  },

  /**
   * totalBill = roomRent + electricityBill + wasteFee + previousDue
   */
  totalBill(roomRent, elecBill, wasteFee, previousDue) {
    return roomRent + elecBill + wasteFee + previousDue;
  },

  /** Compute everything for one renter given shared context */
  computeForRenter({ renter, currentReading, mainReading, activeCount, perUnitRate, wasteFee }) {
    const wShare  = engine.waterShare(mainReading, activeCount);
    const eUnits  = engine.electricityUnits(currentReading, renter.last_electricity_reading);
    const eBill   = engine.electricityBill(eUnits, wShare, perUnitRate);
    const total   = engine.totalBill(renter.room_rent, eBill, wasteFee, renter.current_due);
    return {
      water_share:             parseFloat(wShare.toFixed(4)),
      electricity_units_used:  parseFloat(eUnits.toFixed(2)),
      electricity_bill:        parseFloat(eBill.toFixed(2)),
      total_bill:              parseFloat(total.toFixed(2)),
      previous_due:            parseFloat((renter.current_due || 0).toFixed(2)),
      room_rent:               parseFloat((renter.room_rent  || 0).toFixed(2)),
      waste_fee:               parseFloat((wasteFee).toFixed(2)),
    };
  },
};

// ─── Shared UI atoms ───────────────────────────────────────────────────────
function InfoBox({ type = "info", children }) {
  const map = {
    info:    { bg: C.infoLight,   border: C.info,    color: C.info    },
    warning: { bg: C.warningLight,border: C.warning, color: C.warning },
    success: { bg: C.primaryLight,border: C.primary, color: C.primary },
    danger:  { bg: C.dangerLight, border: C.danger,  color: C.danger  },
  };
  const s = map[type];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
      <p style={{ fontSize: 13, color: s.color, fontWeight: 600, margin: 0, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

function Label({ children, required }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, letterSpacing: "0.07em", textTransform: "uppercase" }}>
      {children}{required && <span style={{ color: C.danger }}> *</span>}
    </label>
  );
}

function NumInput({ label, value, onChange, placeholder, required, suffix, readOnly }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Label required={required}>{label}</Label>}
      <div style={{ position: "relative" }}>
        <input
          type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={placeholder} readOnly={readOnly}
          style={{
            width: "100%", padding: suffix ? "13px 52px 13px 14px" : "13px 14px",
            borderRadius: 12, border: `1.5px solid ${readOnly ? "transparent" : C.border}`,
            background: readOnly ? C.primaryLight : "#fff",
            fontSize: 16, color: C.text, fontFamily: "'DM Sans', sans-serif",
            outline: "none", boxSizing: "border-box", fontWeight: readOnly ? 700 : 400,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => { if (!readOnly) e.target.style.borderColor = C.primaryMid; }}
          onBlur={(e)  => { if (!readOnly) e.target.style.borderColor = C.border; }}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textMuted, fontWeight: 700, pointerEvents: "none" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHead({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.textMuted }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "18px 0" }} />;
}

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: type === "success" ? C.primary : C.danger, color: "#fff",
      padding: "12px 24px", borderRadius: 50, fontSize: 14, fontWeight: 600,
      zIndex: 2000, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "fadeUp 0.25s ease",
    }}>
      {type === "success" ? "✓ " : "✗ "}{message}
    </div>
  );
}

// ─── BILL PREVIEW CARD (per renter) ───────────────────────────────────────
function BillPreviewCard({ renter, calc, currentReading }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: C.card, borderRadius: 16, border: `0.5px solid ${C.border}`,
      marginBottom: 10, overflow: "hidden",
    }}>
      {/* Header row */}
      <div
        style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        onClick={() => setOpen((p) => !p)}
      >
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: avatarColor(renter.full_name),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>{initials(renter.full_name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{renter.full_name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{renter.unit_name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>{fmtBDT(calc.total_bill)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Total Bill</div>
        </div>
        <span style={{ fontSize: 14, color: C.textMuted, marginLeft: 4, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </div>

      {/* Breakdown */}
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ paddingTop: 12 }}>
            {[
              ["🏠 Room Rent",            fmtBDT(calc.room_rent)],
              ["⚡ Elec. Units Used",      `${calc.electricity_units_used.toFixed(2)} units`],
              ["💧 Water Share",           `${calc.water_share.toFixed(4)} units`],
              ["🔢 Electricity Bill",      fmtBDT(calc.electricity_bill)],
              ["🗑 Waste Fee",             fmtBDT(calc.waste_fee)],
              ["📋 Previous Due",          fmtBDT(calc.previous_due)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px dashed ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Grand Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>{fmtBDT(calc.total_bill)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ALREADY BILLED SCREEN ─────────────────────────────────────────────────
function AlreadyBilled({ billingMonth, bills, onReset, onPrint, onEdit }) {
  return (
    <div style={{ padding: "16px" }}>
      <InfoBox type="success">
        ✅ Bills for <strong>{monthLabel(billingMonth)}</strong> have already been generated.
      </InfoBox>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Generated Bills</div>
        {bills.map((b) => (
          <div key={b.id} style={{ background: C.card, borderRadius: 14, padding: "13px 14px", marginBottom: 8, border: `0.5px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.renter_name_snapshot}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{b.unit_name_snapshot}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{fmtBDT(b.total_bill)}</div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: b.payment_status === "paid" ? C.primaryLight : b.payment_status === "partial" ? C.accentLight : C.dangerLight,
                color: b.payment_status === "paid" ? C.primary : b.payment_status === "partial" ? C.accent : C.danger,
              }}>{b.payment_status}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <button onClick={onPrint} style={{ padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>🖨️ Print Bills</button>
        <button onClick={onEdit} style={{ padding: "14px", background: "transparent", color: C.primary, border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>✏️ Edit Bills</button>
      </div>
      <button onClick={onReset} style={{
        width: "100%", padding: "14px", background: "transparent",
        border: `1.5px solid ${C.borderMid}`, borderRadius: 14,
        fontSize: 14, fontWeight: 700, color: C.primary, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center"
      }}>← View Different Month</button>
    </div>
  );
}

// ─── MAIN BILLING PAGE ─────────────────────────────────────────────────────
export default function MeterBillingPage({ onPrint }) {
  const [step, setStep]           = useState("month");   // month → entry → preview → done
  const [billingMonth, setBillingMonth] = useState(thisMonth());
  const [settings, setSettings]   = useState(null);
  const [renters, setRenters]     = useState([]);        // active renters with unit info
  const [mainWater, setMainWater] = useState("");
  const [subReadings, setSubReadings] = useState({});    // { renterId: string }
  const [calcs, setCalcs]         = useState({});        // { renterId: computed }
  const [existingBills, setExistingBills] = useState(null); // null=unchecked, []=none, [...]= found
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  // Load global settings and active renters
  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from("global_settings").select("*").eq("id", 1).single(),
        supabase
          .from("renters")
          .select("id, full_name, current_due, last_electricity_reading, unit_id, units(unit_name, room_rent)")
          .eq("status", "active"),
      ]);
      setSettings(s);
      // Flatten unit info into renter object
      setRenters(
        (r || []).map((rr) => ({
          ...rr,
          unit_name: rr.units?.unit_name || "—",
          room_rent: rr.units?.room_rent || 0,
        }))
      );
    })();
  }, []);

  // Check if this month is already billed
  const checkMonth = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("meter_readings")
      .select("id")
      .eq("billing_month", billingMonth)
      .maybeSingle();

    if (data) {
      // Already billed — load the existing bills to show
      const { data: bills } = await supabase
        .from("bills")
        .select("id, renter_name_snapshot, unit_name_snapshot, total_bill, payment_status")
        .eq("billing_month", billingMonth);
      setExistingBills(bills || []);
    } else {
      setExistingBills([]);
      setStep("entry");
    }
    setLoading(false);
  };

  // Recompute all calcs whenever mainWater or any subReading changes
  const recompute = useCallback(() => {
    if (!settings || !renters.length) return;
    const main   = parseFloat(mainWater) || 0;
    const count  = renters.length;
    const newCalcs = {};
    renters.forEach((r) => {
      const curr = parseFloat(subReadings[r.id]) || 0;
      newCalcs[r.id] = engine.computeForRenter({
        renter:        r,
        currentReading: curr,
        mainReading:   main,
        activeCount:   count,
        perUnitRate:   settings.per_unit_rate,
        wasteFee:      settings.waste_fee,
      });
    });
    setCalcs(newCalcs);
  }, [mainWater, subReadings, settings, renters]);

  useEffect(() => { recompute(); }, [recompute]);

  const setSubReading = (renterId, val) =>
    setSubReadings((prev) => ({ ...prev, [renterId]: val }));

  // Validation before preview
  const canPreview = () => {
    if (!mainWater || parseFloat(mainWater) <= 0) return false;
    return renters.every((r) => subReadings[r.id] !== undefined && subReadings[r.id] !== "");
  };

  // SAVE: run the full billing engine commit to Supabase
  const saveBills = async () => {
    setSaving(true);
    const main        = parseFloat(mainWater);
    const activeCount = renters.length;
    const wShare      = engine.waterShare(main, activeCount);

    try {
      // 1. Insert meter_reading row (locks rates)
      const { data: mr, error: mrErr } = await supabase
        .from("meter_readings")
        .insert({
          billing_month:          billingMonth,
          main_water_reading:     main,
          active_unit_count:      activeCount,
          water_share_per_unit:   parseFloat(wShare.toFixed(4)),
          per_unit_rate_snapshot: settings.per_unit_rate,
          waste_fee_snapshot:     settings.waste_fee,
        })
        .select()
        .single();
      if (mrErr) throw new Error(mrErr.message);

      // 2. For each renter: insert bill + ledger entry + update renter rolling fields
      for (const renter of renters) {
        const curr = parseFloat(subReadings[renter.id]) || 0;
        const c    = calcs[renter.id];

        // Insert bill
        const { error: bErr } = await supabase.from("bills").insert({
          meter_reading_id:          mr.id,
          renter_id:                 renter.id,
          unit_id:                   renter.unit_id,
          billing_month:             billingMonth,
          electricity_reading_prev:  renter.last_electricity_reading,
          electricity_reading_curr:  curr,
          electricity_units_used:    c.electricity_units_used,
          water_share:               c.water_share,
          per_unit_rate:             settings.per_unit_rate,
          waste_fee:                 c.waste_fee,
          electricity_bill:          c.electricity_bill,
          room_rent:                 c.room_rent,
          previous_due:              c.previous_due,
          total_bill:                c.total_bill,
          amount_paid:               0,
          payment_status:            "unpaid",
          renter_name_snapshot:      renter.full_name,
          unit_name_snapshot:        renter.unit_name,
        });
        if (bErr) throw new Error(bErr.message);

        // Insert ledger charge entry
        await supabase.from("ledger_entries").insert({
          renter_id:    renter.id,
          entry_type:   "charge",
          amount:       c.total_bill,
          description:  `Bill generated for ${monthLabel(billingMonth)}`,
          entry_date:   new Date().toISOString().slice(0, 10),
          billing_month: billingMonth,
        });

        // Update renter rolling fields
        await supabase.from("renters").update({
          current_due:              c.total_bill,
          last_electricity_reading: curr,
        }).eq("id", renter.id);
      }

      setSaving(false);
      setStep("done");
      showToast(`${renters.length} bills generated for ${monthLabel(billingMonth)}!`);
    } catch (err) {
      setSaving(false);
      showToast(err.message, "error");
    }
  };

  // ── Month selector screen ────────────────────────────────────────────────
  if (step === "month" && existingBills === null) {
    return (
      <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translate(-50%,10px) } to { opacity:1; transform:translate(-50%,0) } }`}</style>
        <SectionHead icon="📅" title="Select Billing Month" subtitle="Choose the month to bill for" />
        <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `0.5px solid ${C.border}` }}>
          <Label required>Billing Month</Label>
          <input
            type="month" value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 16, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>
            Active renters: <strong style={{ color: C.text }}>{renters.length}</strong> &nbsp;|&nbsp;
            Rate: <strong style={{ color: C.text }}>৳{settings?.per_unit_rate}/unit</strong> &nbsp;|&nbsp;
            Waste: <strong style={{ color: C.text }}>৳{settings?.waste_fee}</strong>
          </div>
        </div>

        {renters.length === 0 && (
          <InfoBox type="warning" style={{ marginTop: 14 }}>
            ⚠ No active renters found. Please onboard renters before generating bills.
          </InfoBox>
        )}

        <button
          onClick={checkMonth}
          disabled={loading || renters.length === 0}
          style={{
            width: "100%", marginTop: 16, padding: "15px", background: C.primary, color: "#fff",
            border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer",
            opacity: (loading || renters.length === 0) ? 0.55 : 1, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {loading ? "Checking…" : `Continue → Enter Meter Readings`}
        </button>
        <Toast message={toast.msg} type={toast.type} />
      </div>
    );
  }

  // Already billed screen
  if (existingBills && existingBills.length > 0) {
    return <AlreadyBilled
      billingMonth={billingMonth}
      bills={existingBills}
      onReset={() => { setExistingBills(null); setStep("month"); }}
      onPrint={onPrint}
      onEdit={() => { setExistingBills([]); setStep("month"); }}
    />;
  }

  // ── Meter entry screen ───────────────────────────────────────────────────
  if (step === "entry") {
    return (
      <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translate(-50%,10px) } to { opacity:1; transform:translate(-50%,0) } }`}</style>

        {/* Month badge */}
        <div style={{ background: C.primaryLight, borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>📅 {monthLabel(billingMonth)}</span>
          <button onClick={() => { setStep("month"); setExistingBills(null); }} style={{ background: "none", border: "none", fontSize: 12, color: C.primaryMid, cursor: "pointer", fontWeight: 600 }}>Change ↩</button>
        </div>

        {/* MAIN WATER METER */}
        <SectionHead icon="💧" title="Main Water Meter" subtitle="Enter the main building meter reading" />
        <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `0.5px solid ${C.border}`, marginBottom: 4 }}>
          <NumInput
            label="Main Water Reading" required
            value={mainWater} onChange={setMainWater}
            placeholder="e.g. 1245.50" suffix="units"
          />
          {mainWater && parseFloat(mainWater) > 0 && (
            <div style={{ background: C.infoLight, borderRadius: 10, padding: "10px 13px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.info }}>
                💧 Water share per unit: <strong>{engine.waterShare(parseFloat(mainWater), renters.length).toFixed(4)} units</strong>
                <span style={{ fontWeight: 400 }}> ({mainWater} ÷ {renters.length + 1} units)</span>
              </span>
            </div>
          )}
        </div>

        <Divider />

        {/* SUB-METERS — one per renter */}
        <SectionHead icon="⚡" title="Sub-Meter Readings" subtitle="Enter current reading from each unit's meter" />

        {renters.map((renter) => {
          const curr = parseFloat(subReadings[renter.id]) || 0;
          const prev = renter.last_electricity_reading;
          const used = curr > prev ? (curr - prev).toFixed(2) : null;
          const invalid = curr > 0 && curr < prev;

          return (
            <div key={renter.id} style={{ background: C.card, borderRadius: 16, border: `0.5px solid ${invalid ? C.danger : C.border}`, marginBottom: 10, overflow: "hidden" }}>
              {/* Renter header */}
              <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(renter.full_name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {initials(renter.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{renter.full_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{renter.unit_name} · Prev: <strong>{prev}</strong> units</div>
                </div>
                {used && <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, background: C.primaryLight, padding: "3px 9px", borderRadius: 20 }}>+{used}</span>}
              </div>

              {/* Reading input */}
              <div style={{ padding: "0 14px 14px" }}>
                <NumInput
                  value={subReadings[renter.id] || ""}
                  onChange={(v) => setSubReading(renter.id, v)}
                  placeholder={`Current reading (prev: ${prev})`}
                  suffix="units"
                />
                {invalid && (
                  <p style={{ fontSize: 12, color: C.danger, margin: "-8px 0 0", fontWeight: 600 }}>
                    ⚠ Current reading cannot be less than previous ({prev} units)
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Preview button */}
        <button
          onClick={() => setStep("preview")}
          disabled={!canPreview()}
          style={{
            width: "100%", padding: "15px", background: canPreview() ? C.primary : "#ccc",
            color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
            cursor: canPreview() ? "pointer" : "not-allowed", marginTop: 8, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Preview Bills →
        </button>
        <Toast message={toast.msg} type={toast.type} />
      </div>
    );
  }

  // ── Preview screen ───────────────────────────────────────────────────────
  if (step === "preview") {
    const grandTotal = renters.reduce((sum, r) => sum + (calcs[r.id]?.total_bill || 0), 0);
    return (
      <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translate(-50%,10px) } to { opacity:1; transform:translate(-50%,0) } }`}</style>

        <SectionHead icon="🧾" title="Bill Preview" subtitle={`Review before generating — ${monthLabel(billingMonth)}`} />

        {/* Summary bar */}
        <div style={{ background: C.primary, borderRadius: 16, padding: "16px", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            ["Renters", renters.length],
            ["Water Share", `${engine.waterShare(parseFloat(mainWater), renters.length).toFixed(2)} u`],
            ["Total Expected", fmtBDT(grandTotal)],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>

        <InfoBox type="warning">
          ⚠ Once confirmed, bills are locked for {monthLabel(billingMonth)}. Rates and readings cannot be changed for this cycle.
        </InfoBox>

        {/* Per-renter preview cards */}
        {renters.map((r) => (
          <BillPreviewCard
            key={r.id}
            renter={r}
            calc={calcs[r.id] || {}}
            currentReading={parseFloat(subReadings[r.id]) || 0}
          />
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={() => setStep("entry")}
            style={{ flex: 1, padding: "14px", background: "transparent", border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 14, fontWeight: 700, color: C.primary, cursor: "pointer" }}
          >← Edit</button>
          <button
            onClick={saveBills}
            disabled={saving}
            style={{ flex: 2, padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Generating…" : `✓ Confirm & Generate Bills`}
          </button>
        </div>
        <Toast message={toast.msg} type={toast.type} />
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === "done") {
    const grandTotal = renters.reduce((sum, r) => sum + (calcs[r.id]?.total_bill || 0), 0);
    return (
      <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
        <style>{`@keyframes pop { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }`}</style>
        <div style={{ animation: "pop 0.4s ease", fontSize: 64, marginBottom: 16, marginTop: 32 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 8 }}>Bills Generated!</h2>
        <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>
          {renters.length} bills for <strong>{monthLabel(billingMonth)}</strong> are now active.
        </p>
        <div style={{ background: C.primaryLight, borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{fmtBDT(grandTotal)}</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Total expected this cycle</div>
        </div>
        {renters.map((r) => (
          <div key={r.id} style={{ background: C.card, borderRadius: 14, padding: "13px 14px", marginBottom: 8, border: `0.5px solid ${C.border}`, display: "flex", justifyContent: "space-between", textAlign: "left" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.full_name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{r.unit_name}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{fmtBDT(calcs[r.id]?.total_bill)}</div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <button onClick={onPrint} style={{ padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>🖨️ Print Bills</button>
          <button onClick={() => { setStep("month"); setExistingBills([]); setMainWater(""); setSubReadings({}); }} style={{ padding: "14px", background: "transparent", color: C.primary, border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>✏️ Edit Bills</button>
        </div>
        <button
          onClick={() => { setStep("month"); setExistingBills(null); setMainWater(""); setSubReadings({}); }}
          style={{ width: "100%", marginTop: 16, padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >← Back to Billing</button>
      </div>
    );
  }

  return null;
}
