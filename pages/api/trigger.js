// Simple trigger endpoint - no auth needed for GET
// Visit: /api/trigger in browser to populate database

import {
  fetchDOL, fetchUKHMRC, fetchAustralia,
  fetchCanada, fetchIreland, fetchNetherlands, fetchEurope,
} from '../../lib/fetchers';
import { upsertViolations, refreshStats, logCron } from '../../lib/supabase';

export const config = { maxDuration: 300 };

const SOURCES = [
  { name: 'DOL_USA',  fn: () => fetchDOL(process.env.DOL_API_KEY) },
  { name: 'HMRC_UK',  fn: fetchUKHMRC },
  { name: 'FWO_AU',   fn: fetchAustralia },
  { name: 'ESDC_CA',  fn: fetchCanada },
  { name: 'WRC_IE',   fn: fetchIreland },
  { name: 'NLA_NL',   fn: fetchNetherlands },
  { name: 'ELA_EU',   fn: fetchEurope },
];

export default async function handler(req, res) {
  const start   = Date.now();
  const results = [];
  let   stored  = 0;

  for (const { name, fn } of SOURCES) {
    const t = Date.now();
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
    } catch (err) {
      await logCron(name, 0, 'error', err.message);
      results.push({ source: name, status: 'error', error: err.message, ms: Date.now() - t });
    }
  }

  try { await refreshStats(); } catch (_) {}

  const totalMs = Date.now() - start;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WageTheft — Data Fetch Complete</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f8f6f1;padding:40px 24px;color:#1a1814}
    h1{font-size:26px;font-weight:600;margin-bottom:6px}
    .sub{font-size:13px;color:#9a9488;margin-bottom:28px}
    .card{background:#fff;border:1px solid #e0dbd0;border-radius:8px;padding:20px 24px;margin-bottom:14px}
    .card h2{font-size:14px;font-weight:600;margin-bottom:14px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0ece4;font-size:13px}
    .row:last-child{border-bottom:none}
    .ok{color:#3B6D11;font-weight:600}
    .bad{color:#A32D2D;font-weight:600}
    .warn{color:#854F0B;font-weight:600}
    .big{font-size:32px;font-weight:700;color:#8b6914;margin-bottom:4px}
    .home{display:inline-block;margin-top:20px;background:#1a1814;color:#f8f6f1;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px}
  </style>
</head>
<body>
  <h1>✅ Data fetch complete</h1>
  <div class="sub">Finished in ${(totalMs/1000).toFixed(1)}s · ${new Date().toUTCString()}</div>

  <div class="card">
    <h2>Total stored</h2>
    <div class="big">${stored.toLocaleString()} records</div>
    <div style="font-size:13px;color:#9a9488">Written to your Supabase database</div>
  </div>

  <div class="card">
    <h2>Results by source</h2>
    ${results.map(r => `
    <div class="row">
      <span>${r.source}</span>
      <span class="${r.status === 'ok' ? 'ok' : r.status === 'no_data' ? 'warn' : 'bad'}">
        ${r.status === 'ok' ? `✓ ${r.fetched} fetched · ${r.stored} stored · ${r.ms}ms`
        : r.status === 'no_data' ? '⚠ No data returned'
        : `✗ Error: ${r.error}`}
      </span>
    </div>`).join('')}
  </div>

  <a class="home" href="/">← Go to homepage to see live data</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
