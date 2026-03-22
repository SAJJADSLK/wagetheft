export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const results = [];
  const UA = 'Mozilla/5.0 WageTheft.live/1.0';

  // ── DOL USA ───────────────────────────────────────────────────────────────
  try {
    const key = process.env.DOL_API_KEY;
    // Try the enforcedata direct JSON endpoint
    const r = await fetch(
      `https://data.dol.gov/get/whd_whisard/rows:5/format:json`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    results.push({ source: 'DOL_direct', status: r.status, body: text.slice(0,500) });
  } catch(e) { results.push({ source: 'DOL_direct', error: e.message }); }

  try {
    const key = process.env.DOL_API_KEY;
    const r = await fetch(
      `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=3&offset=0`,
      { headers: { 'User-Agent': UA, 'X-API-Key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    results.push({ source: 'DOL_apiprod', status: r.status, body: text.slice(0,500) });
  } catch(e) { results.push({ source: 'DOL_apiprod', error: e.message }); }

  try {
    const key = process.env.DOL_API_KEY;
    const r = await fetch(
      `https://api.dol.gov/V1/WHD/whd_whisard?KEY=${key}&$top=3`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    results.push({ source: 'DOL_v1', status: r.status, body: text.slice(0,500) });
  } catch(e) { results.push({ source: 'DOL_v1', error: e.message }); }

  // ── HMRC UK CSV ───────────────────────────────────────────────────────────
  try {
    const url = 'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv';
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    const lines = text.split('\n').slice(0,5);
    results.push({ source: 'HMRC_csv', status: r.status, content_type: r.headers.get('content-type'), lines: lines.join(' | ').slice(0,400) });
  } catch(e) { results.push({ source: 'HMRC_csv', error: e.message }); }

  // ── Canada ESDC ───────────────────────────────────────────────────────────
  try {
    const r = await fetch(
      'https://open.canada.ca/data/en/api/3/action/datastore_search?resource_id=9fa42498-4f35-4dd5-8e0f-4a8d51e4ed6d&limit=3',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    const json = await r.json();
    const records = json?.result?.records ?? [];
    results.push({
      source: 'ESDC_CA', status: r.status,
      total: json?.result?.total,
      record_count: records.length,
      first_keys: records[0] ? Object.keys(records[0]).join(', ') : 'NO RECORDS',
      first_record: records[0] ? JSON.stringify(records[0]).slice(0,300) : 'none',
    });
  } catch(e) { results.push({ source: 'ESDC_CA', error: e.message }); }

  // ── FWO Australia ─────────────────────────────────────────────────────────
  try {
    const r = await fetch(
      'https://www.fairwork.gov.au/newsroom/media-releases/rss',
      { headers: { 'User-Agent': UA, Accept: 'text/xml, application/xml' }, signal: AbortSignal.timeout(30000) }
    );
    const text = await r.text();
    const itemCount = (text.match(/<item>/g) || []).length;
    // Show first item
    const firstItem = text.match(/<item>([\s\S]*?)<\/item>/)?.[1]?.slice(0,300) ?? 'no items';
    results.push({ source: 'FWO_AU', status: r.status, items: itemCount, first_item: firstItem });
  } catch(e) { results.push({ source: 'FWO_AU', error: e.message }); }

  // ── Render ─────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>WageTheft Debug v3</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;background:#f8f6f1;padding:24px;color:#1a1814;font-size:12px}
h1{font-size:18px;font-family:system-ui;font-weight:600;margin-bottom:4px}
.sub{color:#9a9488;margin-bottom:20px;font-size:11px}
.card{background:#fff;border:1px solid #e0dbd0;border-radius:6px;padding:14px 18px;margin-bottom:10px}
.name{font-size:13px;font-weight:700;margin-bottom:10px;font-family:system-ui;color:${`#1a1814`}}
.ok{color:#3B6D11}.bad{color:#A32D2D}
.row{margin-bottom:6px;display:flex;gap:10px;flex-wrap:wrap}
.k{color:#9a9488;min-width:120px;flex-shrink:0}
pre{background:#f0ece4;padding:8px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;font-size:11px;margin-top:4px;line-height:1.5}
</style></head><body>
<h1>WageTheft Debug v3 — Raw API Responses</h1>
<div class="sub">${new Date().toUTCString()}</div>
${results.map(r => `
<div class="card">
  <div class="name">${r.source}</div>
  ${Object.entries(r).filter(([k])=>k!=='source').map(([k,v])=>`
  <div class="row">
    <span class="k">${k}:</span>
    <span class="${String(v).includes('error')||String(v).includes('Error')?'bad':''}">${
      String(v).length > 150 ? `<pre>${String(v)}</pre>` : v
    }</span>
  </div>`).join('')}
</div>`).join('')}
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
