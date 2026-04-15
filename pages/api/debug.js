// ================================================
// /api/debug — Test each data source individually
// Shows full error details to diagnose "No data" issues
// ================================================
export const config = { maxDuration: 120 };

import {
  fetchDOL, fetchOSHA, fetchUKHMRC, fetchAustralia,
  fetchCanada, fetchNewZealand,
} from '../../lib/fetchers';

const SOURCES = [
  { key: 'dol',     label: '🇺🇸 US Dept of Labor (WHD)',  fn: () => fetchDOL(process.env.DOL_API_KEY) },
  { key: 'osha',    label: '🇺🇸 US OSHA Enforcement',     fn: () => fetchOSHA(process.env.DOL_API_KEY) },
  { key: 'hmrc',    label: '🇬🇧 HMRC UK',                 fn: fetchUKHMRC },
  { key: 'canada',  label: '🇨🇦 Canada ESDC',             fn: fetchCanada },
  { key: 'aus',     label: '🇦🇺 Australia FWO',            fn: fetchAustralia },
  { key: 'nz',      label: '🇳🇿 New Zealand MBIE',         fn: fetchNewZealand },
];

export default async function handler(req, res) {
  const { source } = req.query;

  // Run a single source if ?source=key is provided, otherwise show menu
  if (source) {
    const s = SOURCES.find(x => x.key === source);
    if (!s) return res.status(404).json({ error: `Unknown source: ${source}` });

    const t = Date.now();
    let result, error;
    try {
      result = await s.fn();
    } catch (e) {
      error = e.message;
    }
    const ms = Date.now() - t;

    return res.status(200).json({
      source: s.label,
      ms,
      count: result?.length ?? 0,
      error: error ?? null,
      env: {
        DOL_API_KEY: process.env.DOL_API_KEY ? `✓ set (${process.env.DOL_API_KEY.length} chars)` : '✗ MISSING',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '✓ set' : '✗ MISSING',
      },
      sample: result?.slice(0, 3) ?? null,
    });
  }

  // Show a nice HTML menu page
  const envHtml = [
    { k: 'DOL_API_KEY',           v: process.env.DOL_API_KEY },
    { k: 'SUPABASE_SERVICE_KEY',  v: process.env.SUPABASE_SERVICE_KEY },
    { k: 'NEXT_PUBLIC_SUPABASE_URL', v: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { k: 'CRON_SECRET',           v: process.env.CRON_SECRET },
  ].map(({ k, v }) =>
    `<div class="row"><span class="label">${k}</span><span class="${v ? 'ok' : 'bad'}">${v ? `✓ Set (${v.length} chars)` : '✗ MISSING'}</span></div>`
  ).join('');

  const sourceRows = SOURCES.map(s =>
    `<div class="row">
      <span class="label">${s.label}</span>
      <a class="btn-test" href="/api/debug?source=${s.key}" target="_blank">Test →</a>
    </div>`
  ).join('');

  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>WageTheft Debug</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8f6f1;padding:32px 24px;color:#1a1814}
h1{font-size:20px;font-weight:600;margin-bottom:4px}
.sub{font-size:13px;color:#9a9488;margin-bottom:24px}
.card{background:#fff;border:1px solid #e0dbd0;border-radius:8px;padding:20px 24px;margin-bottom:12px}
h2{font-size:12px;font-weight:600;margin-bottom:12px;color:#9a9488;text-transform:uppercase;letter-spacing:.06em}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0ece4;font-size:13px}
.row:last-child{border-bottom:none}
.label{color:#3d3a33}
.ok{color:#3B6D11;font-weight:600}.bad{color:#A32D2D;font-weight:600}
.btn-test{background:#1a1814;color:#f8f6f1;padding:5px 14px;border-radius:4px;text-decoration:none;font-size:12px;font-family:monospace}
.note{background:#fffbf0;border:1px solid #e8d9a0;border-radius:6px;padding:12px 16px;font-size:12px;color:#854F0B;margin-top:12px;line-height:1.8}
</style></head><body>
<h1>🔍 WageTheft Debug Panel</h1>
<div class="sub">Click "Test →" to test each source individually and see full error details</div>

<div class="card">
  <h2>Environment variables</h2>
  ${envHtml}
</div>

<div class="card">
  <h2>Data sources — click to test individually</h2>
  ${sourceRows}
</div>

<div class="note">
  <strong>How to use:</strong> Click "Test →" next to each source. The JSON response will show:<br>
  • <code>count</code>: how many rows were fetched (0 = problem)<br>
  • <code>error</code>: the actual error message if something threw<br>
  • <code>sample</code>: first 3 rows of fetched data<br>
  • <code>env</code>: whether your API keys are set<br><br>
  <strong>Common issues:</strong> DOL/OSHA returning 0 rows usually means the API key is invalid.
  Check Vercel → Settings → Environment Variables.
</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
