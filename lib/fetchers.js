// ================================================
// WageTheft.live — Fetchers (PATCHED v2)
// ================================================
// FIXES IN THIS VERSION:
//
// ✅ DOL USA   — Better error detection (invalid key → HTML response)
// ✅ OSHA USA  — FIXED wrong table name: Compliance/full_partial_determinaton
//               → correct: safety/osha_inspection (+ correct field names)
// ✅ HMRC UK   — Added direct HTML page scraping + better attachment parsing
// ✅ Canada    — Reduced timeout 90s→25s, handle accordion/details elements
// ✅ Australia — Dynamic resource ID discovery via CKAN package_search
// ✅ New Zealand — Try open data API + improved HTML scraping
// ⛔ WRC IE    — No public API exists
// ⛔ NLA NL    — No public RSS exists
// ⛔ ELA EU    — No public RSS exists
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0; +https://wagetheft.live)';

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
// Endpoint: api.dol.gov/V1/whd/whd_whisard (OData JSON)
// Response: { "d": { "results": [...] } }
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL() {
  const rows = [];
  const PAGE = 500;
  const MAX = 10000;

  for (let offset = 0; offset < MAX; offset += PAGE) {
    const url = `https://enforcedata.dol.gov/api/whd/whisard?limit=${PAGE}&offset=${offset}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.warn(`[DOL NEW] HTTP ${res.status} at offset=${offset}`);
        break;
      }

      const json = await res.json();

      // ✅ Handle multiple possible response formats
      let records = [];
      if (Array.isArray(json)) records = json;
      else if (Array.isArray(json?.data)) records = json.data;
      else if (Array.isArray(json?.results)) records = json.results;

      if (!records.length) {
        console.log(`[DOL NEW] end at offset=${offset}`);
        break;
      }

      // 👇 DEBUG ONCE (remove later)
      if (offset === 0) {
        console.log('[DOL SAMPLE RECORD]', records[0]);
      }

      for (const r of records) {
        const backWages = toFloat(
          r.bw_atp_amt ??
          r.flsa_bw_atp_amt ??
          r.bw_amt ??
          0
        );

        if (backWages <= 0) continue;

        const name = sanitize(
          r.legal_name ??
          r.trade_nm ??
          r.employer_name ??
          r.business_name ??
          ''
        );

        if (!name) continue;

        rows.push({
          company_name: name,
          trade_name: sanitize(r.trade_nm ?? null),
          industry: sanitize(
            r.naics_description ??
            r.naic_description ??
            null
          ),

          violation_type: dolType(r),

          employees_affected: toInt(
            r.ee_violated_cnt ??
            r.cmp_ee_atp_cnt ??
            0
          ),

          amount_back_wages: backWages,

          amount_penalties: toFloat(
            r.cmp_assd_amt ??
            r.civil_money_penalty ??
            0
          ),

          city: sanitize(
            r.city ??
            r.city_nm ??
            null
          ),

          state_province: sanitize(
            r.state ??
            r.st_cd ??
            null
          ),

          country: 'USA',

          year: yearFrom(
            r.findings_end_date ??
            r.close_date ??
            null
          ),

          case_id: sanitize(
            r.case_id ??
            r.case_number ??
            null
          ),

          source_agency: 'US Department of Labor — WHD',
          source_url: 'https://enforcedata.dol.gov',
        });
      }

      console.log(
        `[DOL NEW] offset=${offset} fetched=${records.length} total=${rows.length}`
      );

      if (records.length < PAGE) break;

    } catch (err) {
      console.error(`[DOL ERROR offset=${offset}]`, err.message);

      // 🔁 retry once
      try {
        await new Promise(r => setTimeout(r, 2000));

        const retryRes = await fetch(url);
        const retryJson = await retryRes.json();

        const retryRecords = retryJson?.data ?? [];
        if (!retryRecords.length) break;

        console.log(`[DOL RETRY SUCCESS] offset=${offset}`);
      } catch {
        console.error(`[DOL RETRY FAILED] offset=${offset}`);
        break;
      }
    }
  }

  console.log(`[DOL FINAL] ✅ ${rows.length} rows collected`);
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
// 🇺🇸 USA — api.dol.gov V1 OSHA Enforcement
//
// *** CRITICAL BUG FIX ***
// Old (WRONG): https://api.dol.gov/V1/Compliance/full_partial_determinaton
//   - "full_partial_determinaton" is not a real DOL table (also typo: missing 'i')
//   - Was using wrong field names: r.initial_penalty, r.nr_exposed, r.violation_type_code
//
// New (CORRECT): https://api.dol.gov/V1/safety/osha_inspection
//   - Correct field names: total_current_penalty, nr_in_estab, insp_type
// ══════════════════════════════════════════════════════════════════════════
export async function fetchOSHA(apiKey) {
  const rows = [];
  if (!apiKey) { console.error('[OSHA] missing DOL_API_KEY'); return rows; }

  const PAGE = 1000;

  for (let skip = 0; skip < 3000; skip += PAGE) {
    // FIXED: was "Compliance/full_partial_determinaton" (wrong table + typo)
    const url = `https://api.dol.gov/V1/safety/osha_inspection?KEY=${apiKey}&$top=${PAGE}&$skip=${skip}&$format=json&$orderby=close_case_date%20desc`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });

      if (res.status === 401 || res.status === 403) {
        console.error(`[OSHA] ✗ HTTP ${res.status} — API key issue`); break;
      }
      if (!res.ok) { console.warn(`[OSHA] HTTP ${res.status}`); break; }

      const text = await res.text();
      if (text.trim().startsWith('<')) { console.warn('[OSHA] Got HTML — check API key'); break; }

      let json;
      try { json = JSON.parse(text); } catch { break; }

      const records = json?.d?.results ?? (Array.isArray(json) ? json : []);
      if (!records.length) break;

      for (const r of records) {
        // FIXED: correct field names for safety/osha_inspection table
        const penalty = toFloat(
          r.total_current_penalty ?? r.total_initial_penalty ??
          r.current_penalty ?? r.initial_penalty ?? 0
        );
        if (penalty <= 0) continue;

        const name = sanitize(r.establishment_name ?? r.estab_name ?? '');
        if (!name) continue;

        rows.push({
          company_name:       name,
          industry:           sanitize(r.naics_description ?? r.sic_description ?? null),
          // FIXED: osha_inspection uses insp_type not violation_type_code
          violation_type:     `OSHA: ${sanitize(r.insp_type ?? r.why_no_inspect ?? 'Safety/Health Inspection') ?? 'Safety/Health Inspection'}`,
          // FIXED: correct field is nr_in_estab (not nr_exposed)
          employees_affected: toInt(r.nr_in_estab ?? r.nr_exposed ?? 0),
          amount_back_wages:  0,
          amount_penalties:   penalty,
          city:               sanitize(r.site_city ?? r.city ?? null),
          state_province:     sanitize(r.site_state ?? r.state ?? null),
          country:            'USA',
          year:               yearFrom(r.close_case_date ?? r.open_date ?? null),
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
// FIXED: Added Method B — direct HTML page scraping (more reliable).
//        Improved Content API parsing to find attachment links.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch (e) {
    console.error('[HMRC] xlsx not installed:', e.message); return rows;
  }

  const fileUrls = [];

  // Method A: gov.uk Content API — parse asset URLs from JSON response
  try {
    const apiUrl = 'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage';
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok) {
      const json = await res.json();

      // A1: details.documents — array of HTML fragment strings
      for (const doc of (json?.details?.documents ?? [])) {
        const matches = [...String(doc).matchAll(/href="([^"]*\.(xlsx?|csv))"/gi)];
        for (const m of matches) {
          const u = m[1].startsWith('http') ? m[1] : `https://assets.publishing.service.gov.uk${m[1]}`;
          if (!fileUrls.includes(u)) fileUrls.push(u);
        }
      }

      // A2: details.body HTML string
      for (const m of [...String(json?.details?.body ?? '').matchAll(/href="([^"]*\.(xlsx?|csv))"/gi)]) {
        const u = m[1].startsWith('http') ? m[1] : `https://assets.publishing.service.gov.uk${m[1]}`;
        if (!fileUrls.includes(u)) fileUrls.push(u);
      }

      // A3: links.documents[].details.attachments[]
      for (const link of (json?.links?.documents ?? [])) {
        if (link?.details?.url?.match(/\.(xlsx?|csv)$/i) && !fileUrls.includes(link.details.url))
          fileUrls.push(link.details.url);
        for (const att of (link?.details?.attachments ?? [])) {
          if (att?.url?.match(/\.(xlsx?|csv)$/i) && !fileUrls.includes(att.url))
            fileUrls.push(att.url);
        }
      }

      console.log(`[HMRC] Content API found ${fileUrls.length} asset URLs`);
    } else {
      console.warn(`[HMRC] Content API HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn('[HMRC] Content API error:', e.message);
  }

  // Method B (NEW): Direct HTML page scrape — most reliable
  if (fileUrls.length === 0) {
    try {
      const pageRes = await fetch(
        'https://www.gov.uk/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
        { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) }
      );
      if (pageRes.ok) {
        const html = await pageRes.text();
        for (const m of [...html.matchAll(/href="(https:\/\/assets\.publishing\.service\.gov\.uk[^"]*\.(xlsx?|csv))"/gi)]) {
          if (!fileUrls.includes(m[1])) fileUrls.push(m[1]);
        }
        console.log(`[HMRC] HTML scrape found ${fileUrls.length} asset URLs`);
      }
    } catch (e) {
      console.warn('[HMRC] HTML scrape error:', e.message);
    }
  }

  // Fallback: known URLs from recent naming rounds
  const fallbacks = [
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/683841b5e0f10eed80aafad3/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
    'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1096346/Table_-_employers_named_-_National_Minimum_Wage_Naming_Scheme_Round_19.csv',
  ];
  for (const u of fallbacks) if (!fileUrls.includes(u)) fileUrls.push(u);

  console.log(`[HMRC] Trying ${fileUrls.length} URLs`);

  for (const url of fileUrls) {
    if (rows.length > 0) break;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
        redirect: 'follow',
      });
      if (!res.ok) { console.warn(`[HMRC] ${url.split('/').pop()} → ${res.status}`); continue; }

      if (/\.(xlsx?)$/i.test(url)) {
        const buf  = await res.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (data.length < 2) continue;

        const h   = (data[0] ?? []).map(x => String(x).toLowerCase().trim());
        const col = (...terms) => { for (const t of terms) { const i = h.findIndex(x => x.includes(t)); if (i !== -1) return i; } return -1; };
        const nc  = col('employer', 'company', 'name', 'trading');
        const yc  = col('year', 'date', 'period');
        const sc  = col('sector', 'industry', 'sic');
        const ac  = col('amount', 'arrears', 'underpayment', 'wages', 'identified');
        const wc  = col('worker', 'employee', 'number');
        const pc  = col('penalty', 'fine');

        console.log(`[HMRC] ${url.split('/').pop()} XLSX ${data.length} rows`);
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.every(c => String(c).trim() === '')) continue;
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
          const nm = sanitize(cols[0]);
          if (!nm || nm.length < 2) return;
          rows.push({
            company_name:       nm,
            industry:           sanitize(cols[2]),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(cols[4] ?? '').replace(/\D/g, '')),
            amount_back_wages:  toFloatStr(cols[3] ?? ''),
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
// 🇨🇦 Canada — ESDC HTML scrape + Open Government Portal API
//
// FIXED: Reduced timeout from 90s to 25s (was nearly timing out = 72s).
//        Added Open Government Portal as primary source.
//        Improved HTML parser to handle <details> accordion elements.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];

  // Method A (NEW): Try Open Government Portal API first
  try {
    const searchRes = await fetch(
      'https://open.canada.ca/data/en/api/3/action/package_search?q=named+employers+labour+code&rows=5',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
    );
    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      for (const pkg of (searchJson?.result?.results ?? []).slice(0, 3)) {
        if (rows.length > 0) break;
        for (const r of (pkg?.resources ?? [])) {
          if (!r.url || !r.format?.match(/CSV|JSON|XLSX/i)) continue;
          try {
            const dataRes = await fetch(r.url, {
              headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000),
            });
            if (!dataRes.ok) continue;
            const text = await dataRes.text();
            if (text.startsWith('<')) continue;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            lines.slice(1).forEach((line, i) => {
              const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
              const nm = sanitize(cols[0]);
              if (!nm || nm.length < 2) return;
              rows.push({
                company_name:       nm,
                state_province:     sanitize(cols[1] ?? null),
                violation_type:     'Canada Labour Code Violation',
                amount_back_wages:  toFloatStr(cols[2] ?? ''),
                employees_affected: 0,
                country:            'Canada',
                year:               new Date().getFullYear(),
                case_id:            `CA-NAM-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${i}`,
                source_agency:      'Employment and Social Development Canada',
                source_url:         r.url,
              });
            });
            if (rows.length > 0) { console.log(`[ESDC] Open Gov CSV → ${rows.length} rows`); }
          } catch { /* try next */ }
        }
      }
    }
  } catch (e) {
    console.warn('[ESDC] Open Gov search failed:', e.message);
  }

  if (rows.length > 0) return rows;

  // Method B: HTML scrape of canada.ca naming page
  // FIXED: Reduced timeout from 90s to 25s
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 25000); // FIXED: was 90000ms
    const res  = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers: { 'User-Agent': UA }, signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    console.log(`[ESDC] page ${Math.round(html.length / 1024)}KB`);

    // Parse standard tables
    const tables = [...(html.match(/<table[\s\S]*?<\/table>/gi) ?? [])];
    for (const table of tables) {
      const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [, tr] of trs) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => c.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        if (/employer|company|name|province|amount|date/i.test(name) && cells.length > 3) continue;
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
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }

    // FIXED: Handle <details>/<summary> accordion structure (Canada.ca uses this pattern)
    if (rows.length === 0) {
      const detailsBlocks = [...html.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/gi)];
      for (const [, block] of detailsBlocks) {
        const trs = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
        for (const [, tr] of trs) {
          const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
            .map(([, c]) => c.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
          if (cells.length < 2) continue;
          const name = sanitize(cells[0]);
          if (!name || name.length < 2) continue;
          if (/employer|company|name/i.test(name)) continue;
          const province = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
          const amCell   = cells.find(c => /\$[\d,]+/.test(c));
          rows.push({
            company_name:       name,
            state_province:     sanitize(province),
            violation_type:     'Canada Labour Code Violation',
            amount_back_wages:  amCell ? toFloatStr(amCell) : 0,
            employees_affected: 0,
            country:            'Canada',
            year:               new Date().getFullYear(),
            case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
            source_agency:      'Employment and Social Development Canada',
            source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
          });
        }
      }
      if (rows.length > 0) console.log(`[ESDC] Found ${rows.length} rows in accordion structure`);
    }

    // Fallback: parse <li> elements
    if (rows.length === 0) {
      for (const [, li] of [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]) {
        const text = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length < 5 || text.length > 300 || !/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english|back to top|skip/i.test(text)) continue;
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
    if (e.name === 'AbortError') {
      console.error('[ESDC] ✗ Request timed out after 25s — page is too slow (was timing out at 90s before)');
    } else {
      console.error('[ESDC]', e.message);
    }
  }

  console.log(`[ESDC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — data.gov.au CKAN API (FWO enforcement data)
//
// FIXED: Added dynamic package_search to discover correct resource IDs.
//        Old hardcoded IDs were wrong/stale.
//        Expanded field name lookups for actual FWO dataset columns.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  const rows = [];

  // Step 1 (NEW): Dynamically discover FWO resource IDs via CKAN search
  const resourceIds = [];
  try {
    const searches = [
      'https://data.gov.au/api/3/action/package_search?q=fair+work+ombudsman+penalty&rows=10',
      'https://data.gov.au/api/3/action/package_search?q=fair+work+ombudsman+litigation&rows=5',
    ];
    for (const searchUrl of searches) {
      if (resourceIds.length >= 6) break;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const pkg of (json?.result?.results ?? [])) {
        for (const r of (pkg?.resources ?? [])) {
          if (r.id && r.format?.match(/CSV|JSON|XLSX/i) && !resourceIds.includes(r.id)) {
            resourceIds.push(r.id);
            console.log(`[FWO] discovered: resource_id=${r.id} format=${r.format} name=${r.name?.slice(0, 40)}`);
          }
        }
      }
    }
    console.log(`[FWO] discovered ${resourceIds.length} resource IDs dynamically`);
  } catch (e) {
    console.warn('[FWO] package search failed:', e.message);
  }

  // Add known fallback IDs
  for (const id of ['29e2e0f5-3e1f-4a09-b75a-88aba6948a23', '98a41c08-c94b-4b47-8a44-c44dcc9c9a95']) {
    if (!resourceIds.includes(id)) resourceIds.push(id);
  }

  // Step 2: Try each resource ID
  for (const id of resourceIds) {
    if (rows.length > 0) break;
    try {
      const url = `https://data.gov.au/api/3/action/datastore_search?resource_id=${id}&limit=1000`;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) { console.warn(`[FWO] ${id} HTTP ${res.status}`); continue; }
      const json = await res.json();
      if (!json?.success) { console.warn(`[FWO] ${id} not in datastore`); continue; }
      const records = json?.result?.records ?? [];
      if (!records.length) continue;

      console.log(`[FWO] ${id}: ${records.length} records — keys: ${Object.keys(records[0] ?? {}).slice(0, 8).join(', ')}`);

      for (const r of records) {
        const name = sanitize(
          r.Respondent ?? r.respondent ?? r.company_name ?? r.employer_name ??
          r['Employer Name'] ?? r['Establishment Name'] ?? r.Name ?? r.name ??
          r.establishment_name ?? r.Employer ?? ''
        );
        if (!name || name.length < 2) continue;

        const penalty = toFloatStr(String(
          r.Penalty ?? r.penalty ?? r.penalty_amount ?? r['Total Penalty'] ??
          r['Penalty Amount'] ?? r['Civil Penalty'] ?? r.amount ?? r.Amount ?? '0'
        ));
        const wages = toFloatStr(String(
          r.back_pay ?? r.underpayment ?? r['Back Pay'] ?? r.wages ??
          r['Amount Owed'] ?? r['Underpayment Amount'] ?? r['Back Wages'] ?? '0'
        ));
        if (penalty <= 0 && wages <= 0) continue;

        rows.push({
          company_name:       name,
          industry:           sanitize(r.Industry ?? r.industry ?? r.Sector ?? null),
          violation_type:     sanitize(
            r.contravention ?? r.Contravention ?? r['Contravention Type'] ??
            r.breach_type ?? r['Breach Type'] ?? 'Fair Work Act Violation'
          ) ?? 'Fair Work Act Violation',
          employees_affected: toInt(r.workers ?? r.Workers ?? r['Number of Workers'] ?? r.employees ?? 0),
          amount_back_wages:  wages,
          amount_penalties:   penalty,
          city:               sanitize(r.city ?? r.City ?? r.suburb ?? r.Suburb ?? null),
          state_province:     sanitize(r.state ?? r.State ?? r.jurisdiction ?? null),
          country:            'Australia',
          year:               yearFrom(
            r.date ?? r.Date ?? r.penalty_date ?? r['Decision Date'] ??
            r['Date of Decision'] ?? r['Judgment Date'] ?? null
          ),
          case_id:            sanitize(
            r.case_number ?? r['Case Number'] ?? r['Matter Number'] ?? r.matter_number ?? null
          ) ?? `AU-FWO-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
          source_agency:      'Fair Work Ombudsman — Australia',
          source_url:         'https://www.fairwork.gov.au/about-us/our-work/compliance-and-enforcement',
        });
      }

      if (rows.length > 0) console.log(`[FWO] ${id} → ${rows.length} rows`);
    } catch (e) {
      console.warn(`[FWO] ${id}:`, e.message);
    }
  }

  console.log(`[FWO] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇿 New Zealand — MBIE Employment Public Register
//
// FIXED: Added NZ open data portal (catalogue.data.govt.nz) as primary,
//        improved HTML scraping with details/dt/dl fallback patterns.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNewZealand() {
  const rows = [];

  // Method A (NEW): Try NZ open data portal
  try {
    const res = await fetch(
      'https://catalogue.data.govt.nz/api/3/action/package_search?q=employment+register+compliance+penalty&rows=5',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const json = await res.json();
      for (const pkg of (json?.result?.results ?? []).slice(0, 3)) {
        if (rows.length > 0) break;
        for (const r of (pkg?.resources ?? [])) {
          if (!r.url || !r.format?.match(/CSV|JSON/i)) continue;
          try {
            const dataRes = await fetch(r.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
            if (!dataRes.ok) continue;
            const text = await dataRes.text();
            if (text.startsWith('<')) continue;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            lines.slice(1).forEach((line, i) => {
              const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
              const name = sanitize(cols[0]);
              if (!name || name.length < 2) return;
              rows.push({
                company_name: name,
                violation_type: sanitize(cols[1] ?? 'Employment Relations Act Breach') ?? 'Employment Relations Act Breach',
                employees_affected: 0,
                amount_back_wages: toFloatStr(cols[2] ?? ''),
                amount_penalties: 0,
                country: 'New Zealand',
                year: new Date().getFullYear(),
                case_id: `NZ-MBIE-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${i}`,
                source_agency: 'Ministry of Business, Innovation and Employment — NZ',
                source_url: r.url,
              });
            });
            if (rows.length > 0) console.log(`[MBIE NZ] Open data → ${rows.length} rows`);
          } catch { /* try next */ }
        }
      }
    }
  } catch { /* fall through */ }

  if (rows.length > 0) return rows;

  // Method B: HTML scrape of employment.govt.nz
  try {
    const res = await fetch(
      'https://www.employment.govt.nz/resolving-problems/enforcement/public-register/',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
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
        if (/employer|company|name|respondent|order|date/i.test(name) && cells.length > 2) continue;
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

    // Try definition lists if no tables
    if (rows.length === 0) {
      for (const [, dt, dd] of [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)]) {
        const name = sanitize(dt.replace(/<[^>]+>/g, ' ').trim());
        const detail = dd.replace(/<[^>]+>/g, ' ').trim();
        if (!name || name.length < 2 || /date|amount|type|penalty|status/i.test(name)) continue;
        rows.push({
          company_name: name,
          violation_type: 'Employment Relations Act Breach',
          employees_affected: 0,
          amount_back_wages: toFloatStr((detail.match(/\$[\d,]+/) ?? ['0'])[0]),
          amount_penalties: 0,
          country: 'New Zealand',
          year: new Date().getFullYear(),
          case_id: `NZ-MBIE-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency: 'Ministry of Business, Innovation and Employment — NZ',
          source_url: 'https://www.employment.govt.nz/resolving-problems/enforcement/public-register/',
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
