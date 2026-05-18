import { useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
  { id: "units", label: "Units", icon: "ti-building" },
  { id: "billing", label: "Billing", icon: "ti-bolt" },
  { id: "ledger", label: "Ledger", icon: "ti-book" },
  { id: "financials", label: "Financials", icon: "ti-report-money" },
];

const PAGE_META = {
  dashboard: { title: "Dashboard", subtitle: "Overview & quick actions", icon: "ti-layout-dashboard" },
  units: { title: "Units & Renters", subtitle: "Manage your property", icon: "ti-building" },
  billing: { title: "Meter & Billing", subtitle: "Monthly billing cycle", icon: "ti-bolt" },
  ledger: { title: "Ledger", subtitle: "Payment history", icon: "ti-book" },
  financials: { title: "Financials", subtitle: "Income & expenses", icon: "ti-report-money" },
};

const COLORS = {
  primary: "#1a6b4a",
  primaryLight: "#e8f5ee",
  primaryMid: "#2d9e6e",
  accent: "#f0a500",
  accentLight: "#fff8e6",
  surface: "#f7f9f7",
  card: "#ffffff",
  border: "rgba(26,107,74,0.13)",
  text: "#1a2e22",
  textMuted: "#5a7a6a",
  danger: "#c0392b",
  dangerLight: "#fdf0ee",
};

const styles = {
  shell: {
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    background: COLORS.surface,
    minHeight: "100vh",
    maxWidth: 420,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    background: COLORS.primary,
    padding: "14px 20px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
  },
  appName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.75,
    marginBottom: 1,
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
  },
  pageSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: 80,
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 420,
    background: "#ffffff",
    borderTop: `1px solid ${COLORS.border}`,
    display: "flex",
    zIndex: 200,
    boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
  },
  navItem: (active) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 4px 8px",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    position: "relative",
    transition: "all 0.18s ease",
  }),
  navIcon: (active) => ({
    fontSize: active ? 22 : 20,
    color: active ? COLORS.primary : "#9aada4",
    transition: "all 0.18s ease",
    lineHeight: 1,
  }),
  navLabel: (active) => ({
    fontSize: 10,
    fontWeight: active ? 700 : 400,
    color: active ? COLORS.primary : "#9aada4",
    marginTop: 3,
    letterSpacing: active ? "0.01em" : 0,
    transition: "all 0.18s ease",
  }),
  navDot: {
    position: "absolute",
    top: 8,
    width: 32,
    height: 3,
    background: COLORS.primary,
    borderRadius: "0 0 4px 4px",
  },
  // Dashboard
  dashGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    padding: "16px 16px 0",
  },
  statCard: (accent) => ({
    background: accent ? COLORS.primary : COLORS.card,
    borderRadius: 16,
    padding: "16px",
    border: accent ? "none" : `0.5px solid ${COLORS.border}`,
    boxShadow: accent ? "0 4px 16px rgba(26,107,74,0.18)" : "none",
  }),
  statLabel: (accent) => ({
    fontSize: 11,
    fontWeight: 600,
    color: accent ? "rgba(255,255,255,0.7)" : COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  }),
  statValue: (accent) => ({
    fontSize: 22,
    fontWeight: 700,
    color: accent ? "#ffffff" : COLORS.text,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  }),
  statSub: (accent) => ({
    fontSize: 11,
    color: accent ? "rgba(255,255,255,0.55)" : COLORS.textMuted,
    marginTop: 4,
  }),
  section: {
    padding: "20px 16px 0",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    marginBottom: 12,
  },
  quickActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  actionBtn: (color) => ({
    background: color === "primary" ? COLORS.primary : COLORS.accentLight,
    border: "none",
    borderRadius: 14,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    cursor: "pointer",
    textAlign: "left",
  }),
  actionIcon: (color) => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    background: color === "primary" ? "rgba(255,255,255,0.2)" : "rgba(240,165,0,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: color === "primary" ? "#fff" : COLORS.accent,
  }),
  actionLabel: (color) => ({
    fontSize: 13,
    fontWeight: 700,
    color: color === "primary" ? "#fff" : "#7a5800",
    lineHeight: 1.2,
  }),
  recentRow: {
    background: COLORS.card,
    borderRadius: 14,
    padding: "13px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: `0.5px solid ${COLORS.border}`,
    marginBottom: 8,
  },
  avatar: (color) => ({
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: color,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    marginRight: 12,
    flexShrink: 0,
  }),
  badge: (type) => ({
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 20,
    background: type === "paid" ? "#e8f5ee" : type === "partial" ? "#fff8e6" : "#fdf0ee",
    color: type === "paid" ? "#1a6b4a" : type === "partial" ? "#7a5800" : "#c0392b",
  }),
  // Units placeholder
  placeholderCard: {
    background: COLORS.card,
    borderRadius: 16,
    padding: 24,
    margin: "16px",
    border: `0.5px solid ${COLORS.border}`,
    textAlign: "center",
  },
  placeholderIcon: {
    fontSize: 48,
    color: COLORS.border,
    marginBottom: 12,
    display: "block",
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 6,
  },
  placeholderSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  pillBtn: {
    background: COLORS.primary,
    color: "#fff",
    border: "none",
    borderRadius: 50,
    padding: "12px 28px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.01em",
  },
  comingSoonBadge: {
    display: "inline-block",
    background: COLORS.primaryLight,
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 12px",
    borderRadius: 20,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 16,
  },
};

// ─── PAGE COMPONENTS ──────────────────────────────────────────────────────────

function DashboardPage() {
  const stats = [
    { label: "Total Expected", value: "৳ 42,500", sub: "This month", accent: true },
    { label: "Collected", value: "৳ 28,000", sub: "6 of 9 paid" },
    { label: "Outstanding", value: "৳ 14,500", sub: "3 renters", danger: true },
    { label: "Net Profit", value: "৳ 19,200", sub: "After expenses" },
  ];

  const recent = [
    { name: "Karim Uddin", unit: "Unit 3", amount: "৳ 4,800", type: "paid", initials: "KU", color: "#1a6b4a" },
    { name: "Nasrin Begum", unit: "Unit 1", amount: "৳ 2,000", type: "partial", initials: "NB", color: "#e67e22" },
    { name: "Rahim Ali", unit: "Unit 5", amount: "—", type: "unpaid", initials: "RA", color: "#c0392b" },
  ];

  return (
    <div>
      <div style={styles.dashGrid}>
        {stats.map((s, i) => (
          <div key={i} style={styles.statCard(s.accent)}>
            <div style={styles.statLabel(s.accent)}>{s.label}</div>
            <div style={{ ...styles.statValue(s.accent), color: s.danger ? COLORS.danger : s.accent ? "#fff" : COLORS.text }}>
              {s.value}
            </div>
            <div style={styles.statSub(s.accent)}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Quick Actions</div>
        <div style={styles.quickActions}>
          <button style={styles.actionBtn("primary")}>
            <div style={styles.actionIcon("primary")}>
              <i className="ti ti-cash" aria-hidden="true" />
            </div>
            <span style={styles.actionLabel("primary")}>Record Payment</span>
          </button>
          <button style={styles.actionBtn("accent")}>
            <div style={styles.actionIcon("accent")}>
              <i className="ti ti-receipt" aria-hidden="true" />
            </div>
            <span style={styles.actionLabel("accent")}>Add Expense</span>
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Recent Activity</div>
        {recent.map((r, i) => (
          <div key={i} style={styles.recentRow}>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={styles.avatar(r.color)}>{r.initials}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{r.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{r.unit}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{r.amount}</div>
              <span style={styles.badge(r.type)}>{r.type === "paid" ? "Paid" : r.type === "partial" ? "Partial" : "Unpaid"}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

function PlaceholderPage({ icon, title, description, taskNum }) {
  return (
    <div style={styles.placeholderCard}>
      <span style={styles.comingSoonBadge}>Task {taskNum} — Coming Soon</span>
      <i className={`ti ${icon}`} style={styles.placeholderIcon} aria-hidden="true" />
      <div style={styles.placeholderTitle}>{title}</div>
      <div style={styles.placeholderSub}>{description}</div>
      <button style={styles.pillBtn}>
        <i className="ti ti-lock" style={{ marginRight: 6 }} aria-hidden="true" />
        Pending Approval
      </button>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function RentFlowApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const meta = PAGE_META[activePage];

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "units":
        return (
          <PlaceholderPage
            icon="ti-building"
            title="Units & Renters"
            description="Add units, onboard renters with NID & contacts, handle move-outs and unit transfers."
            taskNum={3}
          />
        );
      case "billing":
        return (
          <PlaceholderPage
            icon="ti-bolt"
            title="Meter Entry & Billing Engine"
            description="Input water & electricity meter readings. Automatically generate all monthly bills using the mathematical engine."
            taskNum={4}
          />
        );
      case "ledger":
        return (
          <PlaceholderPage
            icon="ti-book"
            title="Renter Ledger"
            description="Per-renter transaction history. Track charges, payments, and running balances with full history."
            taskNum={5}
          />
        );
      case "financials":
        return (
          <PlaceholderPage
            icon="ti-report-money"
            title="Owner Financials"
            description="Income & expense tracker. Auto-log rent payments as income. Track repairs, maintenance, and net profit."
            taskNum={6}
          />
        );
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div style={styles.shell}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.appName}>RentFlow</span>
          <span style={styles.pageTitle}>{meta.title}</span>
          <span style={styles.pageSubtitle}>{meta.subtitle}</span>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.iconBtn} aria-label="Print bills">
            <i className="ti ti-printer" aria-hidden="true" />
          </button>
          <button style={styles.iconBtn} aria-label="Settings">
            <i className="ti ti-settings" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main style={styles.content}>
        {renderPage()}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav style={styles.bottomNav} aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              style={styles.navItem(active)}
              onClick={() => setActivePage(item.id)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              {active && <span style={styles.navDot} />}
              <i className={`ti ${item.icon}`} style={styles.navIcon(active)} aria-hidden="true" />
              <span style={styles.navLabel(active)}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
