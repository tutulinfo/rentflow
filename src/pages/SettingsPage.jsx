/**
 * RentFlow – Task 9: Global Settings Screen
 *
 * FEATURES:
 *   - Adjustable Per Unit Rate (electricity + water combined rate)
 *   - Adjustable Waste Fee (flat per unit per month)
 *   - Currency symbol setting
 *   - Changes ONLY affect current & future billing cycles
 *   - Historical bills are immutable (rates snapshotted at billing time)
 *   - Change history log (shown in UI for transparency)
 *   - App info section
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
  primaryMid:   "#2d9e6e",
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

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: type === "success" ? C.primary : C.danger, color: "#fff", padding: "12px 24px", borderRadius: 50, fontSize: 14, fontWeight: 600, zIndex: 2000, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.18)", animation: "slideUp .25s ease" }}>
      {type === "success" ? "✓ " : "✗ "}{message}
    </div>
  );
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 18, border: `0.5px solid ${C.border}`, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function RateField({ label, description, value, onChange, prefix, suffix }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted, fontWeight: 700, pointerEvents: "none" }}>{prefix}</span>}
        <input
          type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: prefix ? "14px 48px 14px 30px" : "14px 48px 14px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", background: "#fff" }}
          onFocus={e => e.target.style.borderColor = C.primaryMid}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted, fontWeight: 700, pointerEvents: "none" }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings,  setSettings]  = useState(null);
  const [rate,      setRate]      = useState("");
  const [waste,     setWaste]     = useState("");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [changed,   setChanged]   = useState(false);
  const [toast,     setToast]     = useState({ msg: "", type: "success" });
  const [history,   setHistory]   = useState([]); // local change log

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast({ msg: "", type: "success" }), 3500); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("global_settings").select("*").eq("id", 1).single();
      if (data) {
        setSettings(data);
        setRate(data.per_unit_rate.toString());
        setWaste(data.waste_fee.toString());
      }
      setLoading(false);
    })();
  }, []);

  // Detect changes
  useEffect(() => {
    if (!settings) return;
    const rateChanged  = parseFloat(rate)  !== parseFloat(settings.per_unit_rate);
    const wasteChanged = parseFloat(waste) !== parseFloat(settings.waste_fee);
    setChanged(rateChanged || wasteChanged);
  }, [rate, waste, settings]);

  const save = async () => {
    if (!changed) return;
    const newRate  = parseFloat(rate);
    const newWaste = parseFloat(waste);
    if (isNaN(newRate)  || newRate  <= 0) { showToast("Per unit rate must be > 0", "error"); return; }
    if (isNaN(newWaste) || newWaste <  0) { showToast("Waste fee cannot be negative", "error"); return; }

    setSaving(true);
    const { error } = await supabase.from("global_settings").update({
      per_unit_rate: newRate,
      waste_fee:     newWaste,
      updated_at:    new Date().toISOString(),
    }).eq("id", 1);

    if (error) { setSaving(false); showToast(error.message, "error"); return; }

    // Log change locally
    const logEntry = {
      ts: new Date().toISOString(),
      oldRate:  settings.per_unit_rate,
      newRate,
      oldWaste: settings.waste_fee,
      newWaste,
    };
    setHistory(prev => [logEntry, ...prev]);
    setSettings(s => ({ ...s, per_unit_rate: newRate, waste_fee: newWaste }));
    setSaving(false);
    setChanged(false);
    showToast("Settings saved. New rates apply from next billing cycle.");
  };

  const reset = () => {
    if (!settings) return;
    setRate(settings.per_unit_rate.toString());
    setWaste(settings.waste_fee.toString());
    setChanged(false);
  };

  // Preview: what a combined bill charge looks like
  const previewElec = (10 + (parseFloat(rate) || 0)) * (parseFloat(rate) || 0);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, minHeight: "100%", paddingBottom: 24 }}>
      <style>{`@keyframes slideUp { from { opacity:0;transform:translate(-50%,10px) } to { opacity:1;transform:translate(-50%,0) } }`}</style>

      <div style={{ padding: "14px 16px 0" }}>

        {/* Warning banner */}
        <div style={{ background: C.warningLight, border: `1px solid ${C.warning}`, borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 13, color: C.warning, fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
            Rate changes only affect <strong>future billing cycles</strong>. All previously generated bills are permanently locked with their original rates.
          </p>
        </div>

        {/* Rate settings */}
        <SectionCard icon="⚡" title="Electricity & Water Rate" subtitle="Applied per combined unit (electricity + water share)">
          {loading ? <div style={{ color: C.textMuted, fontSize: 13 }}>Loading…</div> : (
            <>
              <RateField
                label="Per Unit Rate"
                description="Charged per unit of (electricity units + water share). Covers both electricity and water in one combined rate."
                value={rate}
                onChange={setRate}
                prefix="৳"
                suffix="/unit"
              />
              <div style={{ background: C.primaryLight, borderRadius: 10, padding: "10px 13px", fontSize: 12, color: C.primary, fontWeight: 600 }}>
                💡 Example: If a renter uses 30 elec. units + 15 water share = 45 units × ৳{rate}/unit = ৳{(45 * (parseFloat(rate) || 0)).toFixed(2)}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard icon="🗑" title="Waste Management Fee" subtitle="Flat monthly fee charged to every active unit">
          {loading ? <div style={{ color: C.textMuted, fontSize: 13 }}>Loading…</div> : (
            <RateField
              label="Waste Fee"
              description="Fixed fee added to every renter's monthly bill regardless of usage."
              value={waste}
              onChange={setWaste}
              prefix="৳"
              suffix="/month"
            />
          )}
        </SectionCard>

        {/* Save / Reset buttons */}
        {changed && (
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={reset} style={{ flex: 1, padding: "13px", background: "transparent", border: `1.5px solid ${C.borderMid}`, borderRadius: 14, fontSize: 14, fontWeight: 700, color: C.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reset</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: "13px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>
              {saving ? "Saving…" : "✓ Save Settings"}
            </button>
          </div>
        )}
        {!changed && !loading && (
          <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
            ✓ Settings are up to date
          </div>
        )}

        {/* Change history */}
        {history.length > 0 && (
          <SectionCard icon="🕑" title="Change History" subtitle="Rate changes made this session">
            {history.map((h, i) => (
              <div key={i} style={{ background: C.surface, borderRadius: 12, padding: "11px 13px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{fmtDate(h.ts)}</div>
                {h.oldRate !== h.newRate && (
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 3 }}>
                    Rate: <span style={{ color: C.danger, fontWeight: 700 }}>৳{h.oldRate}</span> → <span style={{ color: C.primary, fontWeight: 700 }}>৳{h.newRate}</span> per unit
                  </div>
                )}
                {h.oldWaste !== h.newWaste && (
                  <div style={{ fontSize: 13, color: C.text }}>
                    Waste: <span style={{ color: C.danger, fontWeight: 700 }}>৳{h.oldWaste}</span> → <span style={{ color: C.primary, fontWeight: 700 }}>৳{h.newWaste}</span>/month
                  </div>
                )}
              </div>
            ))}
          </SectionCard>
        )}

        {/* App info */}
        <SectionCard icon="ℹ️" title="App Information" subtitle="">
          {[
            ["App Name",    "RentFlow"],
            ["Version",     "1.0.0"],
            ["Built For",   "Single-Owner Property Management"],
            ["Currency",    "BDT (৳ Bangladeshi Taka"],
            ["Last Updated", settings ? fmtDate(settings.updated_at) : "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right", maxWidth: "60%" }}>{v}</span>
            </div>
          ))}
        </SectionCard>

      </div>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
