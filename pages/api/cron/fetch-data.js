// ================================================
// Vercel Cron — runs daily at 06:00 UTC
//
// HOW TO TEST IN BROWSER:
//   GET  /api/cron/fetch-data        → shows status page (no auth needed)
//   POST /api/cron/fetch-data        → triggers full data fetch (needs CRON_SECRET)
//
// HOW TO TRIGGER VIA CURL:
//   curl -X POST https://your-site.vercel.app/api/cron/fetch-data \
//     -H "Authorization: Bearer YOUR_CRON_SECRET"
// ================================================

import {
  fetchDOL,
  fetchOSHA,
  fetchUKHMRC,
  fetchAustralia,
  fetchCanada,
  fetchNewZealand,
  fetchIreland,
  fetchNetherlands,
  fetchEurope,
} from '../../../lib/fetchers';
import { upsertViolations, refreshStats, logCron, getStats } from '../../../lib/supabase';

export const config = { maxDuration: 300 };

const SOURCES = [
  { name: 'DOL_USA',  fn: () => fetchDOL(process.env.DOL_API_KEY),  note: 'api.dol.gov V1 OData — WHD violations (FIXED)' },
  { name: 'OSHA_USA', fn: () => fetchOSHA(process.env.DOL_API_KEY), note: 'api.dol.gov V1 — OSHA enforcement (NEW)' },
  { name: 'HMRC_UK',  fn: fetchUKHMRC,     note: 'gov.uk Content API → XLSX (FIXED parsing)' },
  { name: 'ESDC_CA',  fn: fetchCanada,     note: 'canada.ca HTML scrape — confirmed working' },
  { name: 'FWO_AU',   fn: fetchAustralia,  note: 'data.gov.au CKAN — replaces blocked fairwork.gov.au (FIXED)' },
  { name: 'MBIE_NZ',  fn: fetchNewZealand, note: 'employment.govt.nz public register (NEW)' },
  { name: 'WRC_IE',   fn: fetchIreland,    note: 'No public API — stub' },
  { name: 'NLA_NL',   fn: fetchNetherlands,note: 'No public RSS — stub' },
  { name: 'ELA_EU',   fn: fetchEurope,     note: 'No public RSS — stub' },
];

export default async function handler(req, res) {

  // ── GET: browser-friendly status page — no auth needed ─────────────────
  if (req.method === 'GET') {
    const stats = await getStats().catch(() => null);
    const lastLogs = await getLastCronLogs().catch(() => []);
    const hasCronSecret = !!process.env.CRON_SECRET;
    const hasDolKey     = !!process.env.DOL_API_KEY;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_KEY;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WageTheft.live — Cron Status</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f8f6f1; color: #1a1814; padding: 32px 24px; }
    h1 { font-size: 24px; font-weight: 500; margin-bottom: 8px; }
    .sub { font-size: 13px; color: #9a9488; margin-bottom: 28px; }
    .card { background: #fff; border: 1px solid #e0dbd0; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; }
    .card h2 { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: #1a1814; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0ece4; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b6560; }
    .val { font-family: monospace; font-size: 12px; }
    .ok  { color: #3B6D11; font-weight: 600; }
    .bad { color: #A32D2D; font-weight: 600; }
    .warn{ color: #854F0B; font-weight: 600; }
    .big { font-size: 28px; font-weight: 700; color: #8b6914; }
    .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 8px; }
    .stat { background: #f8f6f1; border-radius: 6px; padding: 14px; text-align: center; }
    .stat-v { font-size: 22px; font-weight: 600; color: #1a1814; }
    .stat-l { font-size: 11px; color: #9a9488; margin-top: 4px; }
    .btn { display: inline-block; margin-top: 16px; background: #1a1814; color: #f8f6f1; padding: 10px 20px; border-radius: 6px; font-size: 12px; text-decoration: none; font-family: monospace; }
    .notice { background: #fffbf0; border: 1px solid #e8d9a0; border-radius: 6px; padding: 14px 18px; font-size: 12px; color: #854F0B; margin-top: 16px; line-height: 1.7; }
    code { background: #f0ece4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>WageTheft.live — Cron Status</h1>
  <div class="sub">Data fetch system · ${new Date().toUTCString()}</div>

  <div class="card">
    <h2>Database stats</h2>
    <div class="stats">
      <div class="stat">
        <div class="stat-v">${stats?.total_violations?.toLocaleString() ?? '0'}</div>
        <div class="stat-l">Total violations</div>
      </div>
      <div class="stat">
        <div class="stat-v">${stats ? '$' + Math.round((stats.total_wages_stolen || 0) / 1_000_000) + 'M' : '$0'}</div>
        <div class="stat-l">Wages stolen</div>
      </div>
      <div class="stat">
        <div class="stat-v">${stats?.total_workers_affected?.toLocaleString() ?? '0'}</div>
        <div class="stat-l">Workers affected</div>
      </div>
    </div>
    <div class="row">
      <span class="label">Last updated</span>
      <span class="val">${stats?.last_updated ? new Date(stats.last_updated).toUTCString() : 'Never — cron has not run yet'}</span>
    </div>
  </div>

  <div class="card">
    <h2>Environment variables</h2>
    <div class="row"><span class="label">SUPABASE_SERVICE_KEY</span><span class="${hasServiceKey ? 'ok' : 'bad'}">${hasServiceKey ? '✓ Set' : '✗ Missing'}</span></div>
    <div class="row"><span class="label">DOL_API_KEY</span><span class="${hasDolKey ? 'ok' : 'bad'}">${hasDolKey ? '✓ Set' : '✗ Missing'}</span></div>
    <div class="row"><span class="label">CRON_SECRET</span><span class="${hasCronSecret ? 'ok' : 'bad'}">${hasCronSecret ? '✓ Set' : '✗ Missing — cannot trigger cron!'}</span></div>
  </div>

  <div class="card">
    <h2>Data sources (7 configured)</h2>
    ${SOURCES.map(s => `<div class="row"><span class="label">${s.name}</span><span class="val ok">✓ Configured — ${s.note}</span></div>`).join('')}
  </div>

  ${lastLogs.length > 0 ? `
  <div class="card">
    <h2>Last cron runs</h2>
    ${lastLogs.map(l => `<div class="row">
      <span class="label">${l.source}</span>
      <span class="val ${l.status === 'ok' ? 'ok' : l.status === 'no_data' ? 'warn' : 'bad'}">${l.status} · ${l.records_in} records · ${new Date(l.ran_at).toUTCString()}</span>
    </div>`).join('')}
  </div>` : ''}

  ${!hasCronSecret ? `
  <div class="notice">
    ⚠️ <strong>CRON_SECRET is not set.</strong> You need to:<br>
    1. Go to Vercel → Project → Settings → Environment Variables<br>
    2. Add <code>CRON_SECRET</code> = any password you choose (e.g. <code>wagetheft2026</code>)<br>
    3. Redeploy the project<br>
    4. Come back to this page and trigger the fetch
  </div>` : `
  <div class="notice">
    ✅ Everything is configured. To populate the database, trigger the fetch:<br><br>
    <strong>Option 1 — Terminal:</strong><br>
    <code>curl -X POST ${req.headers.host ? 'https://' + req.headers.host : ''}/api/cron/fetch-data -H "Authorization: Bearer YOUR_CRON_SECRET"</code><br><br>
    <strong>Option 2 — Vercel dashboard:</strong><br>
    Go to your project → <strong>Cron Jobs</strong> tab → click <strong>Trigger</strong> manually.
  </div>`}

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  // ── POST: actual data fetch — requires auth ─────────────────────────────
  const isVercelCron    = req.headers['x-vercel-cron'] === '1';
  const isManualTrigger = process.env.CRON_SECRET &&
    req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isManualTrigger) {
    return res.status(401).json({ error: 'Unauthorised. Send Authorization: Bearer YOUR_CRON_SECRET header.' });
  }

  const start   = Date.now();
  const results = [];
  let   stored  = 0;

  console.log(`[cron] ▶ Starting — ${SOURCES.length} sources — ${new Date().toISOString()}`);

  for (const { name, fn, note } of SOURCES) {
    const t = Date.now();
    console.log(`[cron] → ${name}: ${note}`);
    try {
      const rows = await fn();
      if (!rows.length) {
        await logCron(name, 0, 'no_data');
        results.push({ source: name, status: 'no_data', rows: 0, ms: Date.now() - t });
        continue;
      }
      const { count } = await upsertViolations(rows);
      stored += count ?? 0;
      await logCron(name, rows.length, 'ok');
      results.push({ source: name, status: 'ok', fetched: rows.length, stored: count, ms: Date.now() - t });
      console.log(`[cron] ✓ ${name}: fetched=${rows.length} stored=${count} ms=${Date.now() - t}`);
    } catch (err) {
      console.error(`[cron] ✗ ${name}:`, err.message);
      await logCron(name, 0, 'error', err.message);
      results.push({ source: name, status: 'error', error: err.message, ms: Date.now() - t });
    }
  }

  try {
    await refreshStats();
    console.log('[cron] stats refreshed');
  } catch (err) {
    console.error('[cron] stats refresh failed:', err.message);
  }

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    totalMs: Date.now() - start,
    totalStored: stored,
    sources: results,
  });
}

// Fetch last 14 cron log entries for the status page
async function getLastCronLogs() {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );
  const { data } = await client
    .from('cron_log')
    .select('source, records_in, status, ran_at')
    .order('ran_at', { ascending: false })
    .limit(14);
  return data ?? [];
}
