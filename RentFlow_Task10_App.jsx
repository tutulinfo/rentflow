/**
 * RentFlow – Task 10: Final App Assembly
 * App.jsx — Root component wiring all 9 pages together
 * with React Router v6, global auth guard, and print support.
 *
 * File structure expected:
 *   src/
 *     App.jsx                  ← this file
 *     pages/
 *       DashboardPage.jsx      ← Task 7
 *       UnitsRentersPage.jsx   ← Task 3
 *       MeterBillingPage.jsx   ← Task 4
 *       LedgerPage.jsx         ← Task 5
 *       FinancialsPage.jsx     ← Task 6
 *       PrintBillsPage.jsx     ← Task 8
 *       SettingsPage.jsx       ← Task 9
 *     main.jsx
 *   .env                       ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Pages
import DashboardPage    from "./pages/DashboardPage";
import UnitsRentersPage from "./pages/UnitsRentersPage";
import MeterBillingPage from "./pages/MeterBillingPage";
import LedgerPage       from "./pages/LedgerPage";
import FinancialsPage   from "./pages/FinancialsPage";
import PrintBillsPage   from "./pages/PrintBillsPage";
import SettingsPage     from "./pages/SettingsPage";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  primary:      "#1a6b4a",
  primaryLight: "#e8f5ee",
  surface:      "#f7f9f7",
  card:         "#ffffff",
  border:       "rgba(26,107,74,0.13)",
  text:         "#1a2e22",
  textMuted:    "#5a7a6a",
};

// ─── Navigation config ─────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  label: "Dashboard",  icon: "🏠", title: "Dashboard",       sub: "Overview & quick actions"  },
  { id: "units",      label: "Units",      icon: "🏘", title: "Units & Renters", sub: "Manage your property"      },
  { id: "billing",    label: "Billing",    icon: "⚡", title: "Meter & Billing", sub: "Monthly billing cycle"     },
  { id: "ledger",     label: "Ledger",     icon: "📒", title: "Ledger",          sub: "Payment history"           },
  { id: "financials", label: "Financials", icon: "📊", title: "Financials",      sub: "Income & expenses"         },
];

// ─── AUTH: Simple Supabase email/password login ────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const login = async () => {
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
    else onLogin();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.primary, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>RentFlow</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>Property Management System</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 22, margin: "0 0 22px" }}>Sign In</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="••••••••" style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</p>}
        <button onClick={login} disabled={loading} style={{ width: "100%", padding: "14px", background: C.primary, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? "Signing in…" : "Sign In →"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP SHELL ────────────────────────────────────────────────────────
function AppShell() {
  const [activePage, setActivePage] = useState("dashboard");
  const [showPrint,  setShowPrint]  = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [session,    setSession]    = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <LoginScreen onLogin={() => {}} />;

  const meta = NAV.find(n => n.id === activePage) || NAV[0];

  const renderPage = () => {
    if (showPrint)    return <PrintBillsPage />;
    if (showSettings) return <SettingsPage />;
    switch (activePage) {
      case "dashboard":  return <DashboardPage />;
      case "units":      return <UnitsRentersPage />;
      case "billing":    return <MeterBillingPage />;
      case "ledger":     return <LedgerPage />;
      case "financials": return <FinancialsPage />;
      default:           return <DashboardPage />;
    }
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.surface, maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* ── Global print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        input, button, select { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* ── Header ── */}
      <header className="no-print" style={{ background: C.primary, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.13em" }}>RentFlow</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
            {showPrint ? "Print Bills" : showSettings ? "Settings" : meta.title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            {showPrint ? "A4 print layout — 6 bills per page" : showSettings ? "Global rates & configuration" : meta.sub}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowPrint(p => !p); setShowSettings(false); }} style={{ width: 38, height: 38, borderRadius: "50%", background: showPrint ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Print Bills">🖨️</button>
          <button onClick={() => { setShowSettings(s => !s); setShowPrint(false); }} style={{ width: 38, height: 38, borderRadius: "50%", background: showSettings ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Settings">⚙️</button>
          <button onClick={signOut} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Sign Out">🚪</button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        {renderPage()}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="no-print" style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 200, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
        {NAV.map(item => {
          const active = activePage === item.id && !showPrint && !showSettings;
          return (
            <button key={item.id} onClick={() => { setActivePage(item.id); setShowPrint(false); setShowSettings(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px 8px", cursor: "pointer", border: "none", background: "transparent", position: "relative" }}>
              {active && <span style={{ position: "absolute", top: 0, width: 32, height: 3, background: C.primary, borderRadius: "0 0 4px 4px" }} />}
              <span style={{ fontSize: active ? 22 : 20, lineHeight: 1, transition: "font-size .18s" }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.primary : C.textMuted, marginTop: 3, transition: "all .18s" }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default AppShell;
