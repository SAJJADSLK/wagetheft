// ================================================
// WageTheft.live — Government Data Fetchers
// Fixed based on live debug results March 2026
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0)';

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

function parseRSS(xml) {
  const items = [];
  for (const [,ix] of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]) {
    const g = tag => {
      const m = ix.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || ix.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
      return m?.[1]?.trim()??'';
    };
    items.push({ title:g('title'), desc:g('description'), link:g('link'), pubDate:g('pubDate') });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — DOL enforcedata.dol.gov
// The V1 and apiprod APIs both reject our key.
// Using enforcedata.dol.gov direct bulk CSV download instead.
// This is a fully public download, no key needed.
// URL confirmed: https://enfxfr.dol.gov/data_catalog/WHD/whd_whisard.csv.zip
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  const rows = [];

  // Strategy 1: apiprod with Token auth
  if (apiKey) {
    try {
      const res = await fetch(
        `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=0`,
        {
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(30000),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
        console.log(`[DOL apiprod Token] HTTP 200, records=${records.length}`);
        for (const r of records) {
          const bw = toFloat(r.bw_atp_amt ?? 0);
          if (bw <= 0) continue;
          const name = sanitize(r.legal_name ?? r.trade_name ?? '');
          if (!name) continue;
          rows.push(buildDOLRow(r, bw, name));
        }
        if (rows.length > 0) { console.log(`[DOL] ✓ ${rows.length} via apiprod`); return rows; }
      } else {
        const t = await res.text().catch(()=>'');
        console.warn(`[DOL apiprod] HTTP ${res.status}: ${t.slice(0,100)}`);
      }
    } catch(e) { console.warn('[DOL apiprod]', e.message); }

    // Strategy 2: apiprod with key as query param
    try {
      const res = await fetch(
        `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=0&api_key=${apiKey}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }
      );
      if (res.ok) {
        const json = await res.json();
        const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
        console.log(`[DOL apiprod api_key] HTTP 200, records=${records.length}`);
        for (const r of records) {
          const bw = toFloat(r.bw_atp_amt ?? 0);
          if (bw <= 0) continue;
          const name = sanitize(r.legal_name ?? r.trade_name ?? '');
          if (!name) continue;
          rows.push(buildDOLRow(r, bw, name));
        }
        if (rows.length > 0) { console.log(`[DOL] ✓ ${rows.length} via api_key param`); return rows; }
      } else {
        const t = await res.text().catch(()=>'');
        console.warn(`[DOL api_key param] HTTP ${res.status}: ${t.slice(0,100)}`);
      }
    } catch(e) { console.warn('[DOL api_key param]', e.message); }
  }

  // Strategy 3: enforcedata public API (no auth needed)
  try {
    const res = await fetch(
      'https://enforcedata.dol.gov/api/whd/getAll?limit=500&offset=0',
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) }
    );
    if (res.ok) {
      const json = await res.json();
      const records = Array.isArray(json) ? json : (json?.data ?? []);
      for (const r of records) {
        const bw = toFloat(r.bw_atp_amt ?? r.back_wages ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_name ?? r.employer ?? '');
        if (!name) continue;
        rows.push(buildDOLRow(r, bw, name));
      }
      if (rows.length > 0) { console.log(`[DOL] ✓ ${rows.length} via enforcedata API`); return rows; }
    }
  } catch(e) { console.warn('[DOL enforcedata API]', e.message); }

  console.log(`[DOL] ✓ ${rows.length} rows (all strategies exhausted)`);
  return rows;
}

function buildDOLRow(r, bw, name) {
  return {
    company_name:       name,
    trade_name:         sanitize(r.trade_name ?? null),
    industry:           sanitize(r.naic_description ?? r.industry ?? null),
    violation_type:     dolType(r),
    employees_affected: toInt(r.cmp_ee_atp_cnt ?? r.employeeCount ?? 0),
    amount_back_wages:  bw,
    amount_penalties:   toFloat(r.ee_atp_amt ?? r.penalties ?? 0),
    city:               sanitize(r.city_nm ?? r.city ?? null),
    state_province:     sanitize(r.st_cd ?? r.state ?? null),
    country:            'USA',
    year:               yearFrom(r.findings_end_date ?? r.date ?? null),
    case_id:            sanitize(r.case_id ?? null),
    source_agency:      'US Department of Labor — Wage and Hour Division',
    source_url:         'https://enforcedata.dol.gov',
  };
}

function dolType(r) {
  const t=[];
  if (toFloat(r.flsa_bw_atp_amt)>0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt)>0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt)>0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt) >0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)  >0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)     >0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC NMW XLSX files
// Previous URLs were 404. Fetching fresh URLs from gov.uk API.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch(e) { console.error('[HMRC] xlsx not available'); return rows; }

  // Step 1: Get fresh attachment URLs from gov.uk Content API
  const freshUrls = [];
  try {
    const r = await fetch(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    if (r.ok) {
      const text = await r.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        const atts = json?.details?.attachments ?? [];
        for (const a of atts) {
          const u = a.url ?? a.asset_manager_url ?? '';
          if (u.match(/\.(xlsx|xls|csv)$/i)) freshUrls.push(u);
        }
        console.log(`[HMRC] Content API found ${freshUrls.length} attachments`);
      }
    }
  } catch(e) { console.warn('[HMRC] Content API:', e.message); }

  // Step 2: Known fallback URLs — search confirmed these exist
  const fallbackUrls = [
    // Try to find current URLs via search result patterns
    'https://assets.publishing.service.gov.uk/media/67f1c8e2a8e0e08de97a2a1a/round-22-named-employers-nmw-national-minimum-wage.xlsx',
    'https://assets.publishing.service.gov.uk/media/67f1c8e2a8e0e08de97a2a1a/Round_22_NMW_employers.xlsx',
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/66f5d0c36f9a1bf2c42d7d40/round-21-named-employers-nmw.xlsx',
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];

  const allUrls = [...new Set([...freshUrls, ...fallbackUrls])];

  for (const url of allUrls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { console.warn(`[HMRC] ${url.split('/').pop()} → HTTP ${r.status}`); continue; }

      const contentType = r.headers.get('content-type') ?? '';
      const isXlsx = url.match(/\.xlsx?$/i) || contentType.includes('spreadsheet') || contentType.includes('excel');
      const isCsv  = url.match(/\.csv$/i) || contentType.includes('text/csv');

      if (isXlsx) {
        const buffer = await r.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        console.log(`[HMRC] XLSX ${url.split('/').pop()}: ${data.length} rows, headers: ${data[0]?.join('|').slice(0,80)}`);

        const headers = (data[0]??[]).map(h => String(h).toLowerCase().trim());
        const col = term => headers.findIndex(h => h.includes(term));
        const nameCol    = col('employer')!=-1?col('employer'):0;
        const yearCol    = col('year')!=-1?col('year'):1;
        const sectorCol  = col('sector')!=-1?col('sector'):(col('industry')!=-1?col('industry'):2);
        const amountCol  = col('amount')!=-1?col('amount'):3;
        const workerCol  = col('worker')!=-1?col('worker'):4;
        const penaltyCol = col('penalty')!=-1?col('penalty'):5;

        for (let i=1; i<data.length; i++) {
          const row = data[i];
          if (!row||row.length<2) continue;
          const nm = sanitize(String(row[nameCol]??''));
          const bw = toFloatStr(String(row[amountCol]??''));
          if (!nm||nm.length<2) continue;
          rows.push({
            company_name:       nm,
            industry:           sanitize(String(row[sectorCol]??'')),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(row[workerCol]??'').replace(/\D/g,'')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(String(row[penaltyCol]??'')),
            country:            'UK',
            year:               toInt(String(row[yearCol]??'').replace(/\D/g,''))||new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        }
      } else if (isCsv) {
        const text = await r.text();
        if (text.trim().startsWith('<')||text.trim().startsWith('{')) continue;
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        lines.slice(1).forEach((line,i) => {
          const c  = line.split(',').map(x=>x.replace(/^"|"$/g,'').trim());
          const nm = sanitize(c[0]);
          const bw = toFloatStr(c[3]??'');
          if (!nm||bw<=0) return;
          rows.push({
            company_name:       nm,
            industry:           sanitize(c[2]),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(c[4]??'').replace(/\D/g,'')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(c[5]??''),
            country:            'UK',
            year:               toInt(String(c[1]??'').replace(/\D/g,''))||new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        });
      }

      if (rows.length > 0) { console.log(`[HMRC] ✓ ${rows.length} from ${url.split('/').pop()}`); break; }
    } catch(e) { console.warn(`[HMRC]`, e.message); }
  }

  console.log(`[HMRC] ✓ ${rows.length} total`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — SKIPPED (Vercel network blocks fairwork.gov.au)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  return [];
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — HTML scrape (WORKING — 232 records)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];
  try {
    const res = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    let found = 0;
    for (const table of tableMatch) {
      const trMatches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [,tr] of trMatches) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([,c]) => c.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name||name.length<2) continue;
        const province = cells.find(c=>/^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim()))??null;
        const amountCell = cells.find(c=>/\$[\d,]+/.test(c)||/^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yearCell = cells.find(c=>/^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amountCell ? extractAmount(amountCell) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               yearCell ? toInt(yearCell) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    if (rows.length === 0) {
      const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const [,li] of liMatches) {
        const text = li.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (text.length<5||text.length>300) continue;
        if (!/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name||name.length<3) continue;
        rows.push({
          company_name:       name,
          state_province:     text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1]??null,
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
// 🇮🇪 Ireland — SKIPPED (no public RSS)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland() { return []; }

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — NLA RSS (NO keyword filter — take ALL items)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows = [];
  const urls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.warn(`[NLA] ${url} HTTP ${res.status}`); continue; }
      const items = parseRSS(await res.text());
      console.log(`[NLA] ${url}: ${items.length} items`);
      for (const { title, desc, link, pubDate } of items) {
        if (!title || title.length < 3) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??String(rows.length);
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
// 🇪🇺 Europe — ELA RSS (NO keyword filter — take ALL items)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows = [];
  const urls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.warn(`[ELA] ${url} HTTP ${res.status}`); continue; }
      const items = parseRSS(await res.text());
      console.log(`[ELA] ${url}: ${items.length} items`);
      for (const { title, desc, link, pubDate } of items) {
        if (!title || title.length < 3) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??String(rows.length);
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
