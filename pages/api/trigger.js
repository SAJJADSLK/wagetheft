export const config = { maxDuration: 300 };

import {
  fetchDOL, fetchUKHMRC, fetchCanada, fetchAustralia,
  fetchIreland, fetchNetherlands, fetchGermany, fetchFrance,
  fetchItaly, fetchSpain, fetchEurope,
} from '../../lib/fetchers';
import { upsertViolations, refreshStats, logCron, getStats } from '../../lib/supabase';

const SOURCES = [
  { name: 'DOL_USA',  label: '🇺🇸 US Dept of Labor',        fn: () => fetchDOL(process.env.DOL_API_KEY) },
  { name: 'HMRC_UK',  label: '🇬🇧 HMRC UK',                 fn: fetchUKHMRC },
  { name: 'ESDC_CA',  label: '🇨🇦 Canada ESDC',             fn: fetchCanada },
  { name: 'FWO_AU',   label: '🇦🇺 Australia FWO',           fn: fetchAustralia },
  { name: 'WRC_IE',   label: '🇮🇪 Ireland WRC',             fn: fetchIreland },
  { name: 'NLA_NL',   label: '🇳🇱 Netherlands NLA',         fn: fetchNetherlands },
  { name: 'FKS_DE',   label: '🇩🇪 Germany Zoll/FKS',        fn: fetchGermany },
  { name: 'DGT_FR',   label: '🇫🇷 France Inspection Travail',fn: fetchFrance },
  { name: 'INL_IT',   label: '🇮🇹 Italy INL',               fn: fetchItaly },
  { name: 'ITSS_ES',  label: '🇪🇸 Spain ITSS',              fn: fetchSpain },
  { name: 'ELA_EU',   label: '🇪🇺 ELA Europe',              fn: fetchEurope },
];

export default async function handler(req, res) {
  const start = Date.now();
  const results = [];
  let newStored = 0;

  for (const { name, label, fn } of SOURCES) {
    const t = Date.now();
    try {
      const rows = await fn();
      if (!rows?.length) {
        await logCron(name, 0, 'no_data');
        results.push({ name, label, status: 'no_data', fetched: 0, stored: 0, ms: Date.now()-t });
        continue;
      }
      const { count } = await upsertViolations(rows);
      newStored += count ?? 0;
      await logCron(name, rows.length, 'ok');
      results.push({ name, label, status: 'ok', fetched: rows.length, stored: count??0, ms: Date.now()-t });
    } catch(e) {
      await logCron(name, 0, 'error', e.message).catch(()=>{});
      results.push({ name, label, status: 'error', error: e.message, ms: Date.now()-t });
    }
  }

  try { await refreshStats(); } catch(_) {}
  const stats  = await getStats().catch(()=>null);
  const totalDB = stats?.total_violations ?? 0;
  const totalMs = Date.now() - start;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>WageTheft Fetch</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f8f6f1;padding:32px 24px;color:#1a1814}
h1{font-size:24px;font-weight:600;margin-bottom:4px}.sub{font-size:13px;color:#9a9488;margin-bottom:24px}
.card{background:#fff;border:1px solid #e0dbd0;border-radius:8px;padding:20px 24px;margin-bottom:12px}
h2{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9a9488;margin-bottom:14px}
.big{font-size:48px;font-weight:700;color:#8b6914;line-height:1;margin-bottom:4px}
.note{font-size:12px;color:#9a9488;margin-top:6px}
.row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f0ece4;font-size:13px}
.row:last-child{border-bottom:none}
.ok{color:#3B6D11;font-weight:600}.bad{color:#A32D2D;font-weight:600}.warn{color:#9a9488}
.seed{color:#8b6914;font-size:11px;margin-left:4px}
.btn{display:inline-block;margin-top:20px;background:#1a1814;color:#f8f6f1;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px}
</style></head><body>
<h1>✅ Fetch complete</h1>
<div class="sub">${(totalMs/1000).toFixed(1)}s · ${new Date().toUTCString()}</div>
<div class="card">
  <h2>Database total</h2>
  <div class="big">${totalDB.toLocaleString()}</div>
  <div style="font-size:13px;color:#9a9488">Records in Supabase</div>
  <div class="note">+${newStored} added this run · duplicates skipped</div>
</div>
<div class="card">
  <h2>Sources (${SOURCES.length})</h2>
  ${results.map(r=>`<div class="row">
    <span>${r.label}</span>
    <span class="${r.status==='ok'?'ok':r.status==='no_data'?'warn':'bad'}">
      ${r.status==='ok'?`✓ ${r.fetched} fetched · ${r.stored} stored`
        :r.status==='no_data'?'No data (seed used)'
        :`✗ ${(r.error||'').slice(0,60)}`}
      <span style="color:#ccc;margin-left:8px;font-size:11px">${r.ms}ms</span>
    </span>
  </div>`).join('')}
</div>
<a class="btn" href="/">← Homepage (${totalDB.toLocaleString()} records live)</a>
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
