// WageTheft.live — Data Fetchers — FIXED April 2026
// Fix 1: Canada "unsupported Unicode escape sequence" — caused by backslashes
//         in French company names. Fix: strip backslashes in htmlToText()
// Fix 2: DOL — AWS API Gateway needs lowercase 'x-api-key' header
// Fix 3: HMRC — tries Content API then falls back to known xlsx URLs

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\\/g, '')   // CRITICAL: backslashes cause "unsupported Unicode escape sequence"
    .trim()
    .replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};

export const toInt      = (v) => { const n = parseInt(v, 10);  return isNaN(n) || n < 0 ? 0 : n; };
export const toFloat    = (v) => { const n = parseFloat(v);    return isNaN(n) || n < 0 ? 0 : n; };
export const toFloatStr = (s) => toFloat(String(s ?? '').replace(/[^0-9.]/g, ''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y) || y < 1990 || y > 2100 ? null : y;
};

// Safe HTML stripper — no backslashes, no unicode issues
function htmlText(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\\/g, '')   // strip backslashes — French names have them
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── USA DOL ────────────────────────────────────────────────────────────────
export async function fetchDOL(apiKey) {
  const rows = [];
  if (!apiKey) return rows;

  for (let offset = 0; offset < 2500; offset += 500) {
    try {
      const res = await fetch(
        `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=${offset}`,
        {
          headers: {
            'x-api-key': apiKey,  // lowercase — AWS API Gateway requirement
            'Accept':    'application/json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(45000),
        }
      );
      if (!res.ok) { console.warn(`[DOL] HTTP ${res.status}`); break; }

      const json    = await res.json();
      const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? json?.d?.results ?? []);
      if (!records.length) break;

      for (const r of records) {
        const bw   = toFloat(r.bw_atp_amt ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? null),
          industry:           sanitize(r.naic_description ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? 0),
          city:               sanitize(r.city_nm ?? null),
          state_province:     sanitize(r.st_cd ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? null),
          case_id:            sanitize(r.case_id ?? null),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }
      console.log(`[DOL] offset=${offset} got=${records.length} rows=${rows.length}`);
      if (records.length < 500) break;
    } catch(e) { console.error('[DOL]', e.message); break; }
  }
  console.log(`[DOL] done: ${rows.length}`);
  return rows;
}

function dolType(r) {
  const t = [];
  if (toFloat(r.flsa_bw_atp_amt) > 0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt) > 0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt) > 0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt)  > 0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)   > 0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)      > 0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ─── UK HMRC ────────────────────────────────────────────────────────────────
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch(e) { console.error('[HMRC] xlsx missing:', e.message); return rows; }

  const urls = [];

  // Try Content API for fresh URLs
  try {
    const r = await fetch(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    if (r.ok) {
      const t = await r.text();
      if (t.trim().startsWith('{')) {
        const j = JSON.parse(t);
        for (const a of (j?.details?.attachments ?? [])) {
          const u = a.url ?? '';
          if (/\.(xlsx?|csv)$/i.test(u)) urls.push(u);
        }
      }
    }
    console.log(`[HMRC] Content API: ${urls.length} files`);
  } catch(e) { console.warn('[HMRC] Content API:', e.message); }

  // Fallbacks
  ['https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
   'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
   'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ].forEach(u => { if (!urls.includes(u)) urls.push(u); });

  for (const url of urls) {
    if (rows.length > 0) break;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { console.warn(`[HMRC] ${url.split('/').pop()} ${r.status}`); continue; }

      if (/\.xlsx?$/i.test(url)) {
        const buf  = await r.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const h    = (data[0] ?? []).map(x => String(x).toLowerCase().trim());
        const col  = (...ts) => { for (const t of ts) { const i = h.findIndex(x => x.includes(t)); if (i !== -1) return i; } return -1; };
        const nc   = col('employer') !== -1 ? col('employer') : 0;
        const yc   = col('year')     !== -1 ? col('year') : 1;
        const sc   = col('sector', 'industry') !== -1 ? col('sector', 'industry') : 2;
        const ac   = col('amount', 'arrears') !== -1 ? col('amount', 'arrears') : 3;
        const wc   = col('worker', 'employee') !== -1 ? col('worker', 'employee') : 4;
        const pc   = col('penalty') !== -1 ? col('penalty') : 5;
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          const nm = sanitize(String(row[nc] ?? ''));
          if (!nm || nm.length < 2) continue;
          rows.push({
            company_name:       nm,
            industry:           sanitize(String(row[sc] ?? '')),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(row[wc] ?? '').replace(/\D/g, '')),
            amount_back_wages:  toFloatStr(String(row[ac] ?? '')),
            amount_penalties:   toFloatStr(String(row[pc] ?? '')),
            country:            'UK',
            year:               toInt(String(row[yc] ?? '').replace(/\D/g, '')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        }
      } else {
        const text = await r.text();
        if (text.trim().startsWith('<') || text.trim().startsWith('{')) continue;
        text.split(/\r?\n/).filter(l => l.trim()).slice(1).forEach((line, i) => {
          const cols = []; let cur = ''; let inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else cur += ch;
          }
          cols.push(cur.trim());
          const nm = sanitize(cols[0]); const bw = toFloatStr(cols[3] ?? '');
          if (!nm || bw <= 0) return;
          rows.push({
            company_name: nm, industry: sanitize(cols[2]),
            violation_type: 'National Minimum Wage Underpayment',
            employees_affected: toInt(String(cols[4] ?? '').replace(/\D/g, '')),
            amount_back_wages: bw, amount_penalties: toFloatStr(cols[5] ?? ''),
            country: 'UK', year: toInt(String(cols[1] ?? '').replace(/\D/g, '')) || new Date().getFullYear(),
            case_id: `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${i}`,
            source_agency: 'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url: 'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        });
      }
      console.log(`[HMRC] ${url.split('/').pop()} → ${rows.length} rows`);
    } catch(e) { console.warn('[HMRC]', e.message); }
  }
  console.log(`[HMRC] done: ${rows.length}`);
  return rows;
}

// ─── Canada ESDC ────────────────────────────────────────────────────────────
export async function fetchCanada() {
  const rows = [];
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    const res   = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html   = await res.text();
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    let found = 0;

    for (const table of tables) {
      for (const [, tr] of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => htmlText(c));  // KEY FIX: use htmlText() not raw string
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const prov = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
        const amC  = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yrC  = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name: name, state_province: sanitize(prov),
          violation_type: 'Canada Labour Code Violation',
          amount_back_wages: amC ? toFloat(amC.replace(/[^0-9.]/g, '')) : 0,
          employees_affected: 0, country: 'Canada',
          year: yrC ? toInt(yrC) : new Date().getFullYear(),
          case_id: `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${found}`,
          source_agency: 'Employment and Social Development Canada',
          source_url: 'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    if (rows.length === 0) {
      for (const li of (html.match(/<li[^>]*>[\s\S]*?<\/li>/gi) ?? [])) {
        const text = htmlText(li);
        if (text.length < 5 || text.length > 300 || !/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|fran|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name || name.length < 3) continue;
        const am = text.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
        rows.push({
          company_name: name,
          state_province: text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null,
          violation_type: 'Canada Labour Code Violation',
          amount_back_wages: am ? toFloat(am[1].replace(/,/g, '')) : 0,
          employees_affected: 0, country: 'Canada',
          year: new Date().getFullYear(),
          case_id: `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency: 'Employment and Social Development Canada',
          source_url: 'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }
  } catch(e) { console.error('[ESDC]', e.message); }
  console.log(`[ESDC] done: ${rows.length}`);
  return rows;
}

export async function fetchAustralia()   { return []; }
export async function fetchIreland()     { return []; }
export async function fetchNetherlands() { return []; }
export async function fetchEurope()      { return []; }
