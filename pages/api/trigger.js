export const config = { maxDuration: 300 };

import {
  fetchDOL, fetchUKHMRC, fetchAustralia,
  fetchCanada, fetchIreland, fetchNetherlands, fetchEurope,
} from '../../lib/fetchers';
import { upsertViolations, refreshStats, logCron } from '../../lib/supabase';

const SOURCES = [
  { name: 'DOL_USA', fn: () => fetchDOL(process.env.DOL_API_KEY) },
  { name: 'HMRC_UK', fn: fetchUKHMRC },
  { name: 'FWO_AU',  fn: fetchAustralia },
  { name: 'ESDC_CA', fn: fetchCanada },
  { name: 'WRC_IE',  fn: fetchIreland },
  { name: 'NLA_NL',  fn: fetchNetherlands },
  { name: 'ELA_EU',  fn: fetchEurope },
];

export default async function handler(req, res) {
  const start = Date.now();
  const results = [];
  let stored = 0;

  for (const { name, fn } of SOURCES) {
    const t = Date.now();
    try {
      const rows = await fn();
      if (!rows.length) {
        await logCron(name, 0, 'no_data');
        results.push({ source: name, status: 'no_data', fetched: 0, stored: 0, ms: Date.now()-t });
        continue;
      }
      const { count } = await upsertViolations(rows);
      stored += count ?? 0;
      await logCron(name, rows.length, 'ok');
      results.push({ source: name, status: 'ok', fetched: rows.length, stored: count??0, ms: Date.now()-t });
    } catch(e) {
      await logCron(name, 0, 'error', e.message).catch(()=>{});
      results.push({ source: name, status: 'error', error: e.message, ms: Date.now()-t });
    }
  }

  try { await refreshStats(); } catch(_) {}

  const totalMs = Date.now() - start;

  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>WageTheft — Fetch</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8f6f1;padding:32px 24px;color:#1a1814}
h1{font-size:26px;font-weight:600;margin-bottom:6px}
.sub{font-size:13px;color:#9a9488;margin-bottom:24px}
.card{background:#fff;border:1px solid #e0dbd0;border-radius:8px;padding:20px 24px;margin-bottom:12px}
h2{font-size:14px;font-weight:600;margin-bottom:14px}
.big{font-size:44px;font-weight:700;color:#8b6914;margin-bottom:4px}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0ece4;font-size:13px}
.row:last-child{border-bottom:none}
.ok{color:#3B6D11;font-weight:600}.bad{color:#A32D2D;font-weight:600}.warn{color:#854F0B}
.btn{display:inline-block;margin-top:20px;background:#1a1814;color:#f8f6f1;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px}
</style></head><body>
<h1>${stored>0?'✅':'⚠️'} Data fetch complete</h1>
<div class="sub">Finished in ${(totalMs/1000).toFixed(1)}s · ${new Date().toUTCString()}</div>
<div class="card">
  <h2>Total stored to Supabase</h2>
  <div class="big">${stored.toLocaleString()}</div>
  <div style="font-size:13px;color:#9a9488">${stored>0?'Go to homepage to see live records':'No new records — check errors'}</div>
</div>
<div class="card">
  <h2>Results by source</h2>
  ${results.map(r=>`<div class="row">
    <span>${r.source}</span>
    <span class="${r.status==='ok'?'ok':r.status==='no_data'?'warn':'bad'}">
      ${r.status==='ok'?`✓ ${r.fetched} fetched · ${r.stored} stored · ${r.ms}ms`
        :r.status==='no_data'?`⚠ No data · ${r.ms}ms`
        :`✗ ${(r.error||'').slice(0,60)} · ${r.ms}ms`}
    </span>
  </div>`).join('')}
</div>
<a class="btn" href="/">← Go to homepage</a>
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
