/**
 * RentFlow – Task 7: Dashboard (Live Summary Cards & Quick Actions)
 *
 * All 4 KPI cards computed live from Supabase:
 *   Total Expected  = SUM(bills.total_bill) for current month
 *   Total Collected = SUM(bills.amount_paid) for current month
 *   Outstanding     = SUM(bills.outstanding_balance) for current month
 *   Net Profit      = SUM(income) − SUM(expenses) all time
 *
 * Quick Actions: Record Payment, Add Expense (open modals inline)
 * Recent Activity: last 5 payments across all renters
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
  primaryMid: "#2d9e6e",
  accent: "#f0a500",
  accentLight: "#fff8e6",
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

const fmtBDT = (n) => `৳ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-BD", {
        day: "2-digit",
        month: "short",
      })
    : "—";
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(y, m - 1).toLocaleString("en-BD", {
    month: "long",
    year: "numeric",
  });
};
const initials = (n = "") =>
  n
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
const avatarColor = (n = "") => {
  const p = ["#1a6b4a", "#2e86ab", "#e67e22", "#8e44ad", "#16a085", "#c0392b"];
  let h = 0;
  for (let c of n) h = (h * 31 + c.charCodeAt(0)) % p.length;
  return p[h];
};

function Modal({ title, onClose, children }) {
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
        fontFamily: "'DM Sans', sans-serif",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "24px 20px 44px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
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
            style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}
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
              padding: 4,
              lineHeight: 1,
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
        bottom: 90,
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "success" ? C.primary : C.danger,
        color: "#fff",
        padding: "12px 24px",
        borderRadius: 50,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 2000,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        animation: "slideUp .25s ease",
      }}
    >
      {type === "success" ? "✓ " : "✗ "}
      {message}
    </div>
  );
}

// Quick Record Payment (simplified — picks first unpaid bill)
function QuickPaymentModal({ onClose, onSaved }) {
  const [renters, setRenters] = useState([]);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("renters")
        .select(
          "id, full_name, current_due, units(unit_name), bills(id, billing_month, total_bill, amount_paid, payment_status)",
        )
        .eq("status", "active")
        .gt("current_due", 0);
      const enriched = (data || [])
        .map((r) => ({
          ...r,
          unit_name: r.units?.unit_name || "—",
          activeBill:
            (r.bills || [])
              .filter((b) => b.payment_status !== "paid")
              .sort((a, b) =>
                b.billing_month.localeCompare(a.billing_month),
              )[0] || null,
        }))
        .filter((r) => r.activeBill);
      setRenters(enriched);
      if (enriched.length) {
        setSelected(enriched[0].id);
        setAmount(enriched[0].current_due.toFixed(2));
      }
      setFetching(false);
    })();
  }, []);

  const selectedRenter = renters.find((r) => r.id === selected);

  const handleSelect = (id) => {
    setSelected(id);
    const r = renters.find((x) => x.id === id);
    if (r) setAmount(r.current_due.toFixed(2));
  };

  const save = async () => {
    if (!selectedRenter || !amount || parseFloat(amount) <= 0) return;
    const amt = parseFloat(amount);
    const bill = selectedRenter.activeBill;
    setLoading(true);
    const newPaid = parseFloat((bill.amount_paid + amt).toFixed(2));
    const newBal = parseFloat((bill.total_bill - newPaid).toFixed(2));
    const newStatus = newBal <= 0.009 ? "paid" : "partial";
    const { data: pmt } = await supabase
      .from("payments")
      .insert({
        bill_id: bill.id,
        renter_id: selectedRenter.id,
        amount: amt,
        payment_date: new Date().toISOString().slice(0, 10),
        note: method,
      })
      .select()
      .single();
    await supabase
      .from("bills")
      .update({ amount_paid: newPaid, payment_status: newStatus })
      .eq("id", bill.id);
    await supabase
      .from("renters")
      .update({ current_due: Math.max(0, newBal) })
      .eq("id", selectedRenter.id);
    await supabase
      .from("ledger_entries")
      .insert({
        renter_id: selectedRenter.id,
        entry_type: "credit",
        amount: amt,
        description: `Payment received (${method})`,
        reference_id: pmt.id,
        entry_date: new Date().toISOString().slice(0, 10),
        billing_month: bill.billing_month,
      });
    await supabase
      .from("income_expenses")
      .insert({
        entry_type: "income",
        category: "rent",
        amount: amt,
        description: `Rent from ${selectedRenter.full_name} — ${bill.billing_month}`,
        reference_id: pmt.id,
        entry_date: new Date().toISOString().slice(0, 10),
        billing_month: bill.billing_month,
      });
    setLoading(false);
    onSaved(`৳${amt.toFixed(2)} recorded for ${selectedRenter.full_name}.`);
  };

  return (
    <Modal title="Quick Record Payment" onClose={onClose}>
      {fetching ? (
        <div style={{ textAlign: "center", padding: 30, color: C.textMuted }}>
          Loading…
        </div>
      ) : renters.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              marginBottom: 6,
            }}
          >
            All caught up!
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            No outstanding balances at the moment.
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMuted,
                display: "block",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Select Renter
            </label>
            <select
              value={selected}
              onChange={(e) => handleSelect(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                fontSize: 14,
                color: C.text,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                background: "#fff",
              }}
            >
              {renters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} — {fmtBDT(r.current_due)} due
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Amount (BDT)
              </label>
              <button
                onClick={() =>
                  selectedRenter &&
                  setAmount(selectedRenter.current_due.toFixed(2))
                }
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.primary,
                  background: C.primaryLight,
                  border: "none",
                  borderRadius: 20,
                  padding: "3px 10px",
                  cursor: "pointer",
                }}
              >
                Pay Full
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  color: C.textMuted,
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                ৳
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 14px 14px 30px",
                  borderRadius: 12,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["Cash", "bKash", "Nagad", "Bank"].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${method === m ? C.primary : C.border}`,
                  background: method === m ? C.primaryLight : "#fff",
                  color: method === m ? C.primary : C.textMuted,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "14px",
                background: "transparent",
                border: `1.5px solid ${C.borderMid}`,
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                color: C.primary,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={loading}
              style={{
                flex: 2,
                padding: "14px",
                background: C.primary,
                color: "#fff",
                border: "none",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {loading ? "Saving…" : "✓ Record Payment"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Quick Add Expense Modal
function QuickExpenseModal({ onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("repair");
  const [loading, setLoading] = useState(false);
  const cats = [
    ["repair", "🔧"],
    ["maintenance", "⚙️"],
    ["utility", "💡"],
    ["other", "📎"],
  ];
  const save = async () => {
    if (!amount || !desc) return;
    setLoading(true);
    await supabase
      .from("income_expenses")
      .insert({
        entry_type: "expense",
        category: cat,
        amount: parseFloat(amount),
        description: desc.trim(),
        entry_date: new Date().toISOString().slice(0, 10),
        billing_month: thisMonth(),
      });
    setLoading(false);
    onSaved("Expense added.");
  };
  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        {cats.map(([k, icon]) => (
          <button
            key={k}
            onClick={() => setCat(k)}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 20,
              border: `1.5px solid ${cat === k ? C.danger : C.border}`,
              background: cat === k ? C.dangerLight : "#fff",
              color: cat === k ? C.danger : C.textMuted,
              cursor: "pointer",
            }}
          >
            {icon} {k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            display: "block",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          Amount <span style={{ color: C.danger }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 15,
              color: C.textMuted,
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            ৳
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              padding: "13px 14px 13px 28px",
              borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              fontSize: 16,
              color: C.text,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            display: "block",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          Description <span style={{ color: C.danger }}>*</span>
        </label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Roof leak repair"
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            fontSize: 14,
            color: C.text,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "14px",
            background: "transparent",
            border: `1.5px solid ${C.borderMid}`,
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 700,
            color: C.primary,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={loading || !amount || !desc}
          style={{
            flex: 2,
            padding: "14px",
            background: C.danger,
            color: "#fff",
            border: "none",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading || !amount || !desc ? 0.6 : 1,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {loading ? "Saving…" : "Add Expense"}
        </button>
      </div>
    </Modal>
  );
}

// ─── MAIN DASHBOARD PAGE ───────────────────────────────────────────────────
export default function DashboardPage({ onNavigate }) {
  const [kpi, setKpi] = useState({
    expected: 0,
    collected: 0,
    outstanding: 0,
    netProfit: 0,
  });
  const [recent, setRecent] = useState([]);
  const [units, setUnits] = useState({ total: 0, occupied: 0, vacant: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [month, setMonth] = useState(thisMonth());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: bills },
      { data: ie },
      { data: payments },
      { data: unitsData },
    ] = await Promise.all([
      supabase
        .from("bills")
        .select("total_bill, amount_paid, outstanding_balance, payment_status")
        .eq("billing_month", month),
      supabase.from("income_expenses").select("entry_type, amount"),
      supabase
        .from("payments")
        .select(
          "id, amount, payment_date, renter_id, renters(full_name), bills(billing_month, unit_name_snapshot)",
        )
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("units").select("status"),
    ]);

    const bList = bills || [];
    const expected = bList.reduce((s, b) => s + b.total_bill, 0);
    const collected = bList.reduce((s, b) => s + b.amount_paid, 0);
    const outstanding = bList.reduce(
      (s, b) => s + (b.total_bill - b.amount_paid),
      0,
    );
    const ieList = ie || [];
    const income = ieList
      .filter((e) => e.entry_type === "income")
      .reduce((s, e) => s + e.amount, 0);
    const expense = ieList
      .filter((e) => e.entry_type === "expense")
      .reduce((s, e) => s + e.amount, 0);
    const uList = unitsData || [];

    setKpi({ expected, collected, outstanding, netProfit: income - expense });
    setRecent(payments || []);
    setUnits({
      total: uList.length,
      occupied: uList.filter((u) => u.status === "occupied").length,
      vacant: uList.filter((u) => u.status === "vacant").length,
    });
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleModalSaved = (msg) => {
    setModal(null);
    showToast(msg);
    load();
  };

  const kpiCards = [
    {
      label: "Total Expected",
      value: fmtBDT(kpi.expected),
      sub: `${monthLabel(month)}`,
      accent: true,
    },
    { label: "Collected", value: fmtBDT(kpi.collected), sub: "This month" },
    {
      label: "Outstanding",
      value: fmtBDT(kpi.outstanding),
      sub: "Pending",
      danger: true,
    },
    {
      label: "Net Profit",
      value: fmtBDT(kpi.netProfit),
      sub: "All time",
      profit: true,
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: C.surface,
        minHeight: "100%",
        paddingBottom: 24,
      }}
    >
      <style>{`@keyframes slideUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Month selector */}
      <div
        style={{
          padding: "12px 16px 0",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          Billing Month:
        </span>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            fontSize: 13,
            color: C.text,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            background: "#fff",
          }}
        />
      </div>

      {/* KPI cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "12px 16px 0",
        }}
      >
        {kpiCards.map((card, i) => (
          <div
            key={i}
            style={{
              background: card.accent ? C.primary : C.card,
              borderRadius: 18,
              padding: 16,
              border: card.accent ? "none" : `0.5px solid ${C.border}`,
              boxShadow: card.accent
                ? "0 4px 20px rgba(26,107,74,0.18)"
                : "none",
              animation: `fadeIn .25s ease ${i * 0.06}s both`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                marginBottom: 6,
                color: card.accent ? "rgba(255,255,255,0.65)" : C.textMuted,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: loading ? 16 : 20,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: card.accent
                  ? "#fff"
                  : card.danger
                    ? C.danger
                    : card.profit && kpi.netProfit < 0
                      ? C.danger
                      : C.text,
              }}
            >
              {loading ? "Loading…" : card.value}
            </div>
            <div
              style={{
                fontSize: 11,
                marginTop: 4,
                color: card.accent ? "rgba(255,255,255,0.55)" : C.textMuted,
              }}
            >
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Unit occupancy strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: "10px 16px 0",
        }}
      >
        {[
          { label: "Total Units", value: units.total, bg: C.card },
          {
            label: "Occupied",
            value: units.occupied,
            bg: C.primaryLight,
            color: C.primary,
          },
          {
            label: "Vacant",
            value: units.vacant,
            bg: "#fff8e6",
            color: C.warning,
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: s.bg,
              borderRadius: 12,
              padding: "10px 10px",
              border: `0.5px solid ${C.border}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: s.color || C.text,
              }}
            >
              {loading ? "—" : s.value}
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

      {/* Quick actions */}
      <div style={{ padding: "16px 16px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            marginBottom: 10,
          }}
        >
          Quick Actions
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <button
            onClick={() => setModal("payment")}
            style={{
              background: C.primary,
              border: "none",
              borderRadius: 16,
              padding: "16px 14px",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              💵
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Add Payment
            </span>
          </button>
          <button
            onClick={() => setModal("expense")}
            style={{
              background: C.accentLight,
              border: "none",
              borderRadius: 16,
              padding: "16px 14px",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(240,165,0,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              ➕
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#7a5800" }}>
              Add Expense
            </span>
          </button>
          <button
            onClick={() => onNavigate?.("units")}
            style={{
              background: C.primaryLight,
              border: "none",
              borderRadius: 16,
              padding: "16px 14px",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(26,107,74,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🧑‍🤝‍🧑
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
              Assign Renter
            </span>
          </button>
          <button
            onClick={() => onNavigate?.("billing")}
            style={{
              background: C.primaryLight,
              border: "none",
              borderRadius: 16,
              padding: "16px 14px",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(26,107,74,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              📡
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
              Add Meter Reading
            </span>
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ padding: "18px 16px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            marginBottom: 10,
          }}
        >
          Recent Payments
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24, color: C.textMuted }}>
            Loading…
          </div>
        ) : recent.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: C.textMuted,
              fontSize: 13,
            }}
          >
            No payments recorded yet this month.
          </div>
        ) : (
          recent.map((pmt, i) => {
            const name = pmt.renters?.full_name || "—";
            const unit = pmt.bills?.unit_name_snapshot || "—";
            return (
              <div
                key={pmt.id}
                style={{
                  background: C.card,
                  borderRadius: 14,
                  border: `0.5px solid ${C.border}`,
                  padding: "13px 14px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  animation: `fadeIn .2s ease ${i * 0.05}s both`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: avatarColor(name),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initials(name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {unit} · {fmtDate(pmt.payment_date)}
                  </div>
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: C.primary }}
                >
                  +{fmtBDT(pmt.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {modal === "payment" && (
        <QuickPaymentModal
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
      {modal === "expense" && (
        <QuickExpenseModal
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
