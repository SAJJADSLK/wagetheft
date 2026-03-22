// ================================================
// WageTheft.live — Government Data Fetchers  
// FINAL — March 2026
//
// CONFIRMED WORKING:
//   Canada   ✅ HTML scrape — 232 records
//
// FIXED THIS VERSION:
//   DOL USA  — X-API-KEY header (official docs confirmed)
//   HMRC UK  — HTML page scrape for xlsx links (Round 21/22)
//   NLA NL   — Atom+RSS dual parser (feeds use <entry> not <item>)
//   ELA EU   — Atom+RSS dual parser
//
// SKIPPED (confirmed blocked):
//   FWO AU   — Vercel network blocks fairwork.gov.au
//   WRC IE   — No public RSS/API
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0; +https://wagetheft.live)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};
export const toInt      = (v) => { const n = parseInt(v,10);  return isNaN(n)||n<0?0:n; };
export const toFloat    = (v) => { const n = parseFloat(v);   return isNaN(n)||n<0?0:n; };
export const toFloatStr = (s) => toFloat(String(s??'').replace(/[^0-9.]/g,''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y)||y<1990||y>2100?null:y;
};

function extractAmount(text) {
  if (!text) return 0;
  const mM = text.match(/[£$€]?\s*([\d.]+)\s*million/i);
  if (mM) return toFloat(mM[1])*1_000_000;
  const mK = text.match(/[£$€]?\s*([\d.]+)\s*[Kk]\b/);
  if (mK) return toFloat(mK[1])*1_000;
  const m = text.match(/[£$€]\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? toFloatStr(m[1]) : 0;
}

// Universal feed parser — handles RSS 2.0 (<item>) AND Atom (<entry>)
function parseFeed(xml) {
  const items = [];
  // Try RSS <item> first, then Atom <entry>
  const tagName = xml.includes('<entry') ? 'entry' : 'item';
  const matches = [...xml.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'))];

  for (const [, inner] of matches) {
    const get = (tags) => {
      for (const tag of tags) {
        // CDATA
        let m = inner.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
        if (m) return m[1].trim();
        // Plain text
        m = inner.match(new RegExp(`<${tag}[^>]*>([^<]*)<`, 'i'));
        if (m) return m[1].trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
        // Atom link with href
        m = inner.match(new RegExp(`<${tag}[^>]*href="([^"]*)"`, 'i'));
        if (m) return m[1].trim();
      }
      return '';
    };

    const title   = get(['title']);
    const link    = get(['link', 'id', 'guid']);
    const desc    = get(['description', 'summary', 'content']);
    const pubDate = get(['pubDate', 'published', 'updated', 'dc:date']);

    if (title || link) items.push({ title, link, desc, pubDate });
  }

  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — DOL apiprod.dol.gov/v4
// CONFIRMED: Header name is X-API-KEY (from official DOL API docs Aug 2024)
// URL: https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=0
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  const rows = [];
  if (!apiKey) { console.error('[DOL] Missing DOL_API_KEY'); return rows; }

  for (let offset = 0; offset < 2500; offset += 500) {
    try {
      const res = await fetch(
        `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=${offset}`,
        {
          headers: {
            'X-API-KEY': apiKey,   // Official header from DOL API docs
            'Accept':    'application/json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(45000),
        }
      );

      if (!res.ok) {
        const body = await res.text().catch(()=>'');
        console.warn(`[DOL] HTTP ${res.status} offset=${offset}: ${body.slice(0,120)}`);
        break;
      }

      const json    = await res.json();
      const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? json?.d?.results ?? []);
      if (!records.length) { console.log(`[DOL] end at offset ${offset}`); break; }

      for (const r of records) {
        const bw = toFloat(r.bw_atp_amt ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_name ?? r.employer_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? null),
          industry:           sanitize(r.naic_description ?? r.industry ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? 0),
          city:               sanitize(r.city_nm ?? r.city ?? null),
          state_province:     sanitize(r.st_cd ?? r.state ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? null),
          case_id:            sanitize(r.case_id ?? null),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }

      console.log(`[DOL] offset=${offset} parsed=${records.length} total=${rows.length}`);
      if (records.length < 500) break;
    } catch(e) {
      console.error(`[DOL offset=${offset}]`, e.message);
      break;
    }
  }

  console.log(`[DOL] ✓ ${rows.length} rows`);
  return rows;
}

function dolType(r) {
  const t = [];
  if (toFloat(r.flsa_bw_atp_amt)>0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt)>0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt)>0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt) >0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)  >0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)     >0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC NMW Named Employers (Round 21: 518, Round 22: 491)
// Strategy: Fetch the HTML publications page, extract .xlsx links, parse
// This is more robust than hardcoded URLs which expire every round
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch(e) { console.error('[HMRC] xlsx package missing:', e.message); return rows; }

  // Step 1: Fetch the gov.uk publications HTML page to find current xlsx/csv links
  const xlsxUrls = [];
  try {
    const pageRes = await fetch(
      'https://www.gov.uk/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) }
    );
    if (pageRes.ok) {
      const html = await pageRes.text();
      // Extract all xlsx/csv links from the assets domain
      const matches = [...html.matchAll(/href="(https?:\/\/assets\.publishing\.service\.gov\.uk[^"]*\.(xlsx?|csv)[^"]*)"/gi)];
      for (const [, url] of matches) {
        if (!xlsxUrls.includes(url)) xlsxUrls.push(url);
      }
      console.log(`[HMRC] Found ${xlsxUrls.length} file links from HTML page`);
    }
  } catch(e) { console.warn('[HMRC] HTML page fetch:', e.message); }

  // Step 2: Fallback known-good URLs for Round 21 and older
  const fallbacks = [
    // Round 21 — May 2025 (518 employers) — try URL pattern variations
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/683871905150d70c85aafaf1/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    // Round 20 fallback
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];
  for (const u of fallbacks) {
    if (!xlsxUrls.includes(u)) xlsxUrls.push(u);
  }

  // Step 3: Try each URL until one works
  for (const url of xlsxUrls) {
    if (rows.length > 0) break;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { console.warn(`[HMRC] ${url.split('/').pop()} HTTP ${r.status}`); continue; }

      const isXlsx = /\.xlsx?$/i.test(url);
      if (isXlsx) {
        const buf  = await r.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (data.length < 2) continue;

        const h   = (data[0] ?? []).map(x => String(x).toLowerCase().trim());
        const col = (terms) => { for (const t of terms) { const i = h.findIndex(x => x.includes(t)); if (i !== -1) return i; } return -1; };
        const nc  = col(['employer name', 'employer', 'company', 'name'])      ?? 0;
        const yc  = col(['year', 'yr'])                                         ?? 1;
        const sc  = col(['sector', 'industry', 'sic'])                          ?? 2;
        const ac  = col(['total underpayment', 'amount', 'arrears', 'wages'])   ?? 3;
        const wc  = col(['worker', 'employee', 'staff'])                        ?? 4;
        const pc  = col(['penalty', 'fine'])                                     ?? 5;

        console.log(`[HMRC] XLSX ${data.length} rows, headers: ${h.slice(0,6).join('|')}`);
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          const nm = sanitize(String(row[nc] ?? ''));
          if (!nm || nm.length < 2) continue;
          const bw = toFloatStr(String(row[ac >= 0 ? ac : 3] ?? ''));
          rows.push({
            company_name:       nm,
            industry:           sanitize(String(row[sc >= 0 ? sc : 2] ?? '')),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(row[wc >= 0 ? wc : 4] ?? '').replace(/\D/g,'')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(String(row[pc >= 0 ? pc : 5] ?? '')),
            country:            'UK',
            year:               toInt(String(row[yc >= 0 ? yc : 1] ?? '').replace(/\D/g,'')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        }
        console.log(`[HMRC] XLSX parsed ${rows.length} valid rows`);
      } else {
        // CSV fallback
        const text = await r.text();
        if (text.trim().startsWith('<') || text.trim().startsWith('{')) { console.warn('[HMRC] Not CSV'); continue; }
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        lines.slice(1).forEach((line, i) => {
          const cols = []; let cur = ''; let inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else cur += ch;
          }
          cols.push(cur.trim());
          const nm = sanitize(cols[0]);
          const bw = toFloatStr(cols[3] ?? '');
          if (!nm || bw <= 0) return;
          rows.push({
            company_name:       nm,
            industry:           sanitize(cols[2]),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(cols[4]??'').replace(/\D/g,'')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(cols[5] ?? ''),
            country:            'UK',
            year:               toInt(String(cols[1]??'').replace(/\D/g,'')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        });
        console.log(`[HMRC] CSV parsed ${rows.length} valid rows`);
      }
    } catch(e) { console.warn(`[HMRC] ${url.split('/').pop()}:`, e.message); }
  }

  console.log(`[HMRC] ✓ ${rows.length} total`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — SKIPPED (Vercel blocks fairwork.gov.au)
// 🇮🇪 Ireland — SKIPPED (no public data API)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() { return []; }
export async function fetchIreland()   { return []; }

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — HTML scrape (CONFIRMED WORKING — 232 records)
// 90 second timeout — canada.ca is genuinely slow
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const res = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    console.log(`[ESDC] page: ${Math.round(html.length/1024)}KB`);

    const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    let found = 0;
    for (const table of tableMatch) {
      const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [, tr] of trs) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => c.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const province  = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
        const amCell    = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yrCell    = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amCell ? extractAmount(amCell) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               yrCell ? toInt(yrCell) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    // Fallback: list items if no table rows found
    if (rows.length === 0) {
      for (const [, li] of [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]) {
        const text = li.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (text.length < 5 || text.length > 300 || !/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name || name.length < 3) continue;
        rows.push({
          company_name:       name,
          state_province:     text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  extractAmount(text),
          employees_affected: 0,
          country:            'Canada',
          year:               new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }
  } catch(e) { console.error('[ESDC]', e.message); }
  console.log(`[ESDC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — NLA (supports both RSS and Atom feeds)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows = [];
  const urls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss.xml',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.warn(`[NLA] ${url} HTTP ${res.status}`); continue; }
      const xml   = await res.text();
      const items = parseFeed(xml);
      console.log(`[NLA] ${url}: ${items.length} items${items[0]? `, first="${items[0].title.slice(0,50)}"`:''}`);
      for (const { title, link, desc, pubDate } of items) {
        if (!title || title.length < 3) continue;
        const slug = (link||'').split('/').filter(Boolean).pop()?.slice(0,40) ?? String(rows.length);
        rows.push({
          company_name:      sanitize(title.slice(0,120)),
          violation_type:    'Netherlands Labour Inspection',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Netherlands',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `NL-NLA-${slug}`,
          source_agency:     'Nederlandse Arbeidsinspectie — Netherlands Labour Authority',
          source_url:        link || 'https://www.nlarbeidsinspectie.nl',
        });
      }
    } catch(e) { console.warn('[NLA]', e.message); }
  }
  console.log(`[NLA-NL] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇪🇺 Europe — ELA (supports both RSS and Atom feeds)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows = [];
  const urls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
    'https://www.ela.europa.eu/en/rss',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.warn(`[ELA] ${url} HTTP ${res.status}`); continue; }
      const xml   = await res.text();
      const items = parseFeed(xml);
      console.log(`[ELA] ${url}: ${items.length} items${items[0]? `, first="${items[0].title.slice(0,50)}"`:''}`);
      for (const { title, link, desc, pubDate } of items) {
        if (!title || title.length < 3) continue;
        const slug = (link||'').split('/').filter(Boolean).pop()?.slice(0,40) ?? String(rows.length);
        rows.push({
          company_name:      sanitize(title.slice(0,120)),
          violation_type:    'EU Cross-Border Labour Inspection',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'EU',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `EU-ELA-${slug}`,
          source_agency:     'European Labour Authority (ELA)',
          source_url:        link || 'https://www.ela.europa.eu',
        });
      }
    } catch(e) { console.warn('[ELA]', e.message); }
  }
  console.log(`[ELA] ✓ ${rows.length} rows`);
  return rows;
}
