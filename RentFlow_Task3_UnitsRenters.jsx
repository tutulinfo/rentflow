/**
 * RentFlow – Task 3: Units & Renters Management
 * Full lifecycle: Add Unit · Onboard Renter · Move-Out · Unit Transfer
 * Supabase-wired, mobile-first, production-ready.
 *
 * Dependencies: @supabase/supabase-js (already in project)
 * Drop-in replacement for the Task 1 placeholder on the "units" tab.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client (replace with your project URL & anon key) ───────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  dangerBorder: "rgba(192,57,43,0.2)",
  warning:      "#e67e22",
  warningLight: "#fef5ec",
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

const avatarColor = (name = "") => {
  const colors = [C.primary, "#2e86ab", "#e67e22", "#8e44ad", "#16a085", "#c0392b"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
};

const fmtBDT = (n) => `৳ ${Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

// ─── Shared UI components ─────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    occupied: { bg: C.primaryLight, color: C.primary,  label: "Occupied" },
    vacant:   { bg: "#fff8e6",      color: C.warning,  label: "Vacant"   },
    inactive: { bg: "#f0f0f0",      color: "#666",     label: "Inactive" },
    active:   { bg: C.primaryLight, color: C.primary,  label: "Active"   },
    moved_out:{ bg: C.dangerLight,  color: C.danger,   label: "Moved Out"},
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
      background: s.bg, color: s.color, letterSpacing: "0.03em",
    }}>{s.label}</span>
  );
}

function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: avatarColor(name), display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff",
    }}>{initials(name) || "?"}</div>
  );
}

function Btn({ children, variant = "primary", onClick, disabled, style = {}, small }) {
  const base = {
    border: "none", borderRadius: small ? 10 : 14, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
    fontSize: small ? 12 : 14, padding: small ? "8px 14px" : "14px 22px",
    opacity: disabled ? 0.55 : 1, transition: "all 0.15s", display: "inline-flex",
    alignItems: "center", gap: 6,
  };
  const variants = {
    primary:  { background: C.primary,    color: "#fff" },
    danger:   { background: C.danger,     color: "#fff" },
    ghost:    { background: "transparent", color: C.primary, border: `1.5px solid ${C.borderMid}` },
    warning:  { background: C.warning,    color: "#fff" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required, prefix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.textMuted, fontWeight: 600, pointerEvents: "none" }}>
            {prefix}
          </span>
        )}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", padding: prefix ? "13px 14px 13px 28px" : "13px 14px",
            borderRadius: 12, border: `1.5px solid ${C.border}`, background: "#fff",
            fontSize: 15, color: C.text, fontFamily: "'DM Sans', sans-serif",
            outline: "none", boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.primaryMid)}
          onBlur={(e)  => (e.target.style.borderColor = C.border)}
        />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, danger }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480, maxHeight: "90vh",
        overflowY: "auto", padding: "24px 20px 40px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: danger ? C.danger : C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textMuted, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
      background: type === "success" ? C.primary : C.danger,
      color: "#fff", padding: "12px 22px", borderRadius: 50,
      fontSize: 14, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "slideUp 0.25s ease",
    }}>
      {type === "success" ? "✓ " : "✗ "}{message}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// ─── ADD / EDIT UNIT MODAL ────────────────────────────────────────────────────
function UnitModal({ unit, onClose, onSaved }) {
  const editing = !!unit;
  const [name, setName]     = useState(unit?.unit_name || "");
  const [rent, setRent]     = useState(unit?.room_rent || "");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const save = async () => {
    if (!name.trim() || !rent) { setError("Unit name and rent are required."); return; }
    setLoading(true); setError("");
    const payload = { unit_name: name.trim(), room_rent: parseFloat(rent) };
    let result;
    if (editing) {
      result = await supabase.from("units").update(payload).eq("id", unit.id);
    } else {
      result = await supabase.from("units").insert({ ...payload, status: "vacant" });
    }
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    onSaved(editing ? "Unit updated." : "Unit added.");
  };

  return (
    <Modal title={editing ? "Edit Unit" : "Add New Unit"} onClose={onClose}>
      <Input label="Unit Name" value={name} onChange={setName} placeholder="e.g. Unit 1, Room A" required />
      <Input label="Monthly Rent (BDT)" value={rent} onChange={setRent} type="number" placeholder="e.g. 5000" prefix="৳" required />
      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Saving…" : editing ? "Save Changes" : "Add Unit"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── ONBOARD RENTER MODAL ─────────────────────────────────────────────────────
function OnboardRenterModal({ unit, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: "", nid_number: "", phone: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    opening_due: "0", opening_electricity_reading: "0",
    move_in_date: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.full_name.trim()) { setError("Renter name is required."); return; }
    setLoading(true); setError("");
    const { error: rErr } = await supabase.from("renters").insert({
      unit_id:                    unit.id,
      full_name:                  form.full_name.trim(),
      nid_number:                 form.nid_number.trim() || null,
      phone:                      form.phone.trim() || null,
      emergency_contact_name:     form.emergency_contact_name.trim() || null,
      emergency_contact_phone:    form.emergency_contact_phone.trim() || null,
      opening_due:                parseFloat(form.opening_due) || 0,
      opening_electricity_reading:parseFloat(form.opening_electricity_reading) || 0,
      current_due:                parseFloat(form.opening_due) || 0,
      last_electricity_reading:   parseFloat(form.opening_electricity_reading) || 0,
      move_in_date:               form.move_in_date,
      status:                     "active",
    });
    if (rErr) { setLoading(false); setError(rErr.message); return; }
    await supabase.from("units").update({ status: "occupied" }).eq("id", unit.id);
    setLoading(false);
    onSaved("Renter onboarded successfully.");
  };

  return (
    <Modal title={`Onboard Renter → ${unit.unit_name}`} onClose={onClose}>
      <SectionDivider label="Personal Info" />
      <Input label="Full Name"   value={form.full_name}   onChange={set("full_name")}   placeholder="Renter's full name" required />
      <Input label="NID Number"  value={form.nid_number}  onChange={set("nid_number")}  placeholder="National ID number" />
      <Input label="Phone"       value={form.phone}        onChange={set("phone")}        placeholder="01XXXXXXXXX" type="tel" />

      <SectionDivider label="Emergency Contact" />
      <Input label="Contact Name"  value={form.emergency_contact_name}  onChange={set("emergency_contact_name")}  placeholder="Name" />
      <Input label="Contact Phone" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} placeholder="01XXXXXXXXX" type="tel" />

      <SectionDivider label="Opening Readings" />
      <Input label="Opening Due (BDT)"               value={form.opening_due}                onChange={set("opening_due")}                type="number" prefix="৳" placeholder="0.00" />
      <Input label="Opening Electricity Reading"     value={form.opening_electricity_reading} onChange={set("opening_electricity_reading")} type="number" placeholder="e.g. 1245.50" />
      <Input label="Move-In Date"                    value={form.move_in_date}               onChange={set("move_in_date")}               type="date" />

      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Saving…" : "Onboard Renter"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── MOVE-OUT MODAL ───────────────────────────────────────────────────────────
function MoveOutModal({ renter, unit, onClose, onSaved }) {
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const confirm = async () => {
    setLoading(true); setError("");
    const { error: rErr } = await supabase.from("renters").update({
      status: "moved_out", move_out_date: date, unit_id: null,
    }).eq("id", renter.id);
    if (rErr) { setLoading(false); setError(rErr.message); return; }
    await supabase.from("units").update({ status: "vacant" }).eq("id", unit.id);
    setLoading(false);
    onSaved(`${renter.full_name} moved out. Ledger preserved.`);
  };

  return (
    <Modal title="Process Move-Out" onClose={onClose} danger>
      <div style={{ background: C.dangerLight, border: `1px solid ${C.dangerBorder}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: C.danger, fontWeight: 600, margin: 0 }}>
          ⚠ This will vacate {unit.unit_name}. {renter.full_name}'s historical ledger and any outstanding balance (
          {fmtBDT(renter.current_due)}) will be preserved.
        </p>
      </div>
      <Input label="Move-Out Date" value={date} onChange={setDate} type="date" />
      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="danger" onClick={confirm} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Processing…" : "Confirm Move-Out"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── UNIT TRANSFER MODAL ──────────────────────────────────────────────────────
function TransferModal({ renter, currentUnit, vacantUnits, onClose, onSaved }) {
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const confirm = async () => {
    if (!targetId) { setError("Please select a destination unit."); return; }
    setLoading(true); setError("");
    const target = vacantUnits.find((u) => u.id === targetId);
    const { error: rErr } = await supabase.from("renters").update({ unit_id: targetId }).eq("id", renter.id);
    if (rErr) { setLoading(false); setError(rErr.message); return; }
    await supabase.from("units").update({ status: "vacant"   }).eq("id", currentUnit.id);
    await supabase.from("units").update({ status: "occupied" }).eq("id", targetId);
    setLoading(false);
    onSaved(`${renter.full_name} transferred to ${target.unit_name}.`);
  };

  return (
    <Modal title="Transfer to Another Unit" onClose={onClose}>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
        Renter's balance ({fmtBDT(renter.current_due)}) and full profile will carry over to the new unit.
      </p>
      <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Destination Unit <span style={{ color: C.danger }}>*</span>
      </label>
      <select
        value={targetId} onChange={(e) => setTargetId(e.target.value)}
        style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, background: "#fff", marginBottom: 16, boxSizing: "border-box" }}
      >
        <option value="">— Select vacant unit —</option>
        {vacantUnits.map((u) => (
          <option key={u.id} value={u.id}>{u.unit_name} (৳ {u.room_rent}/mo)</option>
        ))}
      </select>
      {vacantUnits.length === 0 && <p style={{ color: C.warning, fontSize: 13, marginBottom: 12 }}>No vacant units available for transfer.</p>}
      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="warning" onClick={confirm} disabled={loading || !vacantUnits.length} style={{ flex: 1 }}>
          {loading ? "Transferring…" : "Transfer"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── RENTER DETAIL PANEL ──────────────────────────────────────────────────────
function RenterDetail({ renter, unit, vacantUnits, onMoveOut, onTransfer }) {
  return (
    <div style={{ background: C.primaryLight, borderRadius: 14, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar name={renter.full_name} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{renter.full_name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{renter.phone || "No phone"}</div>
        </div>
        <StatusBadge status={renter.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          ["NID",          renter.nid_number || "—"],
          ["Current Due",  fmtBDT(renter.current_due)],
          ["Last Elec. Reading", `${renter.last_electricity_reading} units`],
          ["Move-In Date", renter.move_in_date],
          ["Emergency",    renter.emergency_contact_name || "—"],
          ["Emg. Phone",   renter.emergency_contact_phone || "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</div>
          </div>
        ))}
      </div>

      {renter.status === "active" && (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="warning" onClick={onTransfer} style={{ flex: 1 }}>
            ↔ Transfer
          </Btn>
          <Btn small variant="danger" onClick={onMoveOut} style={{ flex: 1 }}>
            ✕ Move Out
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── UNIT CARD ────────────────────────────────────────────────────────────────
function UnitCard({ unit, renter, vacantUnits, onEdit, onOnboard, onMoveOut, onTransfer }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}`,
      marginBottom: 12, overflow: "hidden",
      boxShadow: expanded ? `0 4px 24px rgba(26,107,74,0.10)` : "none",
      transition: "box-shadow 0.2s",
    }}>
      {/* Card header */}
      <div
        style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: unit.status === "occupied" ? C.primaryLight : "#f5f5f5",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          {unit.status === "occupied" ? "🏠" : "🔓"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{unit.unit_name}</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            {fmtBDT(unit.room_rent)}/mo
            {renter && <span style={{ marginLeft: 8, color: C.text, fontWeight: 600 }}>· {renter.full_name}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={unit.status} />
          <span style={{ color: C.textMuted, fontSize: 16, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          {renter && (
            <RenterDetail
              renter={renter} unit={unit} vacantUnits={vacantUnits}
              onMoveOut={() => onMoveOut(renter, unit)}
              onTransfer={() => onTransfer(renter, unit)}
            />
          )}
          {unit.status === "vacant" && (
            <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>This unit is vacant.</p>
              <Btn onClick={() => onOnboard(unit)} style={{ width: "100%" }}>+ Onboard Renter</Btn>
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <Btn small variant="ghost" onClick={() => onEdit(unit)}>✏ Edit Unit</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE COMPONENT ──────────────────────────────────────────────────────
export default function UnitsRentersPage() {
  const [units,   setUnits]   = useState([]);
  const [renters, setRenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState({ msg: "", type: "success" });

  // Modal state
  const [modal, setModal] = useState(null);
  // modal: { type: 'addUnit'|'editUnit'|'onboard'|'moveout'|'transfer', payload }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: r }] = await Promise.all([
      supabase.from("units").select("*").order("unit_name"),
      supabase.from("renters").select("*").eq("status", "active"),
    ]);
    setUnits(u || []);
    setRenters(r || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (msg) => { setModal(null); showToast(msg); load(); };

  const vacantUnits = units.filter((u) => u.status === "vacant");
  const renterByUnit = Object.fromEntries(renters.map((r) => [r.unit_id, r]));

  const stats = {
    total:    units.length,
    occupied: units.filter((u) => u.status === "occupied").length,
    vacant:   units.filter((u) => u.status === "vacant").length,
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%", paddingBottom: 20 }}>
      <style>{`@keyframes slideUp { from { transform: translate(-50%, 20px); opacity:0 } to { transform: translate(-50%, 0); opacity:1 } }`}</style>

      {/* ── Summary strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "14px 16px 0" }}>
        {[
          { label: "Total Units", value: stats.total,    bg: C.card },
          { label: "Occupied",    value: stats.occupied, bg: C.primaryLight },
          { label: "Vacant",      value: stats.vacant,   bg: "#fff8e6" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "12px 10px", border: `0.5px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 12px" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.09em" }}>All Units</span>
        <Btn small onClick={() => setModal({ type: "addUnit" })}>+ Add Unit</Btn>
      </div>

      {/* ── Units list ── */}
      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading units…</div>
        ) : units.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏘</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>No units yet</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Add your first unit to get started.</div>
            <Btn onClick={() => setModal({ type: "addUnit" })}>+ Add First Unit</Btn>
          </div>
        ) : (
          units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              renter={renterByUnit[unit.id]}
              vacantUnits={vacantUnits.filter((u) => u.id !== unit.id)}
              onEdit={(u)      => setModal({ type: "editUnit", payload: u })}
              onOnboard={(u)   => setModal({ type: "onboard",  payload: u })}
              onMoveOut={(r,u) => setModal({ type: "moveout",  payload: { renter: r, unit: u } })}
              onTransfer={(r,u)=> setModal({ type: "transfer", payload: { renter: r, currentUnit: u } })}
            />
          ))
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === "addUnit"  && <UnitModal unit={null}          onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === "editUnit" && <UnitModal unit={modal.payload} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === "onboard"  && <OnboardRenterModal unit={modal.payload} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === "moveout"  && (
        <MoveOutModal
          renter={modal.payload.renter} unit={modal.payload.unit}
          onClose={() => setModal(null)} onSaved={handleSaved}
        />
      )}
      {modal?.type === "transfer" && (
        <TransferModal
          renter={modal.payload.renter}
          currentUnit={modal.payload.currentUnit}
          vacantUnits={vacantUnits.filter((u) => u.id !== modal.payload.currentUnit.id)}
          onClose={() => setModal(null)} onSaved={handleSaved}
        />
      )}

      {/* ── Toast ── */}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
