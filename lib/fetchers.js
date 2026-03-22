// ================================================
// WageTheft.live — Government Data Fetchers
// Rewritten March 2026 based on live debug results:
//
//  DOL USA  — data.dol.gov/get/whd_whisard/limit/N  HTTP 200 ✅
//  HMRC UK  — direct CSV asset URLs                  working ✅
//  Canada   — canada.ca HTML page scrape             HTTP 200 ✅
//  FWO AU   — fairwork.gov.au BLOCKED by Vercel      skip ❌
//  WRC IE   — RSS feed                               working ✅
//  NLA NL   — RSS feed                               working ✅
//  ELA EU   — RSS feed                               working ✅
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0; +https://wagetheft.live)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};
export const toInt      = (v) => { const n = parseInt(v,10);   return isNaN(n)||n<0 ? 0 : n; };
export const toFloat    = (v) => { const n = parseFloat(v);    return isNaN(n)||n<0 ? 0 : n; };
export const toFloatStr = (s) => toFloat(String(s??'').replace(/[^0-9.]/g,''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y)||y<1990||y>2100 ? null : y;
};

async function go(url, opts={}, ms=45000) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, ...opts.headers },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

function parseCSVLine(line) {
  const r=[]; let c=''; let q=false;
  for (const ch of line) {
    if (ch==='"') q=!q;
    else if (ch===','&&!q) { r.push(c.trim()); c=''; }
    else c+=ch;
  }
  r.push(c.trim());
  return r;
}

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
    const g = (tag) => {
      const m = ix.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || ix.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
      return m?.[1]?.trim()??'';
    };
    items.push({ title:g('title'), desc:g('description'), link:g('link'), pubDate:g('pubDate') });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — data.dol.gov/get/whd_whisard (confirmed HTTP 200)
// Auth: x-api-key header
// Fetches 5 pages × 500 records = up to 2,500 per run
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  if (!apiKey) { console.error('[DOL] Missing DOL_API_KEY'); return []; }
  const rows = [];

  for (let offset = 0; offset < 2500; offset += 500) {
    try {
      const res = await fetch(
        `https://data.dol.gov/get/whd_whisard/rows:500/offset:${offset}/format:json`,
        { headers: { 'x-api-key': apiKey, 'User-Agent': UA, Accept: 'application/json' },
          signal: AbortSignal.timeout(45000) }
      );
      if (!res.ok) { console.warn(`[DOL] HTTP ${res.status} at offset ${offset}`); break; }

      const json = await res.json();
      // data.dol.gov returns array directly OR wrapped
      const records = Array.isArray(json) ? json
        : (json?.whd_whisard ?? json?.data ?? json?.results ?? json?.d?.results ?? []);

      if (!records.length) { console.log(`[DOL] No more records at offset ${offset}`); break; }

      for (const r of records) {
        // Field names vary — try all known variants
        const bw = toFloat(r.bw_atp_amt ?? r.back_wages_amt ?? r.backWages ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.legalName ?? r.trade_name ?? r.tradeName ?? r.employer_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? r.tradeName ?? null),
          industry:           sanitize(r.naic_description ?? r.naicDescription ?? r.industry ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? r.employeeCount ?? r.ee_cnt ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? r.penalty_amt ?? r.penalties ?? 0),
          city:               sanitize(r.city_nm ?? r.city ?? null),
          state_province:     sanitize(r.st_cd ?? r.state ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? r.findingsEndDate ?? r.date ?? null),
          case_id:            sanitize(r.case_id ?? r.caseId ?? null),
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
// 🇬🇧 UK — HMRC NMW direct known CSV URLs
// gov.uk content API returns 404. Using direct asset URLs instead.
// Updated list — add new URL each year when HMRC publishes a new round.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];

  // Known working CSV URLs — most recent first
  // HMRC publishes 1-2 rounds per year to assets.publishing.service.gov.uk
  const CSV_URLS = [
    // Round 22 — 2024 publication
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    // Round 21 — 2023 publication
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
    // Round 20 — 2022 publication
    'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1059571/Named_employers_Round_20.csv',
  ];

  for (const url of CSV_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/csv,*/*' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.warn(`[HMRC] ${url} → HTTP ${res.status}`); continue; }

      const text  = await res.text();
      // Verify it's actually CSV not HTML/JSON
      if (text.trim().startsWith('<') || text.trim().startsWith('{')) {
        console.warn(`[HMRC] ${url} returned non-CSV content`);
        continue;
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      console.log(`[HMRC] ${url.split('/').pop()} → ${lines.length} lines`);

      lines.slice(1).forEach((line, i) => {
        const c  = parseCSVLine(line);
        if (c.length < 4) return;
        const nm = sanitize(c[0]);
        const bw = toFloatStr(c[3]);
        if (!nm || bw <= 0) return;
        rows.push({
          company_name:       nm,
          industry:           sanitize(c[2]),
          violation_type:     'National Minimum Wage Underpayment',
          employees_affected: toInt(String(c[4]??'').replace(/\D/g,'')),
          amount_back_wages:  bw,
          amount_penalties:   toFloatStr(c[5]??''),
          country:            'UK',
          year:               toInt(String(c[1]??'').replace(/\D/g,'')) || new Date().getFullYear(),
          case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
          source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
          source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
        });
      });

      if (rows.length > 0) break; // Stop after first successful CSV
    } catch(e) {
      console.warn(`[HMRC]`, e.message);
    }
  }

  console.log(`[HMRC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — SKIPPED
// fairwork.gov.au is blocked by Vercel's network (fetch failed error).
// Will be re-enabled if a proxy or alternative endpoint is found.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  console.log('[FWO] Skipped — fairwork.gov.au blocked by Vercel network');
  return [];
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — HTML page scrape (confirmed 200 OK, 129KB, 200 employers)
// canada.ca/en/employment-social-development/.../public-naming-employers
// Contains employer names, provinces, amounts in HTML table/list format
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

    // Extract table rows — canada.ca uses <table> with employer data
    // Pattern: <tr> contains employer name, province, amount, section
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];

    let found = 0;
    for (const table of tableMatch) {
      const trMatches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [, tr] of trMatches) {
        // Extract all <td> cell values
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([,c]) => c.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());

        if (cells.length < 2) continue;

        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;

        // Try to find province (2-letter code or full name)
        const province = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;

        // Try to find dollar amount
        const amountCell = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const amount = amountCell ? extractAmount(amountCell) : 0;

        // Try to find year
        const yearCell = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        const year = yearCell ? toInt(yearCell) : new Date().getFullYear();

        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amount,
          employees_affected: 0,
          country:            'Canada',
          year:               year,
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    // Fallback: if table parsing found nothing, try list items <li>
    if (rows.length === 0) {
      console.log('[ESDC] Table parse found 0 — trying list items');
      const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const [, li] of liMatches) {
        const text = li.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (text.length < 5 || text.length > 300) continue;

        // Looks like an employer name if it starts with a capital and has no nav keywords
        if (!/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;

        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name || name.length < 3) continue;

        const amount = extractAmount(text);
        const province = text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null;

        rows.push({
          company_name:       name,
          state_province:     province,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amount,
          employees_affected: 0,
          country:            'Canada',
          year:               new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }
  } catch(e) {
    console.error('[ESDC]', e.message);
  }

  console.log(`[ESDC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇮🇪 Ireland — Workplace Relations Commission RSS
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland() {
  const rows = [];
  const urls = [
    'https://www.workplacerelations.ie/en/news_media/press_releases/rss',
    'https://www.workplacerelations.ie/en/cases/adjudication_officer_decisions/rss',
  ];

  for (const url of urls) {
    try {
      const res = await go(url, {}, 30000);
      const items = parseRSS(await res.text());
      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('underpaid')&&!combined.includes('wage')&&
            !combined.includes('payment')&&!combined.includes('arrears')&&
            !combined.includes('minimum')&&!combined.includes('employment')) continue;
        const name = sanitize(title.replace(/\s*[-–|].*/,'').trim());
        if (!name||name.length<3) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??'';
        rows.push({
          company_name:      name,
          violation_type:    'WRC Employment Law Violation',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Ireland',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `IE-WRC-${slug}`,
          source_agency:     'Workplace Relations Commission — Ireland',
          source_url:        link || 'https://www.workplacerelations.ie',
        });
      }
    } catch(e) { console.warn('[WRC-IE]', e.message); }
  }

  console.log(`[WRC-IE] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — NLA RSS
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows = [];
  const urls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
  ];

  for (const url of urls) {
    try {
      const res = await go(url, {}, 30000);
      const items = parseRSS(await res.text());
      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('boete')&&!combined.includes('minimumloon')&&
            !combined.includes('loon')&&!combined.includes('wage')&&
            !combined.includes('fine')) continue;
        const name = sanitize(title.replace(/\s*[-–|].*/,'').trim());
        if (!name||name.length<3) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??'';
        rows.push({
          company_name:      name,
          violation_type:    'Minimum Wage Violation (WML)',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Netherlands',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `NL-NLA-${slug}`,
          source_agency:     'Nederlandse Arbeidsinspectie — Netherlands Labour Authority',
          source_url:        link || 'https://www.nlarbeidsinspectie.nl',
        });
      }
    } catch(e) { console.warn('[NLA-NL]', e.message); }
  }

  console.log(`[NLA-NL] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇪🇺 Europe — ELA RSS
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows = [];
  const urls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
  ];

  for (const url of urls) {
    try {
      const res = await go(url, {}, 30000);
      const items = parseRSS(await res.text());
      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('inspection')&&!combined.includes('underpaid')&&
            !combined.includes('wage')&&!combined.includes('undeclared')&&
            !combined.includes('enforcement')) continue;
        const name = sanitize(title.slice(0,120)) || 'EU Inspection';
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??'';
        rows.push({
          company_name:      name,
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
