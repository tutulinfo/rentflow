# RentFlow — Complete Deployment Guide
## From Zero to Live in 30 Minutes

---

## STEP 1: Create Your Supabase Project (Free Tier)

1. Go to https://supabase.com → Sign Up → New Project
2. Choose a project name: `rentflow`
3. Set a strong database password (save it)
4. Choose the region closest to Bangladesh (Singapore)
5. Wait ~2 minutes for the project to spin up

### Run the Database Schema
1. In Supabase → go to **SQL Editor**
2. Paste the entire contents of `RentFlow_Task2_Schema.sql`
3. Click **Run** — all 8 tables, indexes, triggers, RLS policies, and views will be created

### Create Your Owner Account
1. Supabase → **Authentication** → **Users** → **Invite User**
2. Enter your email address → Send invite
3. Check your email → Set your password
4. This is the only account that can access RentFlow

### Get Your API Keys
1. Supabase → **Settings** → **API**
2. Copy **Project URL** and **anon public** key
3. Keep these ready for Step 3

---

## STEP 2: Set Up the React Project

```bash
# Create new Vite + React project
npm create vite@latest rentflow -- --template react
cd rentflow

# Install all dependencies
npm install
npm install @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer

# Set up Tailwind (optional — app uses inline styles)
npx tailwindcss init -p
```

### Folder Structure
```
rentflow/
├── src/
│   ├── App.jsx                    ← Task 10 (root shell)
│   ├── main.jsx                   ← Vite entry (unchanged)
│   └── pages/
│       ├── DashboardPage.jsx      ← Task 7
│       ├── UnitsRentersPage.jsx   ← Task 3
│       ├── MeterBillingPage.jsx   ← Task 4
│       ├── LedgerPage.jsx         ← Task 5
│       ├── FinancialsPage.jsx     ← Task 6
│       ├── PrintBillsPage.jsx     ← Task 8
│       └── SettingsPage.jsx       ← Task 9
├── .env.local                     ← Your secret keys (never commit!)
├── .gitignore
└── package.json
```

---

## STEP 3: Configure Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ Never commit `.env.local` to Git. It's already in `.gitignore` by default.

---

## STEP 4: Copy the Source Files

Copy each task file into the correct location:

| File Delivered          | Copy To                              |
|-------------------------|--------------------------------------|
| RentFlow_Task10_App.jsx → | src/App.jsx                        |
| RentFlow_Task7_Dashboard.jsx → | src/pages/DashboardPage.jsx   |
| RentFlow_Task3_UnitsRenters.jsx → | src/pages/UnitsRentersPage.jsx|
| RentFlow_Task4_BillingEngine.jsx → | src/pages/MeterBillingPage.jsx|
| RentFlow_Task5_LedgerPayments.jsx → | src/pages/LedgerPage.jsx     |
| RentFlow_Task6_Financials.jsx → | src/pages/FinancialsPage.jsx    |
| RentFlow_Task8_PrintBills.jsx → | src/pages/PrintBillsPage.jsx    |
| RentFlow_Task9_Settings.jsx → | src/pages/SettingsPage.jsx        |

---

## STEP 5: Update main.jsx

Replace `src/main.jsx` with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Google Fonts — DM Sans
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## STEP 6: Test Locally

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Test Checklist
- [ ] Login screen appears
- [ ] Sign in with your Supabase account
- [ ] Add a unit (Units tab)
- [ ] Onboard a renter
- [ ] Go to Billing → select month → enter readings → generate bills
- [ ] Go to Ledger → record a payment
- [ ] Check Financials → verify income auto-logged
- [ ] Check Dashboard → KPI cards show live numbers
- [ ] Go to header → Print icon → select month → Print
- [ ] Settings → change waste fee → save

---

## STEP 7: Deploy to Vercel (Free Tier)

### Option A: Via GitHub (Recommended)
```bash
# Push to GitHub first
git init
git add .
git commit -m "RentFlow v1.0"
git remote add origin https://github.com/yourusername/rentflow.git
git push -u origin main
```

1. Go to https://vercel.com → Sign Up with GitHub
2. Click **New Project** → Import your `rentflow` repo
3. Framework: **Vite** (auto-detected)
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**
6. Your app is live at `https://rentflow-xxx.vercel.app`

### Option B: Direct CLI
```bash
npm install -g vercel
vercel login
vercel --prod
# Follow prompts — add env vars when asked
```

---

## STEP 8: Access on Mobile

Since RentFlow is a Progressive Web App:
1. Open your Vercel URL on your phone
2. Safari/Chrome → Share → **Add to Home Screen**
3. RentFlow now behaves like a native app

---

## Monthly Workflow (After Deployment)

```
1st of month:
  → Open RentFlow on phone
  → Billing tab → Select month → Enter main meter reading
  → Walk to each sub-meter → Enter readings
  → Preview bills → Confirm
  → Header → 🖨️ Print → Select month → Print → Cut receipts

Throughout month:
  → Ledger tab → Select renter → Record Payment
  → Dashboard shows live outstanding balance

End of month:
  → Dashboard → check Outstanding
  → Financials → verify Net Profit
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails | Check email was invited in Supabase Auth |
| Data not saving | Check `.env.local` keys are correct |
| RLS error | Ensure you are signed in (session active) |
| Bills not generating | Ensure at least 1 active renter exists |
| Print layout broken | Use Chrome/Edge — best print CSS support |

---

## Tech Stack Summary

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | React 18 + Vite | Free |
| Styling | Inline styles + DM Sans font | Free |
| Database | Supabase (PostgreSQL) | Free (500MB) |
| Auth | Supabase Auth | Free |
| Hosting | Vercel | Free |
| **Total** | | **$0/month** |

---

*RentFlow v1.0 — Built by RentFlow Dev Agency*
*All 10 tasks delivered and approved.*
