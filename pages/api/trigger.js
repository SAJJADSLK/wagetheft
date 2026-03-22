export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const UA = 'Mozilla/5.0 WageTheft.live/1.0';
  const results = [];

  // ── DOL: try multiple URL formats to find what works ────────────────────
  const dolKey = process.env.DOL_API_KEY;
  
  const dolTests = [
    `https://data.dol.gov/get/whd_whisard/rows:5/format:json`,
    `https://data.dol.gov/get/whd_whisard/rows/5`,
    `https://data.dol.gov/get/whd_whisard/limit/5`,
    `https://api.dol.gov/V1/WHD/whd_whisard?KEY=${dolKey}&$top=5`,
  ];

  for (const url of dolTests) {
    try {
      const r = await fetch(url, {
        headers: { 'x-api-key': dolKey, 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      const text = await r.text();
      results.push({ source: `DOL: ${url.split('/').slice(-2).join('/')}`, status: r.status, length: text.length, body: text.slice(0,300) });
    } catch(e) { results.push({ source: `DOL: ${url.slice(-30)}`, error: e.message }); }
  }

  // ── HMRC: find the real current CSV URLs ────────────────────────────────
  // Try fetching the HTML page to find links
  try {
    const r = await fetch(
      'https://www.gov.uk/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    // Find all .csv links in the HTML
    const csvLinks = [...text.matchAll(/href="([^"]*\.csv[^"]*)"/gi)].map(m => m[1]);
    const assetLinks = [...text.matchAll(/href="(https?:\/\/assets\.publishing[^"]*\.csv[^"]*)"/gi)].map(m => m[1]);
    results.push({ source: 'HMRC_html_page', status: r.status, csv_links: csvLinks.slice(0,5).join(' | '), asset_links: assetLinks.slice(0,5).join(' | '), body_start: text.slice(0,200).replace(/<[^>]+>/g,' ') });
  } catch(e) { results.push({ source: 'HMRC_html_page', error: e.message }); }

  // ── WRC Ireland: show ALL items (no filter) ──────────────────────────────
  try {
    const r = await fetch('https://www.workplacerelations.ie/en/news_media/press_releases/rss', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    const allItems = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const titles = allItems.slice(0,5).map(([,ix]) => {
      const t = ix.match(/<title><!\[CDATA\[(.*?)\]\]>/i)?.[1] ?? ix.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
      return t.slice(0,80);
    });
    results.push({ source: 'WRC_IE', status: r.status, total_items: allItems.length, sample_titles: titles.join(' || ') });
  } catch(e) { results.push({ source: 'WRC_IE', error: e.message }); }

  // ── NLA Netherlands: show ALL items ─────────────────────────────────────
  try {
    const r = await fetch('https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    const allItems = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const titles = allItems.slice(0,5).map(([,ix]) => {
      const t = ix.match(/<title><!\[CDATA\[(.*?)\]\]>/i)?.[1] ?? ix.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
      return t.slice(0,80);
    });
    results.push({ source: 'NLA_NL', status: r.status, total_items: allItems.length, sample_titles: titles.join(' || ') });
  } catch(e) { results.push({ source: 'NLA_NL', error: e.message }); }

  // ── ELA Europe: show ALL items ───────────────────────────────────────────
  try {
    const r = await fetch('https://www.ela.europa.eu/en/rss/news', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    const allItems = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const titles = allItems.slice(0,5).map(([,ix]) => {
      const t = ix.match(/<title><!\[CDATA\[(.*?)\]\]>/i)?.[1] ?? ix.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
      return t.slice(0,80);
    });
    results.push({ source: 'ELA_EU', status: r.status, total_items: allItems.length, sample_titles: titles.join(' || ') });
  } catch(e) { results.push({ source: 'ELA_EU', error: e.message }); }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Debug v5</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:monospace;background:#f8f6f1;padding:24px;font-size:12px}
h1{font-size:16px;font-family:system-ui;margin-bottom:16px}.card{background:#fff;border:1px solid #e0dbd0;border-radius:6px;padding:14px 18px;margin-bottom:10px}
.n{font-size:13px;font-weight:700;margin-bottom:10px;font-family:system-ui}
.row{display:flex;gap:10px;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #f5f0e8;flex-wrap:wrap}
.row:last-child{border:none}.k{color:#9a9488;min-width:120px;flex-shrink:0}
pre{background:#f0ece4;padding:8px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;font-size:11px;margin-top:4px}
</style></head><body>
<h1>Debug v5 — ${new Date().toUTCString()}</h1>
${results.map(r=>`<div class="card"><div class="n">${r.source}</div>
${Object.entries(r).filter(([k])=>k!=='source').map(([k,v])=>`<div class="row"><span class="k">${k}:</span><span>${String(v).length>200?`<pre>${v}</pre>`:v}</span></div>`).join('')}
</div>`).join('')}
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
