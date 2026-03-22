export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const UA  = 'WageTheft.live/1.0 (data@wagetheft.live)';
  const results = [];
  const start = Date.now();

  // ── DOL USA — correct format: data.dol.gov/get/DATASET/limit/N ──────────
  // Header: x-api-key (confirmed from DOL GitHub issues)
  try {
    const key = process.env.DOL_API_KEY;
    const url = `https://data.dol.gov/get/whd_whisard/limit/5`;
    const r = await fetch(url, {
      headers: { 'x-api-key': key, 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    results.push({ source: 'DOL_correct_format', status: r.status, body: text.slice(0, 400) });
  } catch(e) { results.push({ source: 'DOL_correct_format', error: e.message }); }

  // ── HMRC — use gov.uk content API dynamically ────────────────────────────
  try {
    const r = await fetch(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    const text = await r.text();
    const isJson = text.trim().startsWith('{');
    let csvUrls = [];
    if (isJson) {
      const json = JSON.parse(text);
      const atts = json?.details?.attachments ?? [];
      csvUrls = atts.filter(a => (a.url||'').toLowerCase().includes('.csv')).map(a => a.url);
    }
    results.push({
      source: 'HMRC_content_api', status: r.status,
      is_json: isJson, csv_count: csvUrls.length,
      csv_urls: csvUrls.join(' | ').slice(0, 300) || 'NONE FOUND',
      raw_start: text.slice(0, 100),
    });

    // If we found a CSV, try fetching first 3 lines
    if (csvUrls[0]) {
      const csvR = await fetch(csvUrls[0], { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      const csvText = await csvR.text();
      const lines = csvText.split('\n').slice(0, 4);
      results.push({ source: 'HMRC_csv_preview', status: csvR.status, lines: lines.join(' || ').slice(0, 300) });
    }
  } catch(e) { results.push({ source: 'HMRC_content_api', error: e.message }); }

  // ── Canada — correct source: public naming HTML page ─────────────────────
  // The CKAN resource ID 9fa42498 is wrong. Real data is at canada.ca HTML page
  try {
    const r = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    const text = await r.text();
    // Count employer mentions (they appear as list items)
    const liCount = (text.match(/<li>/g) || []).length;
    const hasRogers = text.includes('Rogers');
    const hasLogistec = text.includes('Logistec');
    results.push({
      source: 'CANADA_naming_page', status: r.status,
      page_size_kb: Math.round(text.length / 1024),
      li_count: liCount,
      has_rogers: hasRogers,   // Known 2025 entry
      has_logistec: hasLogistec, // Known 2025 entry
      preview: text.slice(text.indexOf('<main'), text.indexOf('<main') + 500).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').slice(0,300),
    });
  } catch(e) { results.push({ source: 'CANADA_naming_page', error: e.message }); }

  // ── FWO Australia — longer timeout ───────────────────────────────────────
  try {
    const r = await fetch(
      'https://www.fairwork.gov.au/newsroom/media-releases/rss',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) }
    );
    const text = await r.text();
    const items = (text.match(/<item>/g) || []).length;
    const firstTitle = text.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? text.match(/<title>(.*?)<\/title>/g)?.[1] ?? 'not found';
    results.push({ source: 'FWO_AU', status: r.status, items, firstTitle: firstTitle.slice(0,100) });
  } catch(e) { results.push({ source: 'FWO_AU', error: e.message }); }

  // ── Supabase confirm tables ───────────────────────────────────────────────
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    const { count, error } = await sb.from('violations').select('*', { count: 'exact', head: true });
    results.push({ source: 'SUPABASE', ok: !error, violations_rows: error ? `ERROR: ${error.message}` : count });
  } catch(e) { results.push({ source: 'SUPABASE', error: e.message }); }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Debug v4</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:monospace;background:#f8f6f1;padding:24px;font-size:12px}
h1{font-size:16px;font-family:system-ui;margin-bottom:4px}
.sub{color:#9a9488;margin-bottom:16px;font-size:11px}
.card{background:#fff;border:1px solid #e0dbd0;border-radius:6px;padding:14px 18px;margin-bottom:10px}
.n{font-size:13px;font-weight:700;margin-bottom:10px;font-family:system-ui}
.ok{color:#3B6D11}.bad{color:#A32D2D}
.row{margin-bottom:5px;display:flex;gap:10px;flex-wrap:wrap;padding-bottom:5px;border-bottom:1px solid #f5f0e8}
.row:last-child{border:none}.k{color:#9a9488;min-width:120px;flex-shrink:0}
pre{background:#f0ece4;padding:8px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;font-size:11px;margin-top:4px;line-height:1.4}
</style></head><body>
<h1>WageTheft Debug v4</h1>
<div class="sub">${new Date().toUTCString()} · ${((Date.now()-start)/1000).toFixed(1)}s</div>
${results.map(r=>`<div class="card">
<div class="n">${r.source}</div>
${Object.entries(r).filter(([k])=>k!=='source').map(([k,v])=>`
<div class="row"><span class="k">${k}:</span><span>${String(v).length>200?`<pre>${v}</pre>`:v}</span></div>`).join('')}
</div>`).join('')}
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
