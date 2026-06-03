/**
 * RentFlow – Task 3: Units & Renters Management
 * Full lifecycle: Add Unit · Onboard Renter · Move-Out · Unit Transfer
 * Supabase-wired, mobile-first, production-ready.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const C = {
  primary: "#1a6b4a",
  primaryLight: "#e8f5ee",
  surface: "#f7f9f7",
  card: "#ffffff",
  border: "rgba(26,107,74,0.13)",
  borderMid: "rgba(26,107,74,0.25)",
  text: "#1a2e22",
  textMuted: "#5a7a6a",
  danger: "#c0392b",
  dangerLight: "#fdf0ee",
  warning: "#e67e22",
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
const avatarColor = (name = "") => {
  const colors = [
    C.primary,
    "#2e86ab",
    "#e67e22",
    "#8e44ad",
    "#16a085",
    "#c0392b",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
};
const fmtBDT = (n) =>
  `৳ ${Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

function StatusBadge({ status }) {
  const map = {
    occupied: { bg: C.primaryLight, color: C.primary, label: "Occupied" },
    vacant: { bg: "#fff8e6", color: C.warning, label: "Vacant" },
    inactive: { bg: "#f0f0f0", color: "#666", label: "Inactive" },
    active: { bg: C.primaryLight, color: C.primary, label: "Active" },
    moved_out: { bg: C.dangerLight, color: C.danger, label: "Moved Out" },
  };
  const s = map[status] || map.inactive;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        letterSpacing: "0.03em",
      }}
    >
      {s.label}
    </span>
  );
}

function Avatar({ name, size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: avatarColor(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {initials(name) || "?"}
    </div>
  );
}

function Btn({
  children,
  variant = "primary",
  onClick,
  disabled,
  style = {},
  small,
}) {
  const base = {
    border: "none",
    borderRadius: small ? 10 : 14,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    fontSize: small ? 12 : 14,
    padding: small ? "8px 8px" : "14px 22px",
    opacity: disabled ? 0.55 : 1,
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
  const variants = {
    primary: { background: C.primary, color: "#fff" },
    danger: { background: C.danger, color: "#fff" },
    ghost: {
      background: "transparent",
      color: C.primary,
      border: `1.5px solid ${C.borderMid}`,
    },
    warning: { background: C.warning, color: "#fff" },
  };
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  prefix,
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.textMuted,
          display: "block",
          marginBottom: 5,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
        {required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: C.textMuted,
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: prefix ? "13px 14px 13px 28px" : "13px 14px",
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            background: "#fff",
            fontSize: 15,
            color: C.text,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#2d9e6e")}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, danger }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: "24px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px 20px 40px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: danger ? C.danger : C.text,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              color: C.textMuted,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "success" ? C.primary : C.danger,
        color: "#fff",
        padding: "12px 22px",
        borderRadius: 50,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 2000,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        animation: "slideUp 0.25s ease",
      }}
    >
      {type === "success" ? "✓ " : "✗ "}
      {message}
    </div>
  );
}

function UnitModal({ unit, onClose, onSaved, onDelete }) {
  const editing = !!unit;
  const [name, setName] = useState(unit?.unit_name || "");
  const [rent, setRent] = useState(unit?.room_rent || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const save = async () => {
    if (!name.trim() || !rent) {
      setError("Unit name and rent are required.");
      return;
    }
    if (editing && confirmText.trim().toUpperCase() !== "EDIT") {
      setError('Type "EDIT" in the confirmation box to save changes.');
      return;
    }
    setLoading(true);
    setError("");
    const payload = { unit_name: name.trim(), room_rent: parseFloat(rent) };
    let result;
    if (editing) {
      result = await supabase.from("units").update(payload).eq("id", unit.id);
    } else {
      result = await supabase
        .from("units")
        .insert({ ...payload, status: "vacant" });
    }
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSaved(editing ? "Unit updated." : "Unit added.");
  };

  return (
    <Modal title={editing ? "Edit Unit" : "Add New Unit"} onClose={onClose}>
      <Input
        label="Unit Name"
        value={name}
        onChange={setName}
        placeholder="e.g. Unit 1, Room A"
        required
      />
      <Input
        label="Base Rent (BDT)"
        value={rent}
        onChange={setRent}
        type="number"
        placeholder="Optional base rent"
        prefix="৳"
      />
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        Optional base rent for the unit. Final rent is fixed when a renter is assigned.
      </div>
      {editing && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textMuted,
              display: "block",
              marginBottom: 6,
            }}
          >
            To confirm edits, type "EDIT" below
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type EDIT to confirm"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              fontSize: 14,
            }}
          />
        </div>
      )}
      {error && (
        <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </Btn>
        <Btn onClick={save} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Saving…" : editing ? "Save Changes" : "Add Unit"}
        </Btn>
      </div>
      {editing && onDelete && (
        <div style={{ marginTop: 12 }}>
          <Btn
            variant="danger"
            small
            onClick={onDelete}
            style={{ width: "100%" }}
          >
            🗑️ Delete Unit
          </Btn>
        </div>
      )}
    </Modal>
  );
}

function DeleteConfirmModal({ unit, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const destroy = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setError('Type "DELETE" to confirm deletion.');
      return;
    }
    setLoading(true);
    setError("");
    const result = await supabase.from("units").delete().eq("id", unit.id);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onDeleted("Unit deleted.");
  };

  return (
    <Modal
      title={`Delete ${unit?.unit_name || "unit"}`}
      onClose={onClose}
      danger
    >
      <p
        style={{ color: C.text, marginBottom: 12 }}
      >{`This action will permanently delete ${unit?.unit_name || "this unit"}.`}</p>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
        To confirm, type <strong>DELETE</strong> in the box below.
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type DELETE to confirm"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1.5px solid ${C.border}`,
          fontSize: 14,
          marginBottom: 12,
        }}
      />
      {error && (
        <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </Btn>
        <Btn
          variant="danger"
          onClick={destroy}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? "Deleting…" : "Delete Unit"}
        </Btn>
      </div>
    </Modal>
  );
}

function MoveOutConfirmModal({ renter, onClose, onMovedOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const moveOut = async () => {
    if (!renter) return;
    setLoading(true);
    setError("");
    try {
      if (renter.unit_id) {
        await supabase.from("units").update({ status: "vacant" }).eq("id", renter.unit_id);
      }
      await supabase
        .from("renters")
        .update({ status: "moved_out", unit_id: null })
        .eq("id", renter.id);
      setLoading(false);
      onMovedOut(`Moved out ${renter.full_name}.`);
    } catch (err) {
      setLoading(false);
      setError(err?.message || "Unable to move out renter.");
    }
  };

  return (
    <Modal title={`Move out ${renter?.full_name || "renter"}`} onClose={onClose} danger>
      <p style={{ color: C.text, marginBottom: 12 }}>
        This will free the assigned unit and mark the renter as moved out. The renter record remains available for review.
      </p>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
        Confirm to move this renter out and release their unit.
      </p>
      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </Btn>
        <Btn variant="danger" onClick={moveOut} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Processing…" : "Move Out"}
        </Btn>
      </div>
    </Modal>
  );
}

function RenterModal({ renter, units, renters, initialUnit, onClose, onSaved }) {
  const editing = !!renter;
  const [fullName, setFullName] = useState(renter?.full_name || "");
  const [phone, setPhone] = useState(renter?.phone || "");
  const [nid, setNid] = useState(renter?.nid_number || "");
  const [address, setAddress] = useState(renter?.permanent_address || "");
  const [emergencyName, setEmergencyName] = useState(renter?.emergency_contact_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(renter?.emergency_contact_phone || "");
  const [unitId, setUnitId] = useState(renter?.unit_id || initialUnit?.id || "");
  const [assignedRent, setAssignedRent] = useState(
    renter?.units?.room_rent?.toString() || initialUnit?.room_rent?.toString() || ""
  );
  const [startingMeter, setStartingMeter] = useState(
    renter?.last_electricity_reading?.toString() || ""
  );
  const [status, setStatus] = useState(renter?.status || "active");
  const [currentDue, setCurrentDue] = useState(renter?.current_due?.toString() || "0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableUnits = units.filter((u) => u.status === "vacant" || u.id === unitId);
  const unitMeterHistory = unitId
    ? renters
        .filter((r) => r.unit_id === unitId && r.last_electricity_reading != null)
        .map((r) => parseFloat(r.last_electricity_reading) || 0)
    : [];
  const lastMeterReadingForUnit = unitMeterHistory.length
    ? Math.max(...unitMeterHistory)
    : null;

  const save = async () => {
    if (!fullName.trim()) {
      setError("Renter name is required.");
      return;
    }
        if (status === "active" && !unitId) {
          setError("Please assign a unit for the renter.");
          return;
        }
        if (status === "active" && !startingMeter.trim()) {
          setError("Starting meter reading is required for active renters.");
          return;
        }
    try {
      if (editing) {
        const previousUnitId = renter.unit_id;
        const payload = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          nid_number: nid.trim(),
          permanent_address: address.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          status,
          current_due: parseFloat(currentDue) || 0,
          unit_id: status === "active" ? unitId || null : null,
          last_electricity_reading: parseFloat(startingMeter) || 0,
        };

        await supabase.from("renters").update(payload).eq("id", renter.id);

        if (previousUnitId && previousUnitId !== unitId) {
          await supabase.from("units").update({ status: "vacant" }).eq("id", previousUnitId);
        }
        if (unitId && status === "active") {
          await supabase.from("units").update({ status: "occupied", room_rent: parseFloat(assignedRent) || 0 }).eq("id", unitId);
        }
        if (status !== "active" && previousUnitId) {
          await supabase.from("units").update({ status: "vacant" }).eq("id", previousUnitId);
        }

        setLoading(false);
        onSaved("Renter updated.");
      } else {
        const payload = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          nid_number: nid.trim(),
          permanent_address: address.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          status: status === "active" ? "active" : "moved_out",
          current_due: parseFloat(currentDue) || 0,
          unit_id: status === "active" ? unitId || null : null,
          last_electricity_reading: parseFloat(startingMeter) || 0,
        };

        const { error } = await supabase.from("renters").insert(payload);
        if (error) throw error;

        if (unitId && status === "active") {
          await supabase.from("units").update({ status: "occupied", room_rent: parseFloat(assignedRent) || 0 }).eq("id", unitId);
        }

        setLoading(false);
        onSaved("Renter added.");
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || "Unable to save renter.");
    }
  };

  return (
    <Modal title={editing ? "Edit Renter" : "Add New Renter"} onClose={onClose}>
      <Input label="Full Name" value={fullName} onChange={setFullName} required />
      <Input label="Mobile Number" value={phone} onChange={setPhone} placeholder="01XXXXXXXXX" />
      <Input label="NID Number" value={nid} onChange={setNid} placeholder="National ID" />
      <Input label="Permanent Address" value={address} onChange={setAddress} placeholder="Street, City" />
      <Input label="Emergency Contact" value={emergencyName} onChange={setEmergencyName} placeholder="Name" />
      <Input label="Emergency Phone" value={emergencyPhone} onChange={setEmergencyPhone} placeholder="01XXXXXXXXX" />
      <Input label="Current Due (BDT)" value={currentDue} onChange={setCurrentDue} type="number" prefix="৳" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Status
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, background: "#fff", fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
            <option value="active">Active</option>
            <option value="moved_out">Moved Out</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Assigned Unit
          </label>
          <select value={unitId || ""} onChange={(e) => setUnitId(e.target.value || null)} disabled={status !== "active"} style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, background: status !== "active" ? "#f5f5f5" : "#fff", fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
            <option value="">None</option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.unit_name}</option>
            ))}
          </select>
        </div>
      </div>
      {status === "active" && unitId && (
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>
          {lastMeterReadingForUnit != null
            ? `Last recorded meter reading for this unit: ${lastMeterReadingForUnit.toFixed(2)} units`
            : "No prior meter reading found for this unit."}
        </div>
      )}
      {status === "active" && (
        <Input
          label="Starting Meter Reading"
          value={startingMeter}
          onChange={setStartingMeter}
          type="number"
          placeholder="Enter starting sub-meter reading"
        />
      )}
      {status === "active" && (
        <Input
          label="Final Rent (BDT)"
          value={assignedRent}
          onChange={setAssignedRent}
          type="number"
          placeholder="Set the final rent for this renter"
          prefix="৳"
        />
      )}
      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </Btn>
        <Btn onClick={save} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Saving…" : editing ? "Save Renter" : "Add Renter"}
        </Btn>
      </div>
    </Modal>
  );
}

export default function UnitsRentersPage() {
  const [units, setUnits] = useState([]);
  const [renters, setRenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [modal, setModal] = useState(null);
  const [showMovedOut, setShowMovedOut] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: r }] = await Promise.all([
      supabase.from("units").select("*").order("unit_name"),
      supabase.from("renters").select("*, units(unit_name, room_rent)").order("full_name"),
    ]);
    setUnits(u || []);
    setRenters(
      (r || []).map((rr) => ({
        ...rr,
        unit_name: rr.units?.unit_name || "—",
        room_rent: rr.units?.room_rent || 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (msg) => {
    setModal(null);
    showToast(msg);
    load();
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const stats = {
    total: units.length,
    occupied: units.filter((u) => u.status === "occupied").length,
    vacant: units.filter((u) => u.status === "vacant").length,
  };
  const activeRenters = renters.filter((r) => r.status === "active");
  const hiddenRentersCount = renters.filter((r) => r.status !== "active").length;
  const displayedRenters = renters.filter((r) => showMovedOut || r.status === "active");

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: C.surface,
        minHeight: "100%",
        paddingBottom: 20,
      }}
    >
      <style>{`@keyframes slideUp { from { transform: translate(-50%, 20px); opacity:0 } to { transform: translate(-50%, 0); opacity:1 } }`}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: "14px 16px 0",
        }}
      >
        {[
          { label: "Total Units", value: stats.total, bg: C.card },
          { label: "Occupied", value: stats.occupied, bg: C.primaryLight },
          { label: "Vacant", value: stats.vacant, bg: "#fff8e6" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: s.bg,
              borderRadius: 14,
              padding: "12px 10px",
              border: `0.5px solid ${C.border}`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
              {s.value}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 12px",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              marginBottom: 6,
            }}
          >
            Renters & Units
          </div>
          <div style={{ fontSize: 14, color: C.textMuted }}>
            Manage renter details, assignments, and move-outs.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small onClick={() => setModal({ type: "addRenter" })}>+ Add Renter</Btn>
          <Btn
            small
            variant={showMovedOut ? "ghost" : "warning"}
            onClick={() => setShowMovedOut((prev) => !prev)}
          >
            {showMovedOut ? "Hide moved-out" : `Show moved-out (${hiddenRentersCount})`}
          </Btn>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
            Loading units and renters…
          </div>
        ) : displayedRenters.length === 0 && renters.length > 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: C.textMuted, fontSize: 13 }}>
            No active renters to show. Toggle moved-out renters to view records.
          </div>
        ) : (
          displayedRenters.map((renter) => {
            const expanded = expandedIds.includes(renter.id);
            const unitLabel = renter.unit_name || "No unit assigned";
            return (
              <div
                key={renter.id}
                style={{
                  background: C.card,
                  borderRadius: 18,
                  border: `0.5px solid ${C.border}`,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Avatar name={renter.full_name || "?"} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                      {renter.full_name || "Unnamed renter"}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span>{unitLabel}</span>
                      <span>{renter.phone || "No phone"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <StatusBadge status={renter.status} />
                    <Btn small variant="ghost" onClick={() => toggleExpand(renter.id)}>
                      {expanded ? "Hide details" : "View details"}
                    </Btn>
                  </div>
                </div>
                {expanded && (
                  <div style={{ padding: "0 16px 16px", borderTop: `0.5px solid ${C.border}`, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ fontSize: 13, color: C.textMuted }}><strong>NID:</strong> {renter.nid_number || "—"}</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}><strong>Due:</strong> {fmtBDT(renter.current_due)}</div>
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted }}><strong>Address:</strong> {renter.permanent_address || "—"}</div>
                    <div style={{ fontSize: 13, color: C.textMuted }}><strong>Emergency:</strong> {renter.emergency_contact_name || "—"} {renter.emergency_contact_phone ? `(${renter.emergency_contact_phone})` : ""}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn small variant="ghost" onClick={() => setModal({ type: "editRenter", renter })}>Edit</Btn>
                      {renter.status === "active" && (
                        <Btn small variant="danger" onClick={() => setModal({ type: "moveOutRenter", renter })}>Move Out</Btn>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 12px",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
          }}
        >
          All Units
        </span>
        <Btn small onClick={() => setModal({ type: "addUnit" })}>
          + Add Unit
        </Btn>
      </div>

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
            Loading units…
          </div>
        ) : units.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: C.card,
              borderRadius: 18,
              border: `0.5px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏘</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.text,
                marginBottom: 6,
              }}
            >
              No units yet
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
              Add your first unit to get started.
            </div>
            <Btn onClick={() => setModal({ type: "addUnit" })}>
              + Add First Unit
            </Btn>
          </div>
        ) : (
          units.map((unit) => {
            const occupant = renters.find(
              (r) => r.status === "active" && r.unit_id === unit.id
            );
            return (
              <div
                key={unit.id}
                style={{
                  background: C.card,
                  borderRadius: 18,
                  border: `0.5px solid ${C.border}`,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      flexShrink: 0,
                      background:
                        unit.status === "occupied" ? C.primaryLight : "#f5f5f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {unit.status === "occupied" ? "🏠" : "🔓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                      {unit.unit_name}
                    </div>
                    <div
                      style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}
                    >
                      {fmtBDT(unit.room_rent)}/mo · {occupant ? `Renter: ${occupant.full_name}` : "No renter assigned"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge status={unit.status} />
                    <Btn
                      variant="ghost"
                      small
                      onClick={() => setModal({ type: "editUnit", unit })}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3.33333 12.6667H4.28333L10.8 6.15L9.85 5.2L3.33333 11.7167V12.6667ZM2 14V11.1667L10.8 2.38333C10.9333 2.26111 11.0806 2.16667 11.2417 2.1C11.4028 2.03333 11.5722 2 11.75 2C11.9278 2 12.1 2.03333 12.2667 2.1C12.4333 2.16667 12.5778 2.26667 12.7 2.4L13.6167 3.33333C13.75 3.45556 13.8472 3.6 13.9083 3.76667C13.9694 3.93333 14 4.1 14 4.26667C14 4.44444 13.9694 4.61389 13.9083 4.775C13.8472 4.93611 13.75 5.08333 13.6167 5.21667L4.83333 14H2ZM10.3167 5.68333L9.85 5.2L10.8 6.15L10.3167 5.68333Z"
                          fill="#16A085"
                        />
                      </svg>
                    </Btn>
                    {unit.status === "vacant" ? (
                      <Btn
                        small
                        onClick={() => setModal({ type: "assignRenter", initialUnit: unit })}
                      >
                        Assign Renter
                      </Btn>
                    ) : (
                      <Btn
                        small
                        variant="ghost"
                        onClick={() => {
                          const occupant = renters.find((r) => r.status === "active" && r.unit_id === unit.id);
                          if (occupant) setModal({ type: "editRenter", renter: occupant });
                        }}
                      >
                        Edit Renter
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modal?.type === "addUnit" && (
        <UnitModal
          unit={null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "editUnit" && (
        <UnitModal
          unit={modal.unit}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDelete={() => setModal({ type: "deleteUnit", unit: modal.unit })}
        />
      )}
      {modal?.type === "deleteUnit" && (
        <DeleteConfirmModal
          unit={modal.unit}
          onClose={() => setModal(null)}
          onDeleted={(msg) => {
            setModal(null);
            showToast(msg);
            load();
          }}
        />
      )}
      {modal?.type === "addRenter" && (
        <RenterModal
          renter={null}
          units={units}
          renters={renters}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "assignRenter" && (
        <RenterModal
          renter={null}
          units={units}
          renters={renters}
          initialUnit={modal.initialUnit}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "editRenter" && (
        <RenterModal
          renter={modal.renter}
          units={units}
          renters={renters}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "moveOutRenter" && (
        <MoveOutConfirmModal
          renter={modal.renter}
          onClose={() => setModal(null)}
          onMovedOut={(msg) => {
            setModal(null);
            showToast(msg);
            load();
          }}
        />
      )}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
