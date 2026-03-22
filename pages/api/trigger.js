export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const UA  = 'Mozilla/5.0 (compatible; WageTheft.live/1.0)';
  const key = process.env.DOL_API_KEY;
  const out = {};

  // DOL — show raw first 400 chars
  try {
    const r = await fetch(
      `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=3&offset=0`,
      { headers:{ 'X-API-KEY':key, Accept:'application/json', 'User-Agent':UA }, signal:AbortSignal.timeout(15000) }
    );
    out.DOL = `HTTP ${r.status} | ${(await r.text()).slice(0,400)}`;
  } catch(e) { out.DOL = `ERROR: ${e.message}`; }

  // HMRC page — does it load? Any xlsx links?
  try {
    const r = await fetch(
      'https://www.gov.uk/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers:{ 'User-Agent':UA }, signal:AbortSignal.timeout(15000) }
    );
    const html = await r.text();
    const links = [...html.matchAll(/href="([^"]*\.xlsx?[^"]*)"/gi)].map(m=>m[1]).slice(0,5);
    out.HMRC = `HTTP ${r.status} | ${html.length} bytes | XLSX links: ${links.join(' || ') || 'NONE'}`;
  } catch(e) { out.HMRC = `ERROR: ${e.message}`; }

  // NLA — raw XML first 600 chars
  try {
    const r = await fetch('https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
      { headers:{ 'User-Agent':UA, Accept:'*/*' }, signal:AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    out.NLA = `HTTP ${r.status} | ${text.length} bytes | START: ${text.slice(0,600).replace(/\s+/g,' ')}`;
  } catch(e) { out.NLA = `ERROR: ${e.message}`; }

  // ELA — raw XML first 600 chars
  try {
    const r = await fetch('https://www.ela.europa.eu/en/rss/news',
      { headers:{ 'User-Agent':UA, Accept:'*/*' }, signal:AbortSignal.timeout(15000) }
    );
    const text = await r.text();
    out.ELA = `HTTP ${r.status} | ${text.length} bytes | START: ${text.slice(0,600).replace(/\s+/g,' ')}`;
  } catch(e) { out.ELA = `ERROR: ${e.message}`; }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Raw Debug</title>
<style>body{font-family:monospace;background:#f8f6f1;padding:20px;font-size:12px}
h2{font-family:system-ui;font-size:14px;margin:16px 0 6px;font-weight:700}
pre{background:#fff;border:1px solid #ddd;padding:12px;border-radius:4px;white-space:pre-wrap;word-break:break-all;font-size:11px;line-height:1.6}
</style></head><body>
${Object.entries(out).map(([k,v])=>`<h2>${k}</h2><pre>${v.replace(/</g,'&lt;')}</pre>`).join('')}
</body></html>`;

  res.setHeader('Content-Type','text/html');
  return res.status(200).send(html);
}
