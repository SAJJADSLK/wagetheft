export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const UA = 'Mozilla/5.0 WageTheft.live/1.0';
  const dolKey = process.env.DOL_API_KEY;

  // DOL confirmed working: data.dol.gov/get/whd_whisard/rows:5/format:json
  // 11015 bytes for 5 rows - show full body to see structure
  let dolBody = '';
  try {
    const r = await fetch(
      `https://data.dol.gov/get/whd_whisard/rows:5/format:json`,
      { headers: { 'x-api-key': dolKey, 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    dolBody = await r.text();
  } catch(e) { dolBody = 'ERROR: ' + e.message; }

  // HMRC - try correct URL format
  let hmrcBody = '';
  const hmrcUrls = [
    'https://www.gov.uk/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
    'https://www.gov.uk/guidance/named-employers-who-have-not-paid-national-minimum-wage',
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];
  const hmrcResults = [];
  for (const u of hmrcUrls) {
    try {
      const r = await fetch(u, { headers: {'User-Agent': UA}, signal: AbortSignal.timeout(15000) });
      const text = await r.text();
      hmrcResults.push(`${u.split('/').pop()} → HTTP ${r.status} · ${text.length} bytes · ${text.slice(0,80).replace(/\n/g,' ')}`);
    } catch(e) { hmrcResults.push(`${u.split('/').pop()} → ERROR: ${e.message}`); }
  }

  // WRC Ireland RSS - show raw first 2 items
  let wrcBody = '';
  try {
    const r = await fetch('https://www.workplacerelations.ie/en/news_media/press_releases/rss', {
      headers: {'User-Agent': UA}, signal: AbortSignal.timeout(20000)
    });
    const text = await r.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,3);
    wrcBody = `HTTP ${r.status} · ${items.length} items\n` + items.map(([,ix]) => ix.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,150)).join('\n---\n');
  } catch(e) { wrcBody = 'ERROR: ' + e.message; }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Debug v6</title>
<style>body{font-family:monospace;background:#f8f6f1;padding:20px;font-size:12px}
h2{font-family:system-ui;font-size:14px;margin:16px 0 8px;font-weight:700}
pre{background:#fff;border:1px solid #ddd;padding:12px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;font-size:11px;line-height:1.5;max-height:400px;overflow-y:auto}
</style></head><body>
<h2>DOL Full Body (first 2000 chars):</h2>
<pre>${dolBody.slice(0,2000).replace(/</g,'&lt;')}</pre>

<h2>HMRC URL Tests:</h2>
<pre>${hmrcResults.join('\n').replace(/</g,'&lt;')}</pre>

<h2>WRC Ireland RSS (first 3 items raw):</h2>
<pre>${wrcBody.replace(/</g,'&lt;')}</pre>
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
