# 🏠 RentFlow
### Mobile-First Property Management System

Built for individual landlords managing multi-unit properties in Bangladesh.  
Automates billing, tracks payments, and generates printable A4 receipts.

---

## ⚡ Quick Start

### 1. Set up Supabase (free)
- Create a free project at https://supabase.com
- Go to **SQL Editor** → paste & run `database/schema.sql`
- Go to **Authentication → Users** → invite your email
- Go to **Settings → API** → copy your URL and anon key

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

### 3. Install & run locally
```bash
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Deploy to Vercel (free)
- Push this repo to GitHub
- Go to https://vercel.com → Import repository
- Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Deploy ✅

---

## 📁 Project Structure

```
rentflow/
├── src/
│   ├── App.jsx                      # Root shell + auth + navigation
│   ├── main.jsx                     # Vite entry point
│   └── pages/
│       ├── DashboardPage.jsx        # Live KPI cards + quick actions
│       ├── UnitsRentersPage.jsx     # Unit + renter lifecycle
│       ├── MeterBillingPage.jsx     # Meter entry + billing engine
│       ├── LedgerPage.jsx           # Payments + renter ledger
│       ├── FinancialsPage.jsx       # Income & expense tracker
│       ├── PrintBillsPage.jsx       # A4 bill generator
│       └── SettingsPage.jsx         # Global rate configuration
├── database/
│   └── schema.sql                   # Supabase schema (8 tables + RLS)
├── index.html
├── vite.config.js
├── package.json
└── .env.local                       # Your API keys (gitignored)
```
