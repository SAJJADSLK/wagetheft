// Debug trigger - shows exactly what each API returns
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const results = [];
  const start = Date.now();

  // ── TEST 1: DOL API key present? ────────────────────────────────────────
  const dolKey = process.env.DOL_API_KEY;
  results.push({
    source: 'ENV CHECK',
    detail: `DOL_API_KEY: ${dolKey ? '✅ SET (' + dolKey.slice(0,8) + '...)' : '❌ MISSING'}`,
    detail2: `SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✅ SET' : '❌ MISSING'}`,
    detail3: `SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING'}`,
  });

  // ── TEST 2: DOL USA ──────────────────────────────────────────────────────
  try {
    const url = `https://api.dol.gov/V1/WHD/whd_whisard?KEY=${dolKey}&$top=5&$skip=0`;
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'WageTheft.live/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    const preview = text.slice(0, 300);
    let recordCount = 0;
    try {
      const json = JSON.parse(text);
      const arr = json?.d?.results ?? json?.value ?? (Array.isArray(json) ? json : []);
      recordCount = arr.length;
    } catch (_) {}
    results.push({
      source: 'DOL_USA',
      status: r.status,
      records: recordCount,
      preview: preview,
      ok: r.ok && recordCount > 0,
    });
  } catch (e) {
    results.push({ source: 'DOL_USA', error: e.message, ok: false });
  }

  // ── TEST 3: HMRC UK ──────────────────────────────────────────────────────
  try {
    const r = await fetch(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    );
    const json = await r.json();
    const attachments = json?.details?.attachments ?? [];
    const csvUrls = attachments.filter(a => (a.url || '').endsWith('.csv')).map(a => a.url);
    results.push({
      source: 'HMRC_UK',
      status: r.status,
      attachments_found: attachments.length,
      csv_urls: csvUrls.length,
      first_csv: csvUrls[0] || 'none',
      ok: csvUrls.length > 0,
    });

    // Try fetching the CSV
    if (csvUrls[0]) {
      const csvR = await fetch(csvUrls[0], { signal: AbortSignal.timeout(15000) });
      const csvText = await csvR.text();
      const lines = csvText.split('\n').filter(l => l.trim());
      results.push({
        source: 'HMRC_CSV',
        lines: lines.length,
        header: lines[0]?.slice(0, 100),
        sample: lines[1]?.slice(0, 100),
        ok: lines.length > 1,
      });
    }
  } catch (e) {
    results.push({ source: 'HMRC_UK', error: e.message, ok: false });
  }

  // ── TEST 4: Australia FWO RSS ────────────────────────────────────────────
  try {
    const r = await fetch('https://www.fairwork.gov.au/newsroom/media-releases/rss', {
      headers: { 'User-Agent': 'WageTheft.live/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    const items = [...text.matchAll(/<item>/g)].length;
    const preview = text.slice(0, 400);
    results.push({
      source: 'FWO_AU',
      status: r.status,
      items_found: items,
      preview: preview,
      ok: items > 0,
    });
  } catch (e) {
    results.push({ source: 'FWO_AU', error: e.message, ok: false });
  }

  // ── TEST 5: Canada ESDC ──────────────────────────────────────────────────
  try {
    const r = await fetch(
      'https://open.canada.ca/data/en/api/3/action/datastore_search?resource_id=9fa42498-4f35-4dd5-8e0f-4a8d51e4ed6d&limit=5',
      { signal: AbortSignal.timeout(15000) }
    );
    const json = await r.json();
    const records = json?.result?.records ?? [];
    results.push({
      source: 'ESDC_CA',
      status: r.status,
      records: records.length,
      total: json?.result?.total,
      sample_keys: records[0] ? Object.keys(records[0]).join(', ') : 'no records',
      sample: JSON.stringify(records[0]).slice(0, 200),
      ok: records.length > 0,
    });
  } catch (e) {
    results.push({ source: 'ESDC_CA', error: e.message, ok: false });
  }

  // ── TEST 6: Supabase write test ──────────────────────────────────────────
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
    const { data, error } = await sb.from('violations').select('count').single();
    const { data: statsData, error: statsErr } = await sb.from('stats').select('*').single();
    results.push({
      source: 'SUPABASE',
      violations_count: error ? `ERROR: ${error.message}` : data,
      stats: statsErr ? `ERROR: ${statsErr.message}` : statsData,
      ok: !error,
    });
  } catch (e) {
    results.push({ source: 'SUPABASE', error: e.message, ok: false });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WageTheft — Debug</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;background:#f8f6f1;padding:24px;color:#1a1814;font-size:13px}
    h1{font-size:20px;margin-bottom:4px;font-family:system-ui}
    .sub{color:#9a9488;font-size:12px;margin-bottom:20px}
    .card{background:#fff;border:1px solid #e0dbd0;border-radius:6px;padding:16px 20px;margin-bottom:10px}
    .name{font-size:14px;font-weight:700;margin-bottom:10px}
    .ok{color:#3B6D11}.bad{color:#A32D2D}.warn{color:#854F0B}
    .row{display:flex;gap:12px;margin-bottom:6px;flex-wrap:wrap}
    .key{color:#9a9488;min-width:140px}
    .val{word-break:break-all;flex:1}
    pre{background:#f0ece4;padding:10px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;font-size:11px;margin-top:8px}
  </style>
</head>
<body>
  <h1>🔍 WageTheft Debug Report</h1>
  <div class="sub">Ran in ${((Date.now()-start)/1000).toFixed(1)}s · ${new Date().toUTCString()}</div>
  ${results.map(r => `
  <div class="card">
    <div class="name ${r.ok === true ? 'ok' : r.ok === false ? 'bad' : ''}">${r.ok === true ? '✅' : r.ok === false ? '❌' : '📋'} ${r.source}</div>
    ${Object.entries(r).filter(([k]) => k !== 'source' && k !== 'ok').map(([k,v]) => `
      <div class="row">
        <span class="key">${k}:</span>
        <span class="val ${String(v).startsWith('ERROR') || String(v).startsWith('❌') ? 'bad' : String(v).startsWith('✅') ? 'ok' : ''}">${
          String(v).length > 300 ? `<pre>${String(v).slice(0,300)}...</pre>` : v
        }</span>
      </div>`).join('')}
  </div>`).join('')}
  <br>
  <a href="/" style="background:#1a1814;color:#f8f6f1;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:13px">← Back to homepage</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
