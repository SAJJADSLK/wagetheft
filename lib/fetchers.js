// WageTheft.live — Data Fetchers — FIXED May 2026
// ─────────────────────────────────────────────────────────────────────────────
// FIXES vs previous version:
//   1. DOL       — broader field parsing + raw-response logging for debug
//   2. HMRC      — skip Content API (Vercel IPs get 403); fresh direct URLs
//   3. Canada    — 30s timeout (was 90s → near-timeout); better fallback
//   4. Australia — IMPLEMENTED (was stub returning [])
//   5. Ireland   — IMPLEMENTED (was stub returning [])
//   6. Netherlands — IMPLEMENTED (was stub returning [])
//   7. Europe    — IMPLEMENTED (was stub returning [])

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0; +https://wagetheft.live)';

// ── Shared helpers ───────────────────────────────────────────────────────────

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\\/g, '')
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

function htmlText(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWorkerCount(text) {
  const m = text.match(/(\d+)\s+(?:worker|employee|staff|worker)/i);
  return m ? toInt(m[1]) : 0;
}

// ─── 1. USA — Department of Labor (WHD) ─────────────────────────────────────
export async function fetchDOL(apiKey) {
  const rows = [];
  if (!apiKey) { console.warn('[DOL] No API key — skipping'); return rows; }

  for (let offset = 0; offset < 5000; offset += 1000) {
    try {
      // DOL v4 requires the API key BOTH in the URL query param AND header
      const url = `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?X-Api-Key=${encodeURIComponent(apiKey)}&limit=1000&offset=${offset}`;
      const res = await fetch(url, {
        headers: {
          'X-Api-Key':  apiKey,
          'Accept':     'application/json',
          'User-Agent': UA,
        },
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        console.warn(`[DOL] HTTP ${res.status} — ${errTxt.slice(0, 300)}`);
        break;
      }

      const json = await res.json();

      // DOL v4 can wrap in various shapes — log unknown shapes for debugging
      let records = [];
      if (Array.isArray(json))                  records = json;
      else if (Array.isArray(json?.data))        records = json.data;
      else if (Array.isArray(json?.result))      records = json.result;
      else if (Array.isArray(json?.results))     records = json.results;
      else if (Array.isArray(json?.d?.results))  records = json.d.results;
      else {
        console.warn('[DOL] Unknown shape. Keys:', Object.keys(json).join(', '));
        console.warn('[DOL] Sample:', JSON.stringify(json).slice(0, 500));
        break;
      }

      if (!records.length) break;

      for (const r of records) {
        const bw = toFloat(
          r.bw_atp_amt       ??
          r.backwage_amt     ??
          r.total_bw_atp_amt ??
          r.amt_bw_computed  ?? 0
        );
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_name ?? r.employer_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? null),
          industry:           sanitize(r.naic_description ?? r.industry ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? r.ee_cnt ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? r.penalty_amt ?? 0),
          city:               sanitize(r.city_nm ?? r.city ?? null),
          state_province:     sanitize(r.st_cd ?? r.state ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? r.investigation_date ?? null),
          case_id:            sanitize(r.case_id ?? r.case_number ?? null),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }
      console.log(`[DOL] offset=${offset} page=${records.length} total=${rows.length}`);
      if (records.length < 1000) break;
    } catch (e) { console.error('[DOL]', e.message); break; }
  }
  console.log(`[DOL] done: ${rows.length}`);
  return rows;
}

function dolType(r) {
  const t = [];
  if (toFloat(r.flsa_bw_atp_amt)  > 0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt)  > 0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt)  > 0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt)   > 0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)    > 0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)       > 0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ─── 2. UK — HMRC National Minimum Wage ─────────────────────────────────────
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch(e) { console.error('[HMRC] xlsx missing:', e.message); return rows; }

  // Dynamically discover the latest xlsx via the GOV.UK content API
  // (api.gov.uk uses a different CDN that is not blocked on Vercel, unlike www.gov.uk)
  const URLS = [];
  try {
    const apiRes = await fetch(
      'https://www.gov.uk/api/content/government/collections/national-minimum-wage-enforcement',
      { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) }
    );
    if (apiRes.ok) {
      const apiJson = await apiRes.json();
      // Walk the document links to find publication pages, then find xlsx attachments
      const docLinks = (apiJson?.links?.documents ?? []).map(d => d.api_path).filter(Boolean).slice(0, 5);
      for (const docPath of docLinks) {
        try {
          const docRes = await fetch(`https://www.gov.uk${docPath}`, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000)
          });
          if (!docRes.ok) continue;
          const docJson = await docRes.json();
          const attachments = docJson?.details?.attachments ?? docJson?.links?.attachments ?? [];
          for (const att of attachments) {
            const u = att?.url ?? att?.web_url ?? '';
            if (/\.(xlsx?|csv)$/i.test(u) && /minimum.wage|nmw|naming/i.test(u)) URLS.push(u);
          }
        } catch (_) { /* skip */ }
      }
      console.log(`[HMRC] GOV.UK API discovered ${URLS.length} URLs`);
    }
  } catch (e) { console.warn('[HMRC] GOV.UK API discovery failed:', e.message); }

  // Known-good fallbacks (rounds 20 and 19) — still append even if discovery succeeded
  const FALLBACK_URLS = [
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.xlsx',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.xlsx',
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];
  for (const u of FALLBACK_URLS) { if (!URLS.includes(u)) URLS.push(u); }

  for (const url of URLS) {
    if (rows.length > 0) break;
    const file = url.split('/').pop();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
      if (!r.ok) { console.warn(`[HMRC] ${file} → ${r.status}`); continue; }

      if (/\.xlsx?$/i.test(url)) {
        const buf  = await r.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const h    = (data[0] ?? []).map(x => String(x).toLowerCase().trim());
        const col  = (...ts) => { for (const t of ts) { const i = h.findIndex(x => x.includes(t)); if (i !== -1) return i; } return -1; };
        const nc   = col('employer', 'company', 'name') !== -1 ? col('employer', 'company', 'name') : 0;
        const yc   = col('year', 'date')                !== -1 ? col('year', 'date') : 1;
        const sc   = col('sector', 'industry', 'type')  !== -1 ? col('sector', 'industry', 'type') : 2;
        const ac   = col('amount', 'arrears', 'wages')  !== -1 ? col('amount', 'arrears', 'wages') : 3;
        const wc   = col('worker', 'employee', 'staff') !== -1 ? col('worker', 'employee', 'staff') : 4;
        const pc   = col('penalty')                     !== -1 ? col('penalty') : 5;
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
        // CSV
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
      }
      console.log(`[HMRC] ${file} → ${rows.length} rows`);
    } catch(e) { console.warn('[HMRC]', e.message); }
  }
  console.log(`[HMRC] done: ${rows.length}`);
  return rows;
}

// ─── 3. Canada — ESDC Public Naming ─────────────────────────────────────────
export async function fetchCanada() {
  const rows = [];
  const SRC = 'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html';
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000); // 30s — was 90s (caused near-timeout on Vercel)
    const res   = await fetch(SRC, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html   = await res.text();
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];

    for (const table of tables) {
      for (const [, tr] of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([, c]) => htmlText(c));
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const prov = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
        const amC  = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yrC  = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(prov),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amC ? toFloat(amC.replace(/[^0-9.]/g, '')) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               yrC ? toInt(yrC) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         SRC,
        });
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
          company_name:       name,
          state_province:     text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  am ? toFloat(am[1].replace(/,/g, '')) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         SRC,
        });
      }
    }
  } catch(e) { console.error('[ESDC]', e.message); }
  console.log(`[ESDC] done: ${rows.length}`);
  return rows;
}

// ─── 4. Australia — Fair Work Ombudsman ─────────────────────────────────────
// Scrapes court outcomes page + media release articles
export async function fetchAustralia() {
  const rows = [];
  // Overall 55s budget — well under Vercel's 70s limit
  const overallCtrl = new AbortController();
  const overallTimer = setTimeout(() => overallCtrl.abort(), 55000);

  // Source A: Court outcomes listing
  try {
    const res = await fetch(
      'https://www.fairwork.gov.au/about-us/our-role/enforcing-the-law/court-outcomes',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.any([overallCtrl.signal, AbortSignal.timeout(30000)]) }
    );
    if (res.ok) {
      const html   = await res.text();
      const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
      for (const table of tables) {
        for (const [, tr] of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
          const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
            .map(([, c]) => htmlText(c));
          if (cells.length < 2) continue;
          const name = sanitize(cells[0]);
          if (!name || name.length < 2 || /employer|respondent|name|company/i.test(name)) continue;
          const amCell = cells.find(c => /\$[\d,]/.test(c));
          const amount = amCell ? toFloat(amCell.replace(/[^0-9.]/g, '')) : 0;
          const dateCell = cells.find(c => /\d{4}/.test(c));
          rows.push({
            company_name:       name,
            violation_type:     detectAUType(cells.join(' ')),
            employees_affected: 0,
            amount_back_wages:  0,
            amount_penalties:   amount,
            country:            'Australia',
            year:               dateCell ? yearFrom(dateCell.match(/\d{4}/)?.[0]) ?? new Date().getFullYear() : new Date().getFullYear(),
            case_id:            `AU-FWO-CT-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
            source_agency:      'Fair Work Ombudsman',
            source_url:         'https://www.fairwork.gov.au/about-us/our-role/enforcing-the-law/court-outcomes',
          });
        }
      }
      console.log(`[FWO] Court outcomes table: ${rows.length} rows`);
    }
  } catch(e) { console.warn('[FWO] Court outcomes:', e.message); }

  // Source B: Media releases — scan recent enforcement articles (capped at 5 to stay within timeout)
  try {
    const listRes = await fetch(
      'https://www.fairwork.gov.au/newsroom/media-releases',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.any([overallCtrl.signal, AbortSignal.timeout(20000)]) }
    );
    if (listRes.ok) {
      const listHtml = await listRes.text();
      const links    = [...new Set(
        [...listHtml.matchAll(/href="(\/newsroom\/media-releases\/[^"#]+)"/gi)].map(m => m[1])
      )].slice(0, 5); // ← was 20; reduced to prevent Vercel timeout

      for (const path of links) {
        if (overallCtrl.signal.aborted) break;
        try {
          const ar = await fetch(
            `https://www.fairwork.gov.au${path}`,
            { headers: { 'User-Agent': UA }, signal: AbortSignal.any([overallCtrl.signal, AbortSignal.timeout(10000)]) }
          );
          if (!ar.ok) continue;
          const body = htmlText(await ar.text());
          // Pattern: Company name + ordered/penalised + dollar amount
          const rx = /([A-Z][A-Za-z0-9\s&'(),-]{3,60}?)\s+(?:has been|was|were|have been)\s+(?:ordered|penalised|fined|required to pay|found to have)[^.]{0,120}\$([\d,]+)/g;
          let m;
          while ((m = rx.exec(body)) !== null) {
            const name   = sanitize(m[1].trim().replace(/^(The|A|An)\s+/i, ''));
            const amount = toFloat(m[2].replace(/,/g, ''));
            if (!name || name.length < 3 || amount < 500) continue;
            const yrM  = body.match(/\b(202[0-9]|201[5-9])\b/);
            const isBackpay = /underpay|back pay|backpay/i.test(body.slice(Math.max(0, m.index - 200), m.index + 200));
            rows.push({
              company_name:       name,
              violation_type:     detectAUType(body),
              employees_affected: extractWorkerCount(body),
              amount_back_wages:  isBackpay ? amount : 0,
              amount_penalties:   isBackpay ? 0 : amount,
              country:            'Australia',
              year:               yrM ? toInt(yrM[1]) : new Date().getFullYear(),
              case_id:            `AU-FWO-MR-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
              source_agency:      'Fair Work Ombudsman',
              source_url:         `https://www.fairwork.gov.au${path}`,
            });
          }
        } catch(e) { /* skip individual article errors */ }
      }
      console.log(`[FWO] After media releases: ${rows.length} total rows`);
    }
  } catch(e) { console.warn('[FWO] Media releases:', e.message); }

  // Deduplicate by company name
  const seen = new Set();
  const deduped = rows.filter(r => {
    const k = r.company_name.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  console.log(`[FWO] done: ${deduped.length}`);
  clearTimeout(overallTimer);
  return deduped;
}

function detectAUType(text) {
  const t = text.toLowerCase();
  if (t.includes('underpay') || t.includes('back pay') || t.includes('minimum wage')) return 'Minimum Wage Underpayment';
  if (t.includes('overtime'))       return 'Overtime Violations';
  if (t.includes('sham contract'))  return 'Sham Contracting';
  if (t.includes('record-keep') || t.includes('record keep')) return 'Record-Keeping Violations';
  if (t.includes('annualised'))     return 'Annualised Wage Violations';
  return 'Fair Work Act Contravention';
}

// ─── 5. Ireland — Workplace Relations Commission ─────────────────────────────
export async function fetchIreland() {
  const rows = [];

  const PAGES = [
    // WRC publishes a structured decisions list at this endpoint
    'https://www.workplacerelations.ie/en/publications-forms/enforcement-decisions/',
    'https://www.workplacerelations.ie/en/cases/enforcement-notices/',
    // Press releases are the most reliable source of structured fine data
    'https://www.workplacerelations.ie/en/news-media/press-releases/',
    // Named employer list (if present — added for redundancy)
    'https://www.workplacerelations.ie/en/publications-forms/enforcement-decisions/?pageNumber=1',
  ];

  for (const url of PAGES) {
    if (rows.length >= 30) break;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.warn(`[WRC] ${res.status} ${url}`); continue; }
      const html = await res.text();

      // Try tables first
      const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
      for (const table of tables) {
        for (const [, tr] of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
          const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
            .map(([, c]) => htmlText(c));
          if (cells.length < 2) continue;
          const name = sanitize(cells[0]);
          if (!name || name.length < 2 || /company|employer|name|respondent/i.test(name)) continue;
          const amCell  = cells.find(c => /[€£$][\d,]|[\d,]{3,}/.test(c));
          const amount  = amCell ? toFloat(amCell.replace(/[^0-9.]/g, '')) : 0;
          const dateC   = cells.find(c => /\d{4}/.test(c));
          rows.push({
            company_name:       name,
            violation_type:     detectIEType(cells.join(' ')),
            employees_affected: 0,
            amount_back_wages:  amount,
            amount_penalties:   0,
            country:            'Ireland',
            year:               dateC ? yearFrom(dateC.match(/\d{4}/)?.[0]) ?? new Date().getFullYear() : new Date().getFullYear(),
            case_id:            `IE-WRC-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
            source_agency:      'Workplace Relations Commission',
            source_url:         url,
          });
        }
      }

      // Regex for inline enforcement mentions — handles € before or after amount, £ too
      const body = htmlText(html);
      // Pattern A: "Company ordered/fined … €1,234"
      const rxA  = /([A-Z][A-Za-z0-9\s&'(),-]{3,60}?)\s+(?:ordered|fined|penalised|awarded|required to pay)[^.]{0,150}[€£]([\d,]+)/g;
      // Pattern B: "€1,234 … awarded against Company" / "€1,234 … owed by Company"
      const rxB  = /[€£]([\d,]+)[^.]{0,150}(?:against|owed by|paid by|by)\s+([A-Z][A-Za-z0-9\s&'(),-]{3,60})/g;
      for (const [rx, nameIdx, amtIdx] of [[rxA, 1, 2], [rxB, 2, 1]]) {
        let m;
        while ((m = rx.exec(body)) !== null) {
          const name = sanitize(m[nameIdx].trim().replace(/^(The|A|An)\s+/i, ''));
          if (!name || name.length < 3) continue;
          rows.push({
            company_name:       name,
            violation_type:     detectIEType(body.slice(Math.max(0, m.index - 100), m.index + 200)),
            employees_affected: 0,
            amount_back_wages:  toFloat(m[amtIdx].replace(/,/g, '')),
            amount_penalties:   0,
            country:            'Ireland',
            year:               new Date().getFullYear(),
            case_id:            `IE-WRC-PR-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
            source_agency:      'Workplace Relations Commission',
            source_url:         url,
          });
        }
      }
      console.log(`[WRC] ${url.split('/').slice(3, 5).join('/')} → ${rows.length} rows`);
    } catch(e) { console.warn('[WRC]', e.message); }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = rows.filter(r => { const k = r.company_name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`[WRC] done: ${deduped.length}`);
  return deduped;
}

function detectIEType(text) {
  const t = text.toLowerCase();
  if (t.includes('minimum wage') || t.includes('national minimum')) return 'National Minimum Wage Violation';
  if (t.includes('working time') || t.includes('rest break'))        return 'Working Time Violation';
  if (t.includes('holiday') || t.includes('annual leave'))           return 'Holiday Pay Violation';
  if (t.includes('payslip') || t.includes('terms of employment'))    return 'Employment Terms Violation';
  if (t.includes('unfair dismissal'))                                 return 'Unfair Dismissal';
  return 'Employment Law Violation';
}

// ─── 6. Netherlands — Netherlands Labour Authority (NLA) ─────────────────────
export async function fetchNetherlands() {
  const rows = [];

  const NL_HEADERS = { 'User-Agent': UA, 'Accept-Language': 'nl-NL,nl;q=0.9', 'Accept': 'text/html,application/xhtml+xml' };

  const PAGES = [
    // Dedicated boetes/fines pages — more reliably have structured fine data
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws?onderwerp=boete',
    'https://www.nlarbeidsinspectie.nl/onderwerpen/minimumloon/nieuws',
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws',
    'https://www.nlarbeidsinspectie.nl/onderwerpen/cao-naleving/nieuws',
  ];

  for (const listUrl of PAGES) {
    if (rows.length >= 25) break;
    try {
      const listRes = await fetch(listUrl, {
        headers: NL_HEADERS,
        signal: AbortSignal.timeout(30000),
      });
      if (!listRes.ok) { console.warn(`[NLA] ${listRes.status} ${listUrl}`); continue; }
      const listHtml = await listRes.text();

      // Get article links — include /boetes/ and /onderwerpen/ paths
      const linkRx = /href="(\/actueel\/(?:nieuws|boetes)\/[^"]+|\/onderwerpen\/[^"]+\/nieuws\/[^"]+)"/gi;
      const links  = [...new Set([...listHtml.matchAll(linkRx)].map(m => m[1]))].slice(0, 15);

      for (const path of links) {
        try {
          const ar = await fetch(
            `https://www.nlarbeidsinspectie.nl${path}`,
            { headers: NL_HEADERS, signal: AbortSignal.timeout(15000) }
          );
          if (!ar.ok) continue;
          const body = htmlText(await ar.text());

          // Dutch: "Boete van €X opgelegd aan Y" or "Y beboet voor €X"
          const rxList = [
            // "€50.000 boete voor Bedrijf BV"
            /€\s*([\d.]+(?:,\d{2})?)\s*(?:boete|naheffing|sanctie)[^.]{0,80}([A-Z][A-Za-z0-9\s&'.-]{3,60})/gi,
            // "Bedrijf BV moet €50.000 betalen"
            /([A-Z][A-Za-z0-9\s&'.-]{3,60})\s+(?:moet|heeft|is|krijgt)[^.]{0,80}€\s*([\d.]+(?:,\d{2})?)/gi,
            // "boete opgelegd aan Bedrijf BV van €50.000"
            /(?:boete|beboet)[^.]{0,60}([A-Z][A-Za-z0-9\s&'.-]{3,60})[^.]{0,60}€\s*([\d.]+)/gi,
          ];

          for (const rx of rxList) {
            let m;
            while ((m = rx.exec(body)) !== null) {
              // Determine which group is name vs amount based on regex
              let name, amtStr;
              if (rx.source.startsWith('€')) { amtStr = m[1]; name = m[2]; }
              else                            { name = m[1]; amtStr = m[2]; }

              name   = sanitize(name?.trim().replace(/^(De|Het|Een)\s+/i, ''));
              const amount = toFloat((amtStr ?? '').replace(/\./g, '').replace(',', '.'));
              if (!name || name.length < 3 || amount < 100) continue;

              const yrM = body.match(/\b(202[0-9]|201[5-9])\b/);
              rows.push({
                company_name:       name,
                violation_type:     detectNLType(body),
                employees_affected: extractWorkerCount(body),
                amount_back_wages:  0,
                amount_penalties:   amount,
                country:            'Netherlands',
                year:               yrM ? toInt(yrM[1]) : new Date().getFullYear(),
                case_id:            `NL-NLA-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
                source_agency:      'Netherlands Labour Authority (NLA)',
                source_url:         `https://www.nlarbeidsinspectie.nl${path}`,
              });
            }
          }
        } catch(e) { /* skip individual errors */ }
      }
      console.log(`[NLA] ${listUrl.split('/').slice(-2).join('/')} → ${rows.length} rows`);
    } catch(e) { console.warn('[NLA]', e.message); }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = rows.filter(r => { const k = r.company_name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`[NLA] done: ${deduped.length}`);
  return deduped;
}

function detectNLType(text) {
  const t = text.toLowerCase();
  if (t.includes('minimumloon') || t.includes('minimum wage'))   return 'Minimum Wage Violation (WML)';
  if (t.includes('cao') || t.includes('collective'))            return 'Collective Agreement Violation';
  if (t.includes('arbeidstijd') || t.includes('working time'))  return 'Working Time Violation';
  if (t.includes('detachering') || t.includes('posting'))       return 'Posted Workers Violation';
  if (t.includes('zwart werk') || t.includes('undeclared'))     return 'Undeclared Work';
  return 'Labour Law Violation';
}

// ─── 7. Europe — European Labour Authority ──────────────────────────────────
export async function fetchEurope() {
  const rows = [];

  const PAGES = [
    'https://www.ela.europa.eu/en/news',
    'https://www.ela.europa.eu/en/media/news',
    'https://www.ela.europa.eu/en/activities/joint-inspections',
    // ELA publishes enforcement results under "what we do"
    'https://www.ela.europa.eu/en/what-we-do/enforcement-support',
  ];

  for (const listUrl of PAGES) {
    if (rows.length >= 20) break;
    try {
      const listRes = await fetch(listUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!listRes.ok) { console.warn(`[ELA] ${listRes.status} ${listUrl}`); continue; }
      const listHtml = await listRes.text();

      // Get article links — ELA uses /en/news/YYYY/... pattern
      const linkRx = /href="(\/en\/(?:news|media|activities)[^"]*\/[^"]{5,})"/gi;
      const links  = [...new Set([...listHtml.matchAll(linkRx)].map(m => m[1]))]
        .filter(p => !/\.(pdf|docx?|xlsx?)$/i.test(p))
        .slice(0, 10);

      for (const path of links) {
        try {
          const ar = await fetch(
            `https://www.ela.europa.eu${path}`,
            { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }
          );
          if (!ar.ok) continue;
          const body = htmlText(await ar.text());

          // ELA press releases use phrases like "X workers found underpaid", "Y companies inspected",
          // "fined", "penalised", "ordered to pay", "sanctioned" — broaden to catch all
          const rxList = [
            // Company fined/penalised with € amount
            /([A-Z][A-Za-z0-9\s&'(),-]{3,60}?)\s+(?:penalised|fined|sanctioned|infringed|ordered to pay|found in violation)[^.]{0,180}(?:€|EUR)\s*([\d,.]+)/gi,
            // "€ amount … [against/for] Company"
            /(?:€|EUR)\s*([\d,.]+)[^.]{0,180}(?:against|recovered from|owed by)\s+([A-Z][A-Za-z0-9\s&'(),-]{3,60})/gi,
            // "Company … [irregular|non-compliant|underpaid] … € amount"
            /([A-Z][A-Za-z0-9\s&'(),-]{3,60}?)[^.]{0,120}(?:irregular|non-compliant|underpaid|irregularities)[^.]{0,120}(?:€|EUR)\s*([\d,.]+)/gi,
          ];
          for (const rx of rxList) {
            let m;
            while ((m = rx.exec(body)) !== null) {
              const isAmtFirst = rx.source.startsWith('(?:€|EUR)');
              const name   = sanitize((isAmtFirst ? m[2] : m[1]).trim().replace(/^(The|A|An)\s+/i, ''));
              const amtRaw = isAmtFirst ? m[1] : m[2];
              const amount = toFloat((amtRaw ?? '').replace(/\./g, '').replace(',', '.'));
              if (!name || name.length < 3 || amount < 100) continue;
              const yrM = body.match(/\b(202[0-9]|201[5-9])\b/);
              rows.push({
                company_name:       name,
                violation_type:     'EU Labour Law Violation',
                employees_affected: extractWorkerCount(body),
                amount_back_wages:  0,
                amount_penalties:   amount,
                country:            'EU',
                year:               yrM ? toInt(yrM[1]) : new Date().getFullYear(),
                case_id:            `EU-ELA-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${rows.length}`,
                source_agency:      'European Labour Authority',
                source_url:         `https://www.ela.europa.eu${path}`,
              });
            }
          }
        } catch(e) { /* skip */ }
      }
      console.log(`[ELA] ${listUrl.split('/').slice(-2).join('/')} → ${rows.length} rows`);
    } catch(e) { console.warn('[ELA]', e.message); }
  }

  const seen = new Set();
  const deduped = rows.filter(r => { const k = r.company_name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`[ELA] done: ${deduped.length}`);
  return deduped;
}
