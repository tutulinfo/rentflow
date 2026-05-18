/**
 * RentFlow – Task 5: Payment Recording & Renter Ledger
 *
 * FEATURES:
 *   - Renter list with outstanding balance indicators
 *   - Record Payment modal: full or partial against the active bill
 *   - Payment auto-updates: bill.amount_paid, bill.payment_status,
 *     renter.current_due, ledger_entries (credit), income_expenses (income)
 *   - Per-renter Ledger view: chronological charges & credits with
 *     running balance computed in the app layer
 *   - Moved-out renters with outstanding balance are also shown
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
  dangerBorder: "rgba(192,57,43,0.2)",
  warning:      "#e67e22",
  warningLight: "#fef5ec",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtBDT = (n) => `৳ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = (n = "") => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
const avatarColor = (n = "") => {
  const pool = ["#1a6b4a","#2e86ab","#e67e22","#8e44ad","#16a085","#c0392b"];
  let h = 0; for (let c of n) h = (h * 31 + c.charCodeAt(0)) % pool.length;
  return pool[h];
};

// Payment status helpers
const statusStyle = (s) => ({
  paid:    { bg: C.primaryLight, color: C.primary,  label: "Paid"    },
  partial: { bg: C.accentLight,  color: C.accent,   label: "Partial" },
  unpaid:  { bg: C.dangerLight,  color: C.danger,   label: "Unpaid"  },
}[s] || { bg: "#f0f0f0", color: "#666", label: s });

// ─── Shared atoms ──────────────────────────────────────────────────────────
function Avatar({ name, size = 42 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: avatarColor(name), display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, color: "#fff",
    }}>{initials(name) || "?"}</div>
  );
}

function Badge({ status }) {
  const s = statusStyle(status);
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: type === "success" ? C.primary : C.danger,
      color: "#fff", padding: "12px 24px", borderRadius: 50,
      fontSize: 14, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap",
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)", animation: "slideUp .25s ease",
    }}>
      {type === "success" ? "✓ " : "✗ "}{message}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", padding: "24px 20px 44px", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textMuted, cursor: "pointer", padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}`, margin: "0 16px" }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{sub}</div>
    </div>
  );
}

// ─── RECORD PAYMENT MODAL ──────────────────────────────────────────────────
function RecordPaymentModal({ renter, bill, onClose, onSaved }) {
  const outstanding = bill ? (bill.total_bill - bill.amount_paid) : renter.current_due;
  const [amount, setAmount]   = useState(outstanding.toFixed(2));
  const [note, setNote]       = useState("");
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const payFull = () => setAmount(outstanding.toFixed(2));

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)            { setError("Enter a valid payment amount."); return; }
    if (amt > outstanding + 0.001)   { setError(`Amount cannot exceed outstanding balance (${fmtBDT(outstanding)}).`); return; }
    setLoading(true); setError("");

    try {
      // 1. Insert payment row
      const { data: pmt, error: pErr } = await supabase.from("payments").insert({
        bill_id:    bill.id,
        renter_id:  renter.id,
        amount:     amt,
        payment_date: date,
        note:       note.trim() || null,
      }).select().single();
      if (pErr) throw new Error(pErr.message);

      // 2. Recompute bill totals
      const newPaid    = parseFloat((bill.amount_paid + amt).toFixed(2));
      const newBalance = parseFloat((bill.total_bill - newPaid).toFixed(2));
      const newStatus  = newBalance <= 0.009 ? "paid" : "partial";

      const { error: bErr } = await supabase.from("bills").update({
        amount_paid:    newPaid,
        payment_status: newStatus,
      }).eq("id", bill.id);
      if (bErr) throw new Error(bErr.message);

      // 3. Update renter.current_due
      const { error: rErr } = await supabase.from("renters").update({
        current_due: Math.max(0, newBalance),
      }).eq("id", renter.id);
      if (rErr) throw new Error(rErr.message);

      // 4. Insert ledger credit entry
      await supabase.from("ledger_entries").insert({
        renter_id:    renter.id,
        entry_type:   "credit",
        amount:       amt,
        description:  `Payment received${note ? ` (${note})` : ""}`,
        reference_id: pmt.id,
        entry_date:   date,
        billing_month: bill.billing_month,
      });

      // 5. Auto-post to owner income_expenses
      await supabase.from("income_expenses").insert({
        entry_type:   "income",
        category:     "rent",
        amount:       amt,
        description:  `Rent from ${renter.full_name} — ${bill.billing_month}`,
        reference_id: pmt.id,
        entry_date:   date,
        billing_month: bill.billing_month,
      });

      setLoading(false);
      onSaved(`৳${amt.toFixed(2)} recorded for ${renter.full_name}.`);
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <Modal title="Record Payment" onClose={onClose}>
      {/* Renter summary */}
      <div style={{ background: C.primaryLight, borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={renter.full_name} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{renter.full_name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{renter.unit_name || "—"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.danger }}>{fmtBDT(outstanding)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Outstanding</div>
        </div>
      </div>

      {/* Bill breakdown mini */}
      {bill && (
        <div style={{ background: C.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Bill — {bill.billing_month}</div>
          {[
            ["Total Bill",   fmtBDT(bill.total_bill)],
            ["Paid So Far",  fmtBDT(bill.amount_paid)],
            ["Outstanding",  fmtBDT(outstanding)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: C.textMuted }}>{k}</span>
              <span style={{ fontWeight: 700, color: k === "Outstanding" ? C.danger : C.text }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Amount input */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Amount (BDT) <span style={{ color: C.danger }}>*</span></label>
          <button onClick={payFull} style={{ fontSize: 12, fontWeight: 700, color: C.primary, background: C.primaryLight, border: "none", borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>Pay Full</button>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted, fontWeight: 700, pointerEvents: "none" }}>৳</span>
          <input
            type="number" inputMode="decimal" value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: "100%", padding: "14px 14px 14px 30px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = C.primaryMid}
            onBlur={e  => e.target.style.borderColor = C.border}
          />
        </div>
      </div>

      {/* Payment method note */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Payment Method / Note</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {["Cash", "bKash", "Nagad", "Bank"].map(m => (
            <button key={m} onClick={() => setNote(m)} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${note === m ? C.primary : C.border}`, background: note === m ? C.primaryLight : "#fff", color: note === m ? C.primary : C.textMuted, cursor: "pointer" }}>
              {m}
            </button>
          ))}
        </div>
        <input
          type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Or type a custom note…"
          style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Date */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Payment Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
      </div>

      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "14px", background: "transparent", border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 14, fontWeight: 700, color: C.primary, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
        <button onClick={save} disabled={loading} style={{ flex: 2, padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? "Saving…" : "✓ Record Payment"}
        </button>
      </div>
    </Modal>
  );
}

// ─── RENTER LEDGER VIEW ────────────────────────────────────────────────────
function RenterLedger({ renter, onBack, onRecordPayment }) {
  const [entries, setEntries]   = useState([]);
  const [bills,   setBills]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: e }, { data: b }] = await Promise.all([
      supabase.from("ledger_entries").select("*").eq("renter_id", renter.id).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("bills").select("*").eq("renter_id", renter.id).order("billing_month", { ascending: false }),
    ]);
    setEntries(e || []);
    setBills(b || []);
    setLoading(false);
  }, [renter.id]);

  useEffect(() => { load(); }, [load]);

  // Compute running balance from ledger entries
  let runningBalance = 0;
  const entriesWithBalance = (entries || []).map(entry => {
    if (entry.entry_type === "charge")  runningBalance += entry.amount;
    if (entry.entry_type === "credit")  runningBalance -= entry.amount;
    return { ...entry, balance: parseFloat(runningBalance.toFixed(2)) };
  });
  const reversedEntries = [...entriesWithBalance].reverse(); // show newest first

  // Active bill (unpaid or partial)
  const activeBill = bills.find(b => b.payment_status !== "paid");

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header card */}
      <div style={{ background: C.primary, margin: "0 0 0 0", padding: "16px 16px 24px" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>← All Renters</button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {initials(renter.full_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>{renter.full_name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{renter.unit_name} · {renter.phone || "No phone"}</div>
          </div>
        </div>
        {/* Balance summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Current Due</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{fmtBDT(renter.current_due)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Bills</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{bills.length}</div>
          </div>
        </div>
      </div>

      {/* Record Payment CTA */}
      {activeBill && (
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: C.dangerLight, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.dangerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>Outstanding Balance</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.danger }}>{fmtBDT(activeBill.total_bill - activeBill.amount_paid)}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{activeBill.billing_month} · <Badge status={activeBill.payment_status} /></div>
            </div>
            <button onClick={() => onRecordPayment(renter, activeBill)} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              + Record Payment
            </button>
          </div>
        </div>
      )}

      {/* Bills history */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Bill History</div>
        {bills.map(b => (
          <div key={b.id} style={{ background: C.card, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: "13px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.billing_month}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Paid: {fmtBDT(b.amount_paid)} of {fmtBDT(b.total_bill)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: b.payment_status === "paid" ? C.primary : C.danger, marginBottom: 4 }}>{fmtBDT(b.total_bill - b.amount_paid)}</div>
              <Badge status={b.payment_status} />
            </div>
          </div>
        ))}
        {bills.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "20px", color: C.textMuted, fontSize: 13 }}>No bills generated yet.</div>
        )}
      </div>

      {/* Ledger entries */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Transaction Ledger</div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: C.textMuted }}>Loading ledger…</div>
        ) : reversedEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: C.textMuted, fontSize: 13 }}>No transactions recorded yet.</div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Timeline line */}
            <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: C.border, zIndex: 0 }} />
            {reversedEntries.map((entry, i) => {
              const isCharge = entry.entry_type === "charge";
              return (
                <div key={entry.id} style={{ position: "relative", display: "flex", gap: 14, marginBottom: 12, zIndex: 1 }}>
                  {/* Timeline dot */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: isCharge ? C.dangerLight : C.primaryLight, border: `2px solid ${isCharge ? C.danger : C.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 2 }}>
                    {isCharge ? "📋" : "✅"}
                  </div>
                  {/* Entry card */}
                  <div style={{ flex: 1, background: C.card, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: "11px 13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{entry.description}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(entry.entry_date)}{entry.billing_month ? ` · ${entry.billing_month}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 8, flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: isCharge ? C.danger : C.primary }}>
                          {isCharge ? "+" : "−"}{fmtBDT(entry.amount)}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          Bal: <span style={{ fontWeight: 700, color: entry.balance > 0 ? C.danger : C.primary }}>{fmtBDT(entry.balance)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ─── MAIN LEDGER PAGE ──────────────────────────────────────────────────────
export default function LedgerPage() {
  const [renters,        setRenters]        = useState([]);
  const [selectedRenter, setSelectedRenter] = useState(null);
  const [paymentModal,   setPaymentModal]   = useState(null); // { renter, bill }
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState("all"); // all | unpaid | paid
  const [search,         setSearch]         = useState("");
  const [toast,          setToast]          = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    // Load all renters + their latest bill
    const { data: rentersData } = await supabase
      .from("renters")
      .select(`
        id, full_name, phone, current_due, status,
        units(unit_name),
        bills(id, billing_month, total_bill, amount_paid, payment_status)
      `)
      .order("full_name");

    const enriched = (rentersData || []).map(r => ({
      ...r,
      unit_name: r.units?.unit_name || "—",
      // Latest bill (most recent billing_month)
      latestBill: (r.bills || []).sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0] || null,
    }));
    setRenters(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePaymentSaved = (msg) => {
    setPaymentModal(null);
    setSelectedRenter(null);
    showToast(msg);
    load();
  };

  // Filtered renter list
  const filtered = renters.filter(r => {
    const matchSearch = r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.unit_name || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"    ? true :
      filter === "unpaid" ? r.current_due > 0 :
      filter === "paid"   ? r.current_due <= 0 : true;
    return matchSearch && matchFilter;
  });

  // Summary stats
  const stats = {
    total:     renters.length,
    outstanding: renters.filter(r => r.current_due > 0).length,
    cleared:   renters.filter(r => r.current_due <= 0 && r.status === "active").length,
  };

  // ── If a renter is selected, show their ledger ────────────────────────
  if (selectedRenter) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%" }}>
        <style>{`@keyframes slideUp { from { opacity:0;transform:translate(-50%,10px) } to { opacity:1;transform:translate(-50%,0) } }`}</style>
        <RenterLedger
          renter={selectedRenter}
          onBack={() => { setSelectedRenter(null); load(); }}
          onRecordPayment={(renter, bill) => setPaymentModal({ renter, bill })}
        />
        {paymentModal && (
          <RecordPaymentModal
            renter={paymentModal.renter}
            bill={paymentModal.bill}
            onClose={() => setPaymentModal(null)}
            onSaved={handlePaymentSaved}
          />
        )}
        <Toast message={toast.msg} type={toast.type} />
      </div>
    );
  }

  // ── Renter list view ─────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%", paddingBottom: 20 }}>
      <style>{`@keyframes slideUp { from { opacity:0;transform:translate(-50%,10px) } to { opacity:1;transform:translate(-50%,0) } }`}</style>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "14px 16px 0" }}>
        {[
          { label: "All Renters",  value: stats.total,       bg: C.card },
          { label: "Outstanding",  value: stats.outstanding, bg: C.dangerLight,  color: C.danger  },
          { label: "Cleared",      value: stats.cleared,     bg: C.primaryLight, color: C.primary },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "12px 10px", border: `0.5px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color || C.text }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted, pointerEvents: "none" }}>🔍</span>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search renter or unit…"
            style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", background: "#fff" }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
        {[["all", "All"], ["unpaid", "Has Balance"], ["paid", "Cleared"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${filter === k ? C.primary : C.border}`, background: filter === k ? C.primaryLight : "#fff", color: filter === k ? C.primary : C.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Renter list */}
      <div style={{ padding: "14px 16px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading renters…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📭" title="No renters found" sub={search ? "Try a different search." : "No renters match this filter."} />
        ) : (
          filtered.map((renter, i) => {
            const bill = renter.latestBill;
            const hasBalance = renter.current_due > 0;
            return (
              <div
                key={renter.id}
                onClick={() => setSelectedRenter(renter)}
                style={{
                  background: C.card, borderRadius: 16,
                  border: `0.5px solid ${hasBalance ? C.dangerBorder : C.border}`,
                  padding: "14px 16px", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer", transition: "box-shadow 0.15s",
                  animation: `fadeIn .2s ease ${i * 0.04}s both`,
                }}
              >
                <Avatar name={renter.full_name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{renter.full_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {renter.unit_name}
                    {renter.status === "moved_out" && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: C.dangerLight, color: C.danger, padding: "2px 7px", borderRadius: 10 }}>Moved Out</span>}
                  </div>
                  {bill && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Latest: {bill.billing_month} · <Badge status={bill.payment_status} /></div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: hasBalance ? C.danger : C.primary }}>
                    {fmtBDT(renter.current_due)}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {hasBalance ? "outstanding" : "clear"} ›
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Record Payment FAB */}
      <button
        onClick={() => {
          const firstUnpaid = renters.find(r => r.current_due > 0 && r.latestBill);
          if (firstUnpaid) setPaymentModal({ renter: firstUnpaid, bill: firstUnpaid.latestBill });
        }}
        style={{
          position: "fixed", bottom: 90, right: 20,
          width: 54, height: 54, borderRadius: "50%",
          background: C.primary, color: "#fff", border: "none",
          fontSize: 22, cursor: "pointer", boxShadow: "0 4px 18px rgba(26,107,74,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
        }}
        title="Quick: Record Payment"
      >💳</button>

      {paymentModal && (
        <RecordPaymentModal
          renter={paymentModal.renter}
          bill={paymentModal.bill}
          onClose={() => setPaymentModal(null)}
          onSaved={handlePaymentSaved}
        />
      )}
      <Toast message={toast.msg} type={toast.type} />

      <style>{`@keyframes fadeIn { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }`}</style>
    </div>
  );
}
