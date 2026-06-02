/**
 * RentFlow – Task 6: Owner Financials (Income & Expense Tracker)
 *
 * FEATURES:
 *   - Net Profit card: Total Income − Total Expenses
 *   - Auto-logged income entries from rent payments (read-only)
 *   - Manual income entry (parking, other sources)
 *   - Manual expense entry (repair, maintenance, utility, other)
 *   - Monthly filter to view any billing cycle
 *   - Full chronological ledger with category badges
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
};

const CATEGORIES = {
  income:  ["rent", "parking", "deposit", "other"],
  expense: ["repair", "maintenance", "utility", "salary", "other"],
};

const CATEGORY_ICONS = {
  rent: "🏠", parking: "🅿️", deposit: "💰", repair: "🔧",
  maintenance: "⚙️", utility: "💡", salary: "👷", other: "📎",
};

const fmtBDT  = (n) => `৳ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ─── Shared atoms ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: "24px", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", padding: "24px 20px 44px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textMuted, cursor: "pointer", padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: type === "success" ? C.primary : C.danger, color: "#fff", padding: "12px 24px", borderRadius: 50, fontSize: 14, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.18)", animation: "slideUp .25s ease" }}>
      {type === "success" ? "✓ " : "✗ "}{message}
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

function FieldInput({ label, value, onChange, type = "text", placeholder, required, prefix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Label required={required}>{label}</Label>}
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: C.textMuted, fontWeight: 700, pointerEvents: "none" }}>{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", padding: prefix ? "13px 14px 13px 28px" : "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", background: "#fff" }}
          onFocus={e => e.target.style.borderColor = C.primaryMid}
          onBlur={e => e.target.style.borderColor = C.border}
        />
      </div>
    </div>
  );
}

// ─── ADD ENTRY MODAL ───────────────────────────────────────────────────────
function AddEntryModal({ type, onClose, onSaved }) {
  const isIncome = type === "income";
  const [category,    setCategory]    = useState(isIncome ? "rent" : "repair");
  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [month,       setMonth]       = useState(thisMonth());
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const save = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!description.trim())               { setError("Description is required."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.from("income_expenses").insert({
      entry_type:    type,
      category,
      amount:        parseFloat(amount),
      description:   description.trim(),
      entry_date:    date,
      billing_month: month,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSaved(`${isIncome ? "Income" : "Expense"} entry added.`);
  };

  const cats = CATEGORIES[type];

  return (
    <Modal title={isIncome ? "Add Income Entry" : "Add Expense Entry"} onClose={onClose}>
      {/* Category selector */}
      <div style={{ marginBottom: 16 }}>
        <Label required>Category</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${category === cat ? (isIncome ? C.primary : C.danger) : C.border}`, background: category === cat ? (isIncome ? C.primaryLight : C.dangerLight) : "#fff", color: category === cat ? (isIncome ? C.primary : C.danger) : C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <FieldInput label="Amount (BDT)" value={amount} onChange={setAmount} type="number" placeholder="0.00" prefix="৳" required />
      <FieldInput label="Description" value={description} onChange={setDescription} placeholder={isIncome ? "e.g. Parking fee from Renter X" : "e.g. Bathroom pipe repair"} required />
      <FieldInput label="Date" value={date} onChange={setDate} type="date" />
      <FieldInput label="Billing Month" value={month} onChange={setMonth} type="month" />

      {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "14px", background: "transparent", border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 14, fontWeight: 700, color: C.primary, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
        <button onClick={save} disabled={loading} style={{ flex: 2, padding: "14px", background: isIncome ? C.primary : C.danger, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? "Saving…" : `Add ${isIncome ? "Income" : "Expense"}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── MAIN FINANCIALS PAGE ──────────────────────────────────────────────────
export default function FinancialsPage() {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // 'income' | 'expense'
  const [filter,   setFilter]   = useState("all"); // all | income | expense
  const [month,    setMonth]    = useState("all");
  const [toast,    setToast]    = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("income_expenses")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute totals from ALL entries (not filtered)
  const totalIncome  = entries.filter(e => e.entry_type === "income").reduce((s, e)  => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.entry_type === "expense").reduce((s, e) => s + e.amount, 0);
  const netProfit    = totalIncome - totalExpense;

  // Available months for filter
  const months = ["all", ...new Set(entries.map(e => e.billing_month).filter(Boolean))].sort().reverse();

  // Filtered list
  const filtered = entries.filter(e => {
    const mf = month === "all" || e.billing_month === month;
    const tf = filter === "all" || e.entry_type === filter;
    return mf && tf;
  });

  // Filtered totals (for selected month)
  const fIncome  = filtered.filter(e => e.entry_type === "income").reduce((s, e)  => s + e.amount, 0);
  const fExpense = filtered.filter(e => e.entry_type === "expense").reduce((s, e) => s + e.amount, 0);

  const handleSaved = (msg) => { setModal(null); showToast(msg); load(); };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%", paddingBottom: 24 }}>
      <style>{`@keyframes slideUp { from { opacity:0;transform:translate(-50%,10px) } to { opacity:1;transform:translate(-50%,0) } }`}</style>

      {/* ── Net Profit Hero ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryMid} 100%)`, padding: "20px 16px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Overall Net Profit</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: netProfit >= 0 ? "#fff" : "#ffb3b3", letterSpacing: "-0.02em", marginBottom: 16 }}>
          {fmtBDT(netProfit)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Income</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{fmtBDT(totalIncome)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Expenses</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{fmtBDT(totalExpense)}</div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 16px 0" }}>
        <button onClick={() => setModal("income")} style={{ background: C.primaryLight, border: `1.5px solid ${C.borderMid}`, borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: 22 }}>💰</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>Add Income</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Parking, other</div>
          </div>
        </button>
        <button onClick={() => setModal("expense")} style={{ background: C.dangerLight, border: `1.5px solid rgba(192,57,43,0.2)`, borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: 22 }}>🔧</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>Add Expense</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Repair, maintenance</div>
          </div>
        </button>
      </div>

      {/* ── Month filter ── */}
      <div style={{ padding: "14px 16px 0" }}>
        <Label>Filter by Month</Label>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#fff" }}>
          {months.map(m => <option key={m} value={m}>{m === "all" ? "All Time" : m}</option>)}
        </select>
      </div>

      {/* ── Type filter pills ── */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
        {[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${filter === k ? C.primary : C.border}`, background: filter === k ? C.primaryLight : "#fff", color: filter === k ? C.primary : C.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Filtered mini summary ── */}
      {month !== "all" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px 0" }}>
          {[
            { label: "Income",  value: fmtBDT(fIncome),            color: C.primary },
            { label: "Expense", value: fmtBDT(fExpense),           color: C.danger  },
            { label: "Net",     value: fmtBDT(fIncome - fExpense), color: (fIncome - fExpense) >= 0 ? C.primary : C.danger },
          ].map(s => (
            <div key={s.label} style={{ background: C.card, borderRadius: 12, padding: "10px 10px", border: `0.5px solid ${C.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Entries list ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
          {filtered.length} {filter === "all" ? "Transactions" : filter === "income" ? "Income Entries" : "Expense Entries"}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No entries found</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Add income or expense entries to track your finances.</div>
          </div>
        ) : (
          filtered.map((entry, i) => {
            const isIncome = entry.entry_type === "income";
            const isAutoRent = entry.category === "rent" && isIncome;
            return (
              <div key={entry.id} style={{ background: C.card, borderRadius: 16, border: `0.5px solid ${C.border}`, padding: "13px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, animation: `fadeIn .2s ease ${i * 0.03}s both` }}>
                {/* Icon */}
                <div style={{ width: 42, height: 42, borderRadius: 13, background: isIncome ? C.primaryLight : C.dangerLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {CATEGORY_ICONS[entry.category] || "📎"}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{entry.description}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(entry.entry_date)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: isIncome ? C.primaryLight : C.dangerLight, color: isIncome ? C.primary : C.danger }}>
                      {entry.category}
                    </span>
                    {isAutoRent && <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: "#f0f0f0", padding: "2px 7px", borderRadius: 10 }}>auto</span>}
                    {entry.billing_month && <span style={{ fontSize: 10, color: C.textMuted }}>{entry.billing_month}</span>}
                  </div>
                </div>
                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isIncome ? C.primary : C.danger }}>
                    {isIncome ? "+" : "−"}{fmtBDT(entry.amount)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modal && <AddEntryModal type={modal} onClose={() => setModal(null)} onSaved={handleSaved} />}
      <Toast message={toast.msg} type={toast.type} />
      <style>{`@keyframes fadeIn { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }`}</style>
    </div>
  );
}
