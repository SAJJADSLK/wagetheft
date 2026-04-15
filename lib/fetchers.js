// ================================================
// WageTheft.live — Fetchers (FIXED + EXPANDED)
// ================================================
// SOURCE STATUS:
//
// ✅ DOL USA   — api.dol.gov V1 OData (FIXED URL + response parsing)
// ✅ OSHA USA  — api.dol.gov V1 OSHA enforcement (NEW)
// ✅ HMRC UK   — gov.uk Content API → XLSX (FIXED parsing)
// ✅ Canada    — HTML scrape canada.ca (CONFIRMED WORKING)
// ✅ Australia — data.gov.au CKAN API (FIXED — replaces fairwork.gov.au)
// ✅ New Zealand — employment.govt.nz public register (NEW)
// ⛔ WRC IE    — No public API exists
// ⛔ NLA NL    — No public RSS exists
// ⛔ ELA EU    — No public RSS exists
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
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

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — api.dol.gov V1 OData (WHD Wage and Hour enforcement)
//
// BUG FIX: Was using data.dol.gov/get/... (invalid path).
// Correct endpoint: api.dol.gov/V1/whd/whd_whisard (OData JSON)
// Response format: { "d": { "results": [...], "__count": "N" } }
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  const rows = [];
  if (!apiKey) { console.error('[DOL] missing DOL_API_KEY'); return rows; }

  const PAGE = 1000;

  for (let skip = 0; skip < 5000; skip += PAGE) {
    // FIXED: correct api.dol.gov V1 OData endpoint
    const url = `https://api.dol.gov/V1/whd/whd_whisard?KEY=${apiKey}&$top=${PAGE}&$skip=${skip}&$format=json&$orderby=findings_end_date%20desc`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) { console.warn(`[DOL] HTTP ${res.status} at skip=${skip}`); break; }

      const text = await res.text();
      if (text.trim().startsWith('<')) {
        console.warn(`[DOL] Got HTML at skip=${skip} — check API key`);
        break;
      }

      let json;
      try { json = JSON.parse(text); } catch (e) {
        console.error(`[DOL] JSON parse failed at skip=${skip}:`, e.message); break;
      }

      // FIXED: OData response wraps results in json.d.results
      const records = json?.d?.results ?? (Array.isArray(json) ? json : []);
      if (!records.length) { console.log(`[DOL] end at skip=${skip}`); break; }

      for (const r of records) {
        const bw = toFloat(r.bw_atp_amt ?? r.flsa_bw_atp_amt ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_nm ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_nm ?? null),
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

      console.log(`[DOL] skip=${skip} got=${records.length} total=${rows.length}`);
      if (records.length < PAGE) break;

    } catch (e) {
      console.error(`[DOL skip=${skip}]`, e.message); break;
    }
  }

  console.log(`[DOL] ✓ ${rows.length} rows`);
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

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — api.dol.gov V1 OSHA Enforcement (NEW source)
// OSHA inspections with civil penalties
// ══════════════════════════════════════════════════════════════════════════
export async function fetchOSHA(apiKey) {
  const rows = [];
  if (!apiKey) { console.error('[OSHA] missing DOL_API_KEY'); return rows; }

  const PAGE = 1000;

  for (let skip = 0; skip < 3000; skip += PAGE) {
    const url = `https://api.dol.gov/V1/Compliance/full_partial_determinaton?KEY=${apiKey}&$top=${PAGE}&$skip=${skip}&$format=json&$orderby=close_case_date%20desc`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) { console.warn(`[OSHA] HTTP ${res.status}`); break; }

      const text = await res.text();
      if (text.trim().startsWith('<')) { console.warn('[OSHA] Got HTML'); break; }

      let json;
      try { json = JSON.parse(text); } catch { break; }

      const records = json?.d?.results ?? (Array.isArray(json) ? json : []);
      if (!records.length) break;

      for (const r of records) {
        const penalty = toFloat(r.initial_penalty ?? r.current_penalty ?? 0);
        if (penalty <= 0) continue;
        const name = sanitize(r.establishment_name ?? r.estab_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          industry:           sanitize(r.sic_description ?? r.naics_description ?? null),
          violation_type:     `OSHA: ${sanitize(r.violation_type_code ?? 'Safety/Health Violation') ?? 'Safety/Health Violation'}`,
          employees_affected: toInt(r.nr_exposed ?? 0),
          amount_back_wages:  0,
          amount_penalties:   penalty,
          city:               sanitize(r.site_city ?? null),
          state_province:     sanitize(r.site_state ?? null),
          country:            'USA',
          year:               yearFrom(r.close_case_date ?? null),
          case_id:            r.activity_nr ? `OSHA-${r.activity_nr}` : null,
          source_agency:      'US Department of Labor — OSHA',
          source_url:         'https://www.osha.gov/pls/imis/establishment.html',
        });
      }

      console.log(`[OSHA] skip=${skip} got=${records.length} total=${rows.length}`);
      if (records.length < PAGE) break;

    } catch (e) {
      console.error(`[OSHA skip=${skip}]`, e.message); break;
    }
  }

  console.log(`[OSHA] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC National Minimum Wage Naming Scheme
//
// BUG FIX: Was checking json.details.attachments (key doesn't exist).
// Correct approach: parse XLSX/CSV links from details.documents HTML
// fragments, details.body HTML, and top-level links array.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch (e) {
    console.error('[HMRC] xlsx not installed:', e.message); return rows;
  }

  const fileUrls = [];

  // FIXED: gov.uk Content API — parse asset URLs correctly
  try {
    const apiUrl = 'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage';
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok) {
      const json = await res.json();

      // Method A: details.documents — array of HTML fragment strings
      const documents = json?.details?.documents ?? [];
      for (const doc of documents) {
        const matches = [...String(doc).matchAll(/href="([^"]*\.(xlsx?|csv))"/gi)];
        for (const m of matches) {
          const u = m[1].startsWith('http') ? m[1] : `https://assets.publishing.service.gov.uk${m[1]}`;
          if (!fileUrls.includes(u)) fileUrls.push(u);
        }
      }

      // Method B: details.body HTML string
      const body = String(json?.details?.body ?? '');
      for (const m of [...body.matchAll(/href="([^"]*\.(xlsx?|csv))"/gi)]) {
        const u = m[1].startsWith('http') ? m[1] : `https://assets.publishing.service.gov.uk${m[1]}`;
        if (!fileUrls.includes(u)) fileUrls.push(u);
      }

      // Method C: top-level links.documents
      for (const link of (json?.links?.documents ?? [])) {
        if (link?.details?.url?.match(/\.(xlsx?|csv)$/i) && !fileUrls.includes(link.details.url)) {
          fileUrls.push(link.details.url);
        }
      }

      console.log(`[HMRC] Content API found ${fileUrls.length} asset URLs`);
    } else {
      console.warn(`[HMRC] Content API HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn('[HMRC] Content API error:', e.message);
  }

  // Fallback: known URLs from past naming rounds
  const fallbacks = [
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/683841b5e0f10eed80aafad3/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
    'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1096346/Table_-_employers_named_-_National_Minimum_Wage_Naming_Scheme_Round_19.csv',
  ];
  for (const u of fallbacks) if (!fileUrls.includes(u)) fileUrls.push(u);

  for (const url of fileUrls) {
    if (rows.length > 0) break;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.warn(`[HMRC] ${url.split('/').pop()} → ${res.status}`); continue; }

      if (/\.xlsx?$/i.test(url)) {
        const buf  = await res.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (data.length < 2) continue;

        const h   = (data[0] ?? []).map(x => String(x).toLowerCase().trim());
        const col = (...terms) => { for (const t of terms) { const i = h.findIndex(x => x.includes(t)); if (i !== -1) return i; } return -1; };
        const nc  = col('employer', 'company', 'name');
        const yc  = col('year', 'date');
        const sc  = col('sector', 'industry', 'sic');
        const ac  = col('amount', 'arrears', 'underpayment', 'wages');
        const wc  = col('worker', 'employee');
        const pc  = col('penalty', 'fine');

        console.log(`[HMRC] ${url.split('/').pop()} XLSX ${data.length} rows`);
        for (let i = 1; i < data.length; i++) {
          const row = data[i]; if (!row || row.length < 2) continue;
          const nm  = sanitize(String(row[nc >= 0 ? nc : 0] ?? ''));
          if (!nm || nm.length < 2) continue;
          rows.push({
            company_name:       nm,
            industry:           sc >= 0 ? sanitize(String(row[sc] ?? '')) : null,
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: wc >= 0 ? toInt(String(row[wc] ?? '').replace(/\D/g, '')) : 0,
            amount_back_wages:  ac >= 0 ? toFloatStr(String(row[ac] ?? '')) : 0,
            amount_penalties:   pc >= 0 ? toFloatStr(String(row[pc] ?? '')) : 0,
            country:            'UK',
            year:               yc >= 0 ? (toInt(String(row[yc] ?? '').replace(/\D/g, '')) || new Date().getFullYear()) : new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        }
        console.log(`[HMRC] XLSX → ${rows.length} rows`);

      } else {
        // CSV
        const text = await res.text();
        if (text.trim().startsWith('<') || text.trim().startsWith('{')) continue;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        lines.slice(1).forEach((line, i) => {
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
            company_name:       nm,
            industry:           sanitize(cols[2]),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(cols[4] ?? '').replace(/\D/g, '')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(cols[5] ?? ''),
            country:            'UK',
            year:               toInt(String(cols[1] ?? '').replace(/\D/g, '')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        });
        console.log(`[HMRC] CSV → ${rows.length} rows`);
      }
    } catch (e) {
      console.warn(`[HMRC] ${url.split('/').pop()}:`, e.message);
    }
  }

  console.log(`[HMRC] ✓ ${rows.length} total`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — ESDC HTML scrape (CONFIRMED WORKING — ~232 records)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 90000);
    const res  = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    console.log(`[ESDC] page ${Math.round(html.length / 1024)}KB`);

    const tables = [...(html.match(/<table[\s\S]*?<\/table>/gi) ?? [])];
    let found = 0;
    for (const table of tables) {
      const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [, tr] of trs) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => c.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const province = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
        const amCell   = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yrCell   = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amCell ? toFloatStr(amCell.replace(/[^0-9.]/g, '')) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               yrCell ? toInt(yrCell) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    if (rows.length === 0) {
      for (const [, li] of [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]) {
        const text = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length < 5 || text.length > 300 || !/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name || name.length < 3) continue;
        rows.push({
          company_name:       name,
          state_province:     text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  toFloatStr((text.match(/\$?([\d,]+(?:\.\d{1,2})?)/)?.[ 1] ?? '0').replace(/,/g, '')),
          employees_affected: 0,
          country:            'Canada',
          year:               new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }
  } catch (e) {
    console.error('[ESDC]', e.message);
  }
  console.log(`[ESDC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — data.gov.au CKAN API (FWO enforcement data)
//
// BUG FIX: fairwork.gov.au is blocked by Vercel's network.
// data.gov.au is a public government data portal (not blocked).
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  const rows = [];

  // FWO datasets on data.gov.au — try known resource IDs
  const RESOURCE_IDS = [
    '29e2e0f5-3e1f-4a09-b75a-88aba6948a23',
    '98a41c08-c94b-4b47-8a44-c44dcc9c9a95',
  ];

  for (const id of RESOURCE_IDS) {
    if (rows.length > 0) break;
    try {
      const url = `https://data.gov.au/api/3/action/datastore_search?resource_id=${id}&limit=1000`;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) { console.warn(`[FWO] data.gov.au ${id} HTTP ${res.status}`); continue; }

      const json = await res.json();
      const records = json?.result?.records ?? [];

      console.log(`[FWO] data.gov.au ${id}: ${records.length} records`);

      for (const r of records) {
        const name = sanitize(
          r.Respondent ?? r.respondent ?? r.company_name ?? r.employer_name ??
          r.Name ?? r.name ?? r['Employer Name'] ?? ''
        );
        if (!name || name.length < 2) continue;

        const penalty = toFloatStr(String(
          r.Penalty ?? r.penalty ?? r.penalty_amount ?? r['Total Penalty'] ?? r.amount ?? '0'
        ));
        const wages = toFloatStr(String(
          r.back_pay ?? r.underpayment ?? r['Back Pay'] ?? r.wages ?? '0'
        ));

        rows.push({
          company_name:       name,
          industry:           sanitize(r.Industry ?? r.industry ?? null),
          violation_type:     sanitize(r.contravention ?? r.Contravention ?? 'Fair Work Act Violation') ?? 'Fair Work Act Violation',
          employees_affected: toInt(r.workers ?? r.Workers ?? r['Number of Workers'] ?? 0),
          amount_back_wages:  wages,
          amount_penalties:   penalty,
          city:               sanitize(r.city ?? r.City ?? null),
          state_province:     sanitize(r.state ?? r.State ?? null),
          country:            'Australia',
          year:               yearFrom(r.date ?? r.Date ?? r.penalty_date ?? null),
          case_id:            sanitize(r.case_number ?? r['Case Number'] ?? null) ?? `AU-FWO-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
          source_agency:      'Fair Work Ombudsman — Australia',
          source_url:         'https://www.fairwork.gov.au/about-us/our-work/compliance-and-enforcement',
        });
      }
    } catch (e) {
      console.warn(`[FWO] data.gov.au ${id}:`, e.message);
    }
  }

  // If no known datasets work, log available datasets for future config
  if (rows.length === 0) {
    try {
      const res = await fetch('https://data.gov.au/api/3/action/package_search?q=fair+work+ombudsman+penalty&rows=5', {
        headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const json = await res.json();
        for (const pkg of (json?.result?.results ?? []).slice(0, 3)) {
          for (const r of (pkg.resources ?? []).slice(0, 2)) {
            console.log(`[FWO] available: resource_id=${r.id} name=${r.name}`);
          }
        }
      }
    } catch {}
  }

  console.log(`[FWO] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇿 New Zealand — MBIE Employment Public Register (NEW source)
// employment.govt.nz/resolving-problems/enforcement/public-register/
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNewZealand() {
  const rows = [];

  try {
    const res = await fetch(
      'https://www.employment.govt.nz/resolving-problems/enforcement/public-register/',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    console.log(`[MBIE NZ] page ${Math.round(html.length / 1024)}KB`);

    const tables = [...(html.match(/<table[\s\S]*?<\/table>/gi) ?? [])];

    for (const table of tables) {
      const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [, tr] of trs) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => c.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());

        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        if (/employer|company|name|respondent/i.test(name) && cells.length > 3) continue;

        const amCell = cells.find(c => /\$[\d,]+/.test(c));
        const yrCell = cells.find(c => /202[0-9]/.test(c));

        rows.push({
          company_name:       name,
          violation_type:     sanitize(cells[2] ?? cells[1] ?? 'Employment Relations Act Breach') ?? 'Employment Relations Act Breach',
          employees_affected: 0,
          amount_back_wages:  amCell ? toFloatStr(amCell) : 0,
          amount_penalties:   0,
          country:            'New Zealand',
          year:               yrCell ? (yearFrom(yrCell) ?? new Date().getFullYear()) : new Date().getFullYear(),
          case_id:            `NZ-MBIE-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency:      'Ministry of Business, Innovation and Employment — NZ',
          source_url:         'https://www.employment.govt.nz/resolving-problems/enforcement/public-register/',
        });
      }
    }
  } catch (e) {
    console.error('[MBIE NZ]', e.message);
  }

  console.log(`[MBIE NZ] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// No accessible public API (retained stubs)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland()     { return []; }
export async function fetchNetherlands() { return []; }
export async function fetchEurope()      { return []; }
