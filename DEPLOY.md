# WageTheft.live — Deployment Guide
# Your Supabase project is already configured.
# You only need to complete 2 missing values then deploy.
# ═══════════════════════════════════════════════════════


## YOUR SUPABASE PROJECT IS ALREADY SET
## ═══════════════════════════════════════

Project URL:  https://mkdjbifjdnncoawtnlsg.supabase.co
Anon key:     sb_publishable_DKAArG-VU_slgoIcxDAFXg_Ep_QTyuE
DOL API key:  sgS7mHSijkuGNxC4qNkxOeIFKWwruqo2Xs3jle5pv9M

Still needed (2 values):
  1. SUPABASE_SERVICE_KEY  — see Step 1 below (30 seconds)
  2. CRON_SECRET           — generate any random string (30 seconds)


## STEP 1 — Get your service role key (2 minutes)
## ═══════════════════════════════════════

The anon key you provided is for the browser (read-only).
The cron job needs the service_role key (write access) to save data.

1. Go to: https://supabase.com/dashboard/project/mkdjbifjdnncoawtnlsg/settings/api
2. Scroll to "Project API keys"
3. Copy the "service_role" key (it starts with "eyJ...")
4. This is your SUPABASE_SERVICE_KEY


## STEP 2 — Run the database schema (3 minutes)
## ═══════════════════════════════════════

1. Go to: https://supabase.com/dashboard/project/mkdjbifjdnncoawtnlsg/editor
2. Paste the entire contents of supabase/schema.sql
3. Click "Run"
4. You should see: "Success. No rows returned"

This creates 3 tables: violations, stats, cron_log
And sets up full-text search, indexes, and row-level security.


## STEP 3 — Push to GitHub (3 minutes)
## ═══════════════════════════════════════

git init
git add .
git commit -m "WageTheft.live — production ready"

# Create new repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wagetheft-live
git push -u origin main


## STEP 4 — Deploy on Vercel (5 minutes)
## ═══════════════════════════════════════

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Framework: Next.js (auto-detected)

3. Add ALL 5 Environment Variables exactly as shown:

   Variable                       Value
   ─────────────────────────────────────────────────────────────────────
   NEXT_PUBLIC_SUPABASE_URL       https://mkdjbifjdnncoawtnlsg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  sb_publishable_DKAArG-VU_slgoIcxDAFXg_Ep_QTyuE
   SUPABASE_SERVICE_KEY           sb_secret_-l-9Cp41Kf7fujnkgCrhXg_SwlvLgsk
   CRON_SECRET                    [any random 32-char string]
   DOL_API_KEY                    sgS7mHSijkuGNxC4qNkxOeIFKWwruqo2Xs3jle5pv9M

4. Click "Deploy" — live in ~2 minutes


## STEP 5 — Seed the database (2 minutes)
## ═══════════════════════════════════════

After deploy, trigger the first data fetch:

  curl -X POST https://YOUR-VERCEL-URL.vercel.app/api/cron/fetch-data \
    -H "Authorization: Bearer YOUR_CRON_SECRET"

Replace YOUR-VERCEL-URL with your actual Vercel URL.
Replace YOUR_CRON_SECRET with the value you set in Step 4.

Wait 60–120 seconds. Then check your Supabase table editor —
real government violation records will be appearing.

Verify by opening your site — the homepage stats counter
will show real numbers once the first fetch is complete.


## STEP 6 — Custom domain (10 minutes)
## ═══════════════════════════════════════

Option A — Buy at Vercel (easiest):
  Vercel Dashboard → Domains → Buy wagetheft.live (~$20/yr)

Option B — Buy elsewhere (~$10/yr at Namecheap):
  1. Vercel → Project → Settings → Domains → Add wagetheft.live
  2. Add the CNAME record to your DNS
  3. SSL auto-provisions in ~5 minutes


## STEP 7 — AdSense (after go-live)
## ═══════════════════════════════════════

Apply after your domain is live and has real data (Step 5 done).

1. https://adsense.google.com → Get started
2. Add your domain → verify ownership
3. Wait 1–14 days for review

Once approved, replace these 3 placeholder strings:

File: pages/_document.js
  ca-pub-REPLACE_WITH_YOUR_PUBLISHER_ID  →  ca-pub-YOUR_REAL_ID

File: pages/_app.js
  ca-pub-REPLACE_WITH_YOUR_PUBLISHER_ID  →  ca-pub-YOUR_REAL_ID

File: components/AdSlot.js
  ca-pub-REPLACE_WITH_YOUR_PUBLISHER_ID  →  ca-pub-YOUR_REAL_ID
  REPLACE_SLOT_LEADERBOARD               →  your leaderboard slot ID
  REPLACE_SLOT_RECTANGLE                 →  your rectangle slot ID
  REPLACE_SLOT_ARTICLE                   →  your article slot ID

File: public/ads.txt
  REPLACE_WITH_YOUR_PUBLISHER_ID         →  your publisher ID

Push to GitHub → Vercel auto-deploys.


## WHAT RUNS AUTOMATICALLY AFTER DEPLOY
## ═══════════════════════════════════════

Every day at 06:00 UTC, Vercel cron runs /api/cron/fetch-data:

  Source      Method                              Records/run   Time
  ──────────────────────────────────────────────────────────────────
  USA DOL     api.dol.gov OData V1                ~2,500        60–120s
  UK HMRC     gov.uk Content API → CSV            ~524/yr       8–15s
  AU FWO      fairwork.gov.au RSS                 ~80–150       5–12s
  CA ESDC     open.canada.ca CKAN                 ~500          10–20s
  IE WRC      workplacerelations.ie RSS            ~40–80        8–15s
  NL NLA      nlarbeidsinspectie.nl RSS            ~25–50        5–10s
  EU ELA      ela.europa.eu RSS                   ~10–20        5–8s
  ──────────────────────────────────────────────────────────────────
  TOTAL                                           ~3,700        ~100–200s

The site runs itself completely after initial setup.


## MONTHLY COSTS
## ═══════════════════════════════════════

  Vercel Hobby              $0/month
  Supabase free tier        $0/month
  All government APIs       $0/month
  Domain                    ~$0.83/month
  ──────────────────────────────────────
  TOTAL                     ~$0.83/month
