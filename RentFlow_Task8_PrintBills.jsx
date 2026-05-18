/**
 * RentFlow – Task 8: A4 Bill Generator & Print Layout
 *
 * PRINT SPEC (from PRD):
 *   - @media print hides all navigation
 *   - Bills rendered in a 2-column × 3-row grid (6 bills per A4 page)
 *   - Each bill slip is cut-ready with a dashed border
 *   - Contains: renter name, unit, billing month, full breakdown, total
 *
 * SCREEN:
 *   - Month selector to pick billing cycle
 *   - Preview of all bills for that month (same layout, scrollable)
 *   - "Print Bills" button triggers window.print()
 */

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const C = {
  primary:      "#1a6b4a",
  primaryLight: "#e8f5ee",
  surface:      "#f7f9f7",
  card:         "#ffffff",
  border:       "rgba(26,107,74,0.13)",
  text:         "#1a2e22",
  textMuted:    "#5a7a6a",
  danger:       "#c0392b",
};

const fmtBDT     = (n) => `৳ ${Number(n || 0).toFixed(2)}`;
const thisMonth  = () => new Date().toISOString().slice(0, 7);
const monthLabel = (ym) => { if (!ym) return ""; const [y, m] = ym.split("-"); return new Date(y, m - 1).toLocaleString("en-BD", { month: "long", year: "numeric" }); };

// ─── Individual Bill Slip ──────────────────────────────────────────────────
function BillSlip({ bill, forPrint = false }) {
  const outstanding = bill.total_bill - bill.amount_paid;
  return (
    <div style={{
      background: "#fff",
      border: forPrint ? "1px dashed #999" : `1px solid ${C.border}`,
      borderRadius: forPrint ? 0 : 14,
      padding: "14px 14px 12px",
      pageBreakInside: "avoid",
      breakInside: "avoid",
      fontFamily: "'DM Sans', Arial, sans-serif",
    }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #1a6b4a", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1a6b4a", letterSpacing: "0.05em" }}>RENTFLOW</div>
            <div style={{ fontSize: 10, color: "#5a7a6a", marginTop: 1 }}>Monthly Bill Receipt</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#5a7a6a", textTransform: "uppercase" }}>Period</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1a2e22" }}>{monthLabel(bill.billing_month)}</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2e22" }}>{bill.renter_name_snapshot}</div>
          <div style={{ fontSize: 11, color: "#5a7a6a" }}>{bill.unit_name_snapshot}</div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ marginBottom: 10 }}>
        {[
          ["Room Rent",       fmtBDT(bill.room_rent)],
          [`Electricity (${bill.electricity_units_used?.toFixed(1)} u)`, fmtBDT(bill.electricity_bill)],
          [`Water Share (${Number(bill.water_share || 0).toFixed(2)} u)`, "—included—"],
          ["Waste Fee",       fmtBDT(bill.waste_fee)],
          ["Previous Due",    fmtBDT(bill.previous_due)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: "0.5px dashed #eee" }}>
            <span style={{ color: "#5a7a6a" }}>{k}</span>
            <span style={{ fontWeight: 600, color: "#1a2e22" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ background: "#e8f5ee", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a6b4a" }}>TOTAL DUE</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1a6b4a" }}>{fmtBDT(bill.total_bill)}</span>
      </div>

      {/* Payment status */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
        <span style={{ color: "#5a7a6a" }}>Paid: <strong style={{ color: "#1a6b4a" }}>{fmtBDT(bill.amount_paid)}</strong></span>
        <span style={{ color: outstanding > 0 ? "#c0392b" : "#1a6b4a", fontWeight: 700 }}>
          {outstanding > 0 ? `Balance: ${fmtBDT(outstanding)}` : "✓ CLEARED"}
        </span>
      </div>
    </div>
  );
}

// ─── MAIN PRINT PAGE ───────────────────────────────────────────────────────
export default function PrintBillsPage() {
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [bills,         setBills]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bills")
      .select("*")
      .eq("billing_month", selectedMonth)
      .order("unit_name_snapshot");
    setBills(data || []);
    setSearched(true);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, [selectedMonth]);

  const printBills = () => window.print();

  return (
    <>
      {/* ── Print styles (injected into head via <style> tag) ── */}
      <style>{`
        @media print {
          /* Hide everything except the print target */
          body > * { display: none !important; }
          #print-target { display: block !important; }
          #print-target { margin: 0; padding: 0; }

          .print-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 6mm !important;
            width: 100% !important;
            height: 287mm !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
          }

          .print-slip {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Every 6 slips = new A4 page */
          .print-slip:nth-child(6n+1) {
            page-break-before: always !important;
          }
          .print-slip:first-child {
            page-break-before: avoid !important;
          }

          @page {
            size: A4;
            margin: 0;
          }
        }

        /* Hide print target on screen (it's rendered separately) */
        #print-target { display: none; }

        @keyframes slideUp { from { opacity:0;transform:translate(-50%,10px) } to { opacity:1;transform:translate(-50%,0) } }
        @keyframes fadeIn  { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }
      `}</style>

      {/* ── Hidden print-only div ── */}
      <div id="print-target">
        <div className="print-grid">
          {bills.map(bill => (
            <div key={bill.id} className="print-slip">
              <BillSlip bill={bill} forPrint={true} />
            </div>
          ))}
          {/* Fill remaining slots on last page with blank slips */}
          {bills.length % 6 !== 0 && Array.from({ length: 6 - (bills.length % 6) }).map((_, i) => (
            <div key={`blank-${i}`} className="print-slip" style={{ border: "1px dashed #ddd", borderRadius: 0 }} />
          ))}
        </div>
      </div>

      {/* ── Screen UI ── */}
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%", paddingBottom: 24 }}>

        {/* Month selector + print button */}
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Select Billing Month</div>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <button onClick={printBills} disabled={bills.length === 0} style={{ width: "100%", padding: "14px", background: bills.length > 0 ? C.primary : "#ccc", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: bills.length > 0 ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              🖨️ Print {bills.length > 0 ? `${bills.length} Bills` : "(No Bills Found)"}
            </button>
          </div>
        </div>

        {/* Info box */}
        {bills.length > 0 && (
          <div style={{ margin: "12px 16px 0", background: C.primaryLight, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ fontSize: 13, color: C.primary, fontWeight: 600, flex: 1 }}>
              {bills.length} bills · {Math.ceil(bills.length / 6)} A4 page{Math.ceil(bills.length / 6) > 1 ? "s" : ""} · 2×3 grid · cut-ready
            </div>
          </div>
        )}

        {/* Preview heading */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
            {searched ? `Preview — ${monthLabel(selectedMonth)}` : "Bill Preview"}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading bills…</div>
          ) : searched && bills.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}` }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No bills found</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>No bills were generated for {monthLabel(selectedMonth)}. Run the billing engine first.</div>
            </div>
          ) : (
            /* 2-column preview grid (mirrors print layout) */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {bills.map((bill, i) => (
                <div key={bill.id} style={{ animation: `fadeIn .2s ease ${i * 0.04}s both` }}>
                  <BillSlip bill={bill} forPrint={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
